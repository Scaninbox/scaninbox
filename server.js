'use strict';

/**
 * ScanInbox — statiskā lapa + pieteikumu API uz SQLite.
 *
 *   node server.js
 *   node server.js --port 9000
 *
 * Nulle npm atkarību: SQLite nāk no Node iebūvētā `node:sqlite` (Node 22.5+).
 *
 * Modulis eksportē `createApp()`, un serveri palaiž tikai tad, ja fails ir
 * izsaukts tieši. Tāpēc testi var uzcelt savu instanci ar savu datubāzi,
 * neaiztiekot reālo.
 *
 * Vides mainīgie:
 *   SCANINBOX_DB            datubāzes fails (noklusējums ./data/scaninbox.db)
 *   SCANINBOX_ADMIN_TOKEN   nepieciešams, lai lasītu pieteikumus caur API.
 *                           Ja nav uzstādīts, lasīšanas galapunkti ir slēgti.
 *   SCANINBOX_ALLOW_ORIGIN  CORS izcelsme, ja lapa tiek hostēta atsevišķi
 *   PORT                    ports
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const SCHEMA_PATH = path.join(ROOT, 'db', 'schema.sql');

const LIMITS = {
  body: 8 * 1024,             // pieteikums nekad nav lielāks
  email: 254,                 // RFC 5321 garākā adrese
  name: 120,
  model: 120,
  brands: 12,                 // tik daudz zīmolu formā vispār ir
  /* Pieteikšanās birojā notiek no vienas publiskās IP adreses, un viens
     pieteikums ir divi pieprasījumi (pieteikums, tad aptauja). Seši nozīmēja
     trīs kolēģus desmit minūtēs; rakstīšana ir lēta, atteikts lead nav. */
  rateMax: 30,
  rateWindowMs: 10 * 60 * 1000,
};

/* Ceļi, ko nekad nepasniedz, arī ja kāds tos pieprasa tieši. */
const BLOCKED = new Set(['data', 'db', 'test', '.git', 'node_modules']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Valodas, kurās lapa pastāv. Tās pašas ir shēmas CHECK ierobežojumā, tāpēc
   nezināmu kodu labāk nomainīt pret 'lv' nekā ļaut rakstīšanai nokrist. */
const LANGS = new Set(['lv', 'en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el', 'es',
  'fi', 'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv']);

// ---------------------------------------------------------------- datubāze ---

/**
 * Atver datubāzi, piemēro shēmu un sagatavo vaicājumus.
 * Shēma ir idempotenta, tāpēc to var izpildīt katrā startā.
 */
function openStore(dbPath) {
  const full = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });

  const db = new DatabaseSync(full);
  db.exec('PRAGMA journal_mode = WAL');   // lasītāji netraucē rakstītāju
  db.exec('PRAGMA foreign_keys = ON');    // jāieslēdz katram savienojumam
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  /* Derīgās koda vērtības nāk no datubāzes, nevis no otras kopijas JS pusē. */
  const codes = {
    segment: new Set(db.prepare('SELECT code FROM segments').all().map((r) => r.code)),
    device_band: new Set(db.prepare('SELECT code FROM device_bands').all().map((r) => r.code)),
    price_band: new Set(db.prepare('SELECT code FROM price_bands').all().map((r) => r.code)),
    brand: new Set(db.prepare('SELECT code FROM brands').all().map((r) => r.code)),
  };

  const q = {
    findByEmail: db.prepare('SELECT id FROM leads WHERE email_norm = ?'),
    insert: db.prepare(`
      INSERT INTO leads (email, email_norm, name, segment, device_band, device_model,
                         price_band, wants_beta, consent, lang)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`),
    /* COALESCE, not plain assignment: the page now signs somebody up with an
       e-mail alone and asks the rest afterwards, so a later submission that
       carries fewer answers must not erase the ones already given. wants_beta
       is sticky for the same reason — an opt-in is never withdrawn by silence. */
    update: db.prepare(`
      UPDATE leads SET email = ?,
                       name         = COALESCE(?, name),
                       segment      = COALESCE(?, segment),
                       device_band  = COALESCE(?, device_band),
                       device_model = COALESCE(?, device_model),
                       price_band   = COALESCE(?, price_band),
                       wants_beta   = MAX(wants_beta, ?),
                       lang         = ?,
                       updated_at   = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?`),
    clearBrands: db.prepare('DELETE FROM lead_brands WHERE lead_id = ?'),
    addBrand: db.prepare('INSERT OR IGNORE INTO lead_brands (lead_id, brand) VALUES (?, ?)'),
    event: db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)'),
    list: db.prepare('SELECT * FROM v_leads ORDER BY created_at DESC, id DESC LIMIT ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM leads'),
    priceDemand: db.prepare('SELECT * FROM v_price_demand'),
    segmentDemand: db.prepare('SELECT * FROM v_segment_demand'),
    brandDemand: db.prepare('SELECT * FROM v_brand_demand'),
    models: db.prepare('SELECT * FROM v_device_models LIMIT 25'),
  };

  return { db, codes, q, path: full, close: () => db.close() };
}

