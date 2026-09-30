'use strict';

/**
 * ScanInbox — the static page + a sign-up API backed by SQLite.
 *
 *   node server.js
 *   node server.js --port 9000
 *
 * Zero npm dependencies: SQLite comes from Node's built-in `node:sqlite`
 * (Node 22.5+).
 *
 * The module exports `createApp()`, and the server only starts if this file
 * is invoked directly. That way tests can build their own instance with
 * their own database, without touching the real one.
 *
 * Environment variables:
 *   SCANINBOX_DB            the database file (default ./data/scaninbox.db)
 *   SCANINBOX_ADMIN_TOKEN   required to read sign-ups through the API.
 *                           If unset, the read endpoints are locked.
 *   SCANINBOX_ALLOW_ORIGIN  CORS origin, if the page is hosted separately
 *   PORT                    the port
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const SCHEMA_PATH = path.join(ROOT, 'db', 'schema.sql');

const LIMITS = {
  body: 8 * 1024,             // a sign-up is never bigger than this
  email: 254,                 // RFC 5321's longest address
  name: 120,
  model: 120,
  brands: 12,                 // that's how many brands the form even has
  /* An office signs up from one public IP address, and one sign-up is two
     requests (the sign-up, then the follow-up questions). Six would have
     meant three colleagues in ten minutes; writing is cheap, a rejected
     lead is not. */
  rateMax: 30,
  rateWindowMs: 10 * 60 * 1000,
};

/* Paths that are never served, even if someone requests them directly. */
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

/* Languages the page exists in. These match the schema's CHECK constraint,
   so an unknown code is better mapped to 'lv' than left to fail the write. */
const LANGS = new Set(['lv', 'en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el', 'es',
  'fi', 'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv']);

// ----------------------------------------------------------------- store ---

/**
 * Opens the database, applies the schema, and prepares queries.
 * The schema is idempotent, so it can run on every start.
 */
function openStore(dbPath) {
  const full = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });

  const db = new DatabaseSync(full);
  db.exec('PRAGMA journal_mode = WAL');   // readers don't block the writer
  db.exec('PRAGMA foreign_keys = ON');    // has to be turned on per connection
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  /* Valid code values come from the database, not from a second copy on the
     JS side. */
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

// -------------------------------------------------------------- validate ---

/** Trims and caps length. An empty string becomes null. */
function clean(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Silently drops an unknown code — null is better than noise in the database. */
function pickCode(value, allowed) {
  const v = clean(value, 40);
  return v && allowed.has(v) ? v : null;
}

/**
 * Multi-select codes. Distinguishes "the field wasn't there" (null) from
 * "nothing is ticked" (an empty array) — the first leaves what's already
 * saved untouched, the second clears it.
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
 * Validates a submission. Returns `{lead}` or `{error, field}`.
 * A pure function — nothing gets written.
 */
function validate(body, codes) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'invalid_body' };
  }

  /* The address isn't truncated to length: a cut-off e-mail is a different
     address, not a shorter version of the same one, so an over-long
     submission is rejected instead. */
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

// ----------------------------------------------------------------- write ---

/**
 * One row per e-mail: a repeat sign-up updates the answers.
 * The submitted JSON always lands in lead_events, so no old answer is lost.
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

    /* null means "the field wasn't there" — it leaves already-marked brands
       untouched. An array, even an empty one, replaces the set entirely. */
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

// ---------------------------------------------------------- rate limiter ---

/**
 * The IP lives only in memory and only for this purpose — it never reaches
 * the database. One instance per app, so tests don't share state.
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
 * Reads the body with a size cap. An overflow is rejected, but the
 * connection isn't killed — otherwise the client would see a reset rather
 * than a 413. The remaining data is simply ignored, and the response closes
 * the connection.
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

/** Compares without a timing leak, so the token can't be guessed byte by byte. */
function tokenMatches(given, expected) {
  if (!expected) return false;
  const a = Buffer.from(given || '');
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ------------------------------------------------------------------- app ---

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
      return send(res, 400, { error: 'bad_path' });   // broken percent-encoding
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

    /* The health check reveals nothing: the sign-up count is both a
       competitive metric and a way to prove the "first 10" are already
       taken while the page still promises them. The count is shown by
       /api/stats, behind the token. */
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

    /* Reads are locked until a token is set. */
    if (READS.has(route) && req.method === 'GET') {
      const given = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!tokenMatches(given, adminToken)) {
        return send(res, 401, {
          error: 'unauthorized',
          hint: adminToken ? 'Authorization: Bearer <token>' : 'SCANINBOX_ADMIN_TOKEN is not set',
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

// -------------------------------------------------------------------- CLI ---

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
    console.log(`Database   ${app.store.path}  (${app.store.q.count.get().n} sign-ups)`);
    console.log(process.env.SCANINBOX_ADMIN_TOKEN
      ? 'Reads      enabled with SCANINBOX_ADMIN_TOKEN'
      : 'Reads      locked — set SCANINBOX_ADMIN_TOKEN to read through the API');
    console.log('Ctrl+C to stop');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => { app.close().then(() => process.exit(0)); });
  }
}