// ------------------------------------------------------------- validācija ---

/** Apgriež malas un ierobežo garumu. Tukša virkne kļūst par null. */
function clean(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Nezināmu kodu klusi izmet — labāk null nekā troksnis datubāzē. */
function pickCode(value, allowed) {
  const v = clean(value, 40);
  return v && allowed.has(v) ? v : null;
}

/**
 * Vairākizvēles kodi. Atšķir «lauka nebija» (null) no «nekas nav atzīmēts»
 * (tukšs masīvs) — pirmais neaiztiek jau saglabāto, otrais to notīra.
 */
function pickCodes(value, allowed, max = LIMITS.brands) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  for (const item of value) {
    const code = pickCode(item, allowed);
    if (code) seen.add(code);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/**
 * Pārbauda iesniegumu. Atgriež `{lead}` vai `{error, field}`.
 * Tīra funkcija — nekas netiek rakstīts.
 */
function validate(body, codes) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'invalid_body' };
  }

  /* Adresi negriežam pēc garuma: apgriezts e-pasts ir cita adrese, nevis
     īsāka tā pati, tāpēc pārgaru iesniegumu noraidām. */
  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
  if (!rawEmail || rawEmail.length > LIMITS.email || !EMAIL_RE.test(rawEmail)) {
    return { error: 'invalid_email', field: 'email' };
  }

  if (body.consent !== true) return { error: 'consent_required', field: 'consent' };

  return {
    lead: {
      email: rawEmail,
      email_norm: rawEmail.toLowerCase(),
      name: clean(body.name, LIMITS.name),
      segment: pickCode(body.segment, codes.segment),
      device_band: pickCode(body.devices, codes.device_band),
      device_model: clean(body.model, LIMITS.model),
      price_band: pickCode(body.priceBand, codes.price_band),
      brands: pickCodes(body.brands, codes.brand),
      wants_beta: body.wantsBeta === true ? 1 : 0,
      lang: LANGS.has(body.lang) ? body.lang : 'lv',
    },
  };
}

// ------------------------------------------------------------- rakstīšana ---

/**
 * Viena rinda uz e-pastu: atkārtots pieteikums atjauno atbildes.
 * Iesniegtais JSON vienmēr nonāk lead_events, lai vecā atbilde nepazustu.
 */
function saveLead(store, lead, raw) {
  store.db.exec('BEGIN IMMEDIATE');
  try {
    const existing = store.q.findByEmail.get(lead.email_norm);
    let id;
    let status;

    if (existing) {
      store.q.update.run(lead.email, lead.name, lead.segment, lead.device_band,
        lead.device_model, lead.price_band, lead.wants_beta, lead.lang, existing.id);
      id = existing.id;
      status = 'updated';
    } else {
      const res = store.q.insert.run(lead.email, lead.email_norm, lead.name, lead.segment,
        lead.device_band, lead.device_model, lead.price_band, lead.wants_beta, lead.lang);
      id = Number(res.lastInsertRowid);
      status = 'created';
    }

    /* null nozīmē «lauka nebija» — jau atzīmētos zīmolus tas neaiztiek.
       Masīvs, arī tukšs, aizstāj kopu pilnībā. */
    if (lead.brands) {
      store.q.clearBrands.run(id);
      for (const brand of lead.brands) store.q.addBrand.run(id, brand);
    }

    store.q.event.run(id, status, raw);
    store.db.exec('COMMIT');
    return { id, status };
  } catch (err) {
    store.db.exec('ROLLBACK');
    throw err;
  }
}

// ---------------------------------------------------- ātruma ierobežojums ---

/**
 * IP tikai atmiņā un tikai šim nolūkam — datubāzē tas nenonāk.
 * Instance uz lietotni, lai testi nedalītos ar stāvokli.
 */
function createRateLimiter({ max = LIMITS.rateMax, windowMs = LIMITS.rateWindowMs } = {}) {
  const hits = new Map();
  return function limited(key) {
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    const seen = hits.get(key);
    if (!seen || seen.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return false;
    }
    seen.n += 1;
    return seen.n > max;
  };
}

// ------------------------------------------------------------------ HTTP ---

/**
 * Nolasa ķermeni ar griestiem. Pārsniegumu noraida, bet savienojumu
 * nenogalina — citādi klients redzētu reset, nevis 413. Pārējos datus
 * vienkārši ignorē, un atbilde aizver savienojumu.
 */
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let stopped = false;
    const chunks = [];
    req.on('data', (c) => {
      if (stopped) return;
      size += c.length;
      if (size > max) {
        stopped = true;
        chunks.length = 0;
        reject(Object.assign(new Error('too_large'), { code: 'too_large' }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => { if (!stopped) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', (err) => { if (!stopped) reject(err); });
  });
}

function csv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}

/** Salīdzina bez laika noplūdes, lai pilnvaru nevar uzminēt pa baitam. */
function tokenMatches(given, expected) {
  if (!expected) return false;
  const a = Buffer.from(given || '');
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ------------------------------------------------------------- lietotne ---

function createApp(options = {}) {
  const store = options.store || openStore(options.dbPath || path.join(ROOT, 'data', 'scaninbox.db'));
  const adminToken = options.adminToken || '';
  const allowOrigin = options.allowOrigin || '';
  const maxBody = options.maxBody || LIMITS.body;
  const quiet = options.quiet === true;
  const limited = createRateLimiter(options.rate);

  const log = (...args) => { if (!quiet) console.log(...args); };

  function send(res, status, body, headers = {}) {
    const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {}),
      ...headers,
    });
    res.end(payload);
  }

  function serveStatic(res, urlPath) {
    let rel;
    try {
      rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
    } catch {
      return send(res, 400, { error: 'bad_path' });   // bojāts procentu kodējums
    }

    const first = rel.split(/[\\/]/)[0];
    if (!first || BLOCKED.has(first) || first.startsWith('.')) {
      return send(res, 404, { error: 'not_found' });
    }

    const full = path.resolve(ROOT, rel);
    if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
      return send(res, 403, { error: 'forbidden' });
    }

    let st;
    try {
      st = fs.statSync(full);
    } catch {
      return send(res, 404, { error: 'not_found' });
    }
    if (!st.isFile()) return send(res, 404, { error: 'not_found' });

    send(res, 200, fs.readFileSync(full), {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
  }

  const READS = new Set(['/api/leads', '/api/leads.csv', '/api/stats']);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;

    if (req.method === 'OPTIONS' && allowOrigin) {
      return send(res, 204, '', {
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      });
    }

    /* Dzīvības pārbaude neko neizpauž: pieteikumu skaits ir gan konkurenta
       mērījums, gan veids, kā pierādīt, ka «pirmie 10» jau ir aizņemti,
       kamēr lapa to vēl sola. Skaitu rāda /api/stats, aiz pilnvaras. */
    if (route === '/api/health') {
      return send(res, 200, { ok: true });
    }

    if (route === '/api/leads' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown';
      if (limited(ip)) return send(res, 429, { error: 'rate_limited' });

      let raw;
      try {
        raw = await readBody(req, maxBody);
      } catch {
        return send(res, 413, { error: 'too_large' }, { Connection: 'close' });
      }

      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(res, 400, { error: 'invalid_json' });
      }

      const { lead, error, field } = validate(body, store.codes);
      if (error) return send(res, 422, { error, field });

      try {
        const saved = saveLead(store, lead, raw);
        log(`[lead] ${saved.status} #${saved.id} ${lead.email}`);
        return send(res, saved.status === 'created' ? 201 : 200, { ok: true, ...saved });
      } catch (err) {
        console.error('[lead] save failed:', err.message);
        return send(res, 500, { error: 'save_failed' });
      }
    }

    /* Lasīšana ir aizvērta, kamēr nav uzstādīta pilnvara. */
    if (READS.has(route) && req.method === 'GET') {
      const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!tokenMatches(given, adminToken)) {
        return send(res, 401, {
          error: 'unauthorized',
          hint: adminToken ? 'Authorization: Bearer <token>' : 'SCANINBOX_ADMIN_TOKEN nav uzstādīts',
        });
      }

      const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 5000);

      if (route === '/api/leads') {
        return send(res, 200, { count: store.q.count.get().n, leads: store.q.list.all(limit) });
      }
      if (route === '/api/leads.csv') {
        return send(res, 200, csv(store.q.list.all(limit)), {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="scaninbox-leads.csv"',
        });
      }
      return send(res, 200, {
        total: store.q.count.get().n,
        price_demand: store.q.priceDemand.all(),
        segment_demand: store.q.segmentDemand.all(),
        brand_demand: store.q.brandDemand.all(),
        device_models: store.q.models.all(),
      });
    }

    if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
    return serveStatic(res, route);
  });

  return {
    server,
    store,
    listen: (port, host = '127.0.0.1') => new Promise((r) => server.listen(port, host, r)),
    port: () => server.address() && server.address().port,
    close: () => new Promise((resolve) => {
      server.close(() => { store.close(); resolve(); });
    }),
  };
}

module.exports = { createApp, openStore, validate, clean, pickCode, pickCodes, csv, saveLead, LIMITS, LANGS };

// ------------------------------------------------------------------- CLI ---

if (require.main === module) {
  const argOf = (flag) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : undefined;
  };

  const port = Number(argOf('--port')) || Number(process.env.PORT) || 8123;
  const app = createApp({
    dbPath: process.env.SCANINBOX_DB || path.join(ROOT, 'data', 'scaninbox.db'),
    adminToken: process.env.SCANINBOX_ADMIN_TOKEN || '',
    allowOrigin: process.env.SCANINBOX_ALLOW_ORIGIN || '',
  });

  app.listen(port).then(() => {
    console.log(`ScanInbox  http://localhost:${port}`);
    console.log(`Datubāze   ${app.store.path}  (${app.store.q.count.get().n} pieteikumi)`);
    console.log(process.env.SCANINBOX_ADMIN_TOKEN
      ? 'Lasīšana   ieslēgta ar SCANINBOX_ADMIN_TOKEN'
      : 'Lasīšana   slēgta — uzstādi SCANINBOX_ADMIN_TOKEN, lai lasītu caur API');
    console.log('Ctrl+C, lai apturētu');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => { app.close().then(() => process.exit(0)); });
  }
}
