'use strict';

/**
 * Shēmas testi. Datubāzei jāaizsargā datus arī tad, ja kāds vēlāk raksta tajā
 * apejot server.js — piemēram, no migrācijas skripta vai roku labojuma.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { freshStore, insertLead } = require('./helpers.js');

let ctx;
let store;

beforeEach(() => { ctx = freshStore(); store = ctx.store; });
afterEach(() => ctx.cleanup());

const all = (sql, ...args) => store.db.prepare(sql).all(...args);
const one = (sql, ...args) => store.db.prepare(sql).get(...args);

describe('uzmeklēšanas tabulas', () => {
  test('segmentu kodi sakrīt ar tiem, ko sūta forma', () => {
    const found = all('SELECT code FROM segments ORDER BY sort').map((r) => r.code);
    assert.deepEqual(found, ['private', 'small', 'medium', 'large']);
  });

  test('ierīču joslu kodi sakrīt', () => {
    const found = all('SELECT code FROM device_bands ORDER BY sort').map((r) => r.code);
    assert.deepEqual(found, ['1', '2-5', '6-20', '20+']);
  });

  test('cenu joslu kodi sakrīt', () => {
    const found = all('SELECT code FROM price_bands ORDER BY sort').map((r) => r.code);
    assert.deepEqual(found, ['lt2', '2-5', '5-10', '10+', 'unsure']);
  });

  test('katrai etiķetei ir abas valodas', () => {
    for (const t of ['segments', 'device_bands', 'price_bands']) {
      const gaps = one(
        `SELECT COUNT(*) AS n FROM ${t} WHERE label_lv IS NULL OR label_lv = '' OR label_en IS NULL OR label_en = ''`);
      assert.equal(gaps.n, 0, `${t} iztrūkst etiķete`);
    }
  });

  test('cenu joslām ir viduspunkts, izņemot "vēl nevaru pateikt"', () => {
    const missing = all('SELECT code FROM price_bands WHERE eur_midpoint IS NULL').map((r) => r.code);
    assert.deepEqual(missing, ['unsure'], 'ARPU rēķins balstās uz viduspunktiem');
  });

  test('shēmas atkārtota izpilde nedublē sēklas datus', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    store.db.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
    assert.equal(one('SELECT COUNT(*) AS n FROM segments').n, 4);
  });
});

describe('leads ierobežojumi', () => {
  test('piekrišana ir obligāta — rinda bez tās nav iespējama', () => {
    assert.throws(() => insertLead(store, { consent: 0 }), /CHECK|constraint/i);
  });

  test('viens e-pasts, viena rinda', () => {
    insertLead(store, { email: 'a@inbox.lv', email_norm: 'a@inbox.lv' });
    assert.throws(
      () => insertLead(store, { email: 'A@Inbox.LV', email_norm: 'a@inbox.lv' }),
      /UNIQUE|constraint/i,
    );
  });

  test('valoda ir tikai kāda no lapas valodām', () => {
    assert.throws(() => insertLead(store, { lang: 'ru' }), /CHECK|constraint/i);
  });

  test('wants_beta ir 0 vai 1', () => {
    assert.throws(() => insertLead(store, { wants_beta: 2 }), /CHECK|constraint/i);
  });

  test('nezināms segmenta kods netiek pieņemts', () => {
    assert.throws(() => insertLead(store, { segment: 'nav-taada' }), /FOREIGN KEY|constraint/i);
  });

  test('nezināma cenu josla netiek pieņemta', () => {
    assert.throws(() => insertLead(store, { price_band: '100+' }), /FOREIGN KEY|constraint/i);
  });

  test('laika zīmogi tiek uzlikti ISO-8601 UTC formātā', () => {
    insertLead(store);
    const r = one('SELECT created_at, updated_at FROM leads');
    assert.match(r.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(r.updated_at, r.created_at);
  });
});

describe('privātums', () => {
  test('leads tabulā nav IP un nav user-agent kolonnas', () => {
    const cols = all('PRAGMA table_info(leads)').map((c) => c.name.toLowerCase());
    for (const forbidden of ['ip', 'ip_address', 'remote_addr', 'user_agent', 'useragent', 'referrer']) {
      assert.equal(cols.includes(forbidden), false,
        `lapa apsola glabāt tikai e-pastu un atbildes, tāpēc ${forbidden} nedrīkst būt shēmā`);
    }
  });

  /* Supabase shēmu te nevar izpildīt (tas ir Postgres), tāpēc pārbaudām tekstu:
     neviena kolonna ne leads, ne lead_events tabulā nedrīkst glabāt IP vai
     pārlūka datus. */
  test('arī db/supabase.sql nav IP un user-agent kolonnu', () => {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'supabase.sql'), 'utf8')
      .replace(/--.*$/gm, '');
    for (const table of ['leads', 'lead_events']) {
      const m = sql.match(new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`));
      assert.ok(m, `${table} tabula atrasta db/supabase.sql`);
      const cols = m[1].split('\n').map((l) => l.trim().split(/\s+/)[0].toLowerCase()).filter(Boolean);
      for (const forbidden of ['ip', 'ip_address', 'remote_addr', 'user_agent', 'useragent', 'referrer']) {
        assert.equal(cols.includes(forbidden), false, `${table}.${forbidden} nedrīkst būt shēmā`);
      }
    }
  });

  test('arī lead_events nav tehnisko identifikatoru kolonnu', () => {
    const cols = all('PRAGMA table_info(lead_events)').map((c) => c.name.toLowerCase());
    assert.deepEqual(cols, ['id', 'lead_id', 'kind', 'payload', 'created_at']);
  });
});

describe('lead_events', () => {
  test('pieņem tikai zināmus notikumu veidus', () => {
    const res = insertLead(store);
    const id = Number(res.lastInsertRowid);
    store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)')
      .run(id, 'created', '{}');
    assert.throws(
      () => store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)')
        .run(id, 'izdzests', '{}'),
      /CHECK|constraint/i,
    );
  });

  test('dzēšot pieteikumu, tā vēsture aiziet līdzi', () => {
    const id = Number(insertLead(store).lastInsertRowid);
    store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)').run(id, 'created', '{}');
    store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)').run(id, 'updated', '{}');
    assert.equal(one('SELECT COUNT(*) AS n FROM lead_events').n, 2);

    store.db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    assert.equal(one('SELECT COUNT(*) AS n FROM lead_events').n, 0, 'kaskāde nav nostrādājusi');
  });

  test('nav iespējams pierakstīt notikumu neesošam pieteikumam', () => {
    assert.throws(
      () => store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)')
        .run(9999, 'created', '{}'),
      /FOREIGN KEY|constraint/i,
    );
  });
});

describe('skati', () => {
  test('v_leads pievieno latviešu etiķetes', () => {
    insertLead(store, { segment: 'medium', device_band: '6-20', price_band: '10+' });
    const r = one('SELECT * FROM v_leads');
    assert.equal(r.segment_lv, 'Uzņēmums, 10 līdz 100 cilvēku');
    assert.equal(r.device_band_lv, '6–20');
    assert.equal(r.price_band_lv, 'Vairāk par 10 €');
    assert.equal(r.eur_midpoint, 12);
  });

  test('v_leads neatklāj iekšējo dublikātu atslēgu', () => {
    const cols = all('PRAGMA table_info(v_leads)').map((c) => c.name);
    assert.equal(cols.includes('email_norm'), false);
    assert.equal(cols.includes('consent'), false);
  });

  test('v_price_demand skaita un rēķina procentus', () => {
    insertLead(store, { email: 'a@x.lv', email_norm: 'a@x.lv', price_band: '5-10' });
    insertLead(store, { email: 'b@x.lv', email_norm: 'b@x.lv', price_band: '5-10' });
    insertLead(store, { email: 'c@x.lv', email_norm: 'c@x.lv', price_band: 'lt2' });
    insertLead(store, { email: 'd@x.lv', email_norm: 'd@x.lv', price_band: null });

    const rows = all('SELECT * FROM v_price_demand');
    const by = Object.fromEntries(rows.map((r) => [r.code, r]));
    assert.equal(by['5-10'].leads, 2);
    assert.equal(by['lt2'].leads, 1);
    assert.equal(by['2-5'].leads, 0, 'tukšās joslas paliek redzamas');
    /* Procentus rēķina no atbildējušajiem, ne no visiem pieteikumiem. */
    assert.equal(by['5-10'].pct, 66.7);
    assert.equal(by['lt2'].pct, 33.3);
  });

  test('v_price_demand nedalās ar nulli, kad neviens nav atbildējis', () => {
    insertLead(store, { price_band: null });
    const rows = all('SELECT * FROM v_price_demand');
    assert.equal(rows.length, 5);
    for (const r of rows) assert.equal(r.pct, null);
  });

  test('v_segment_demand summē ierīces konservatīvi', () => {
    insertLead(store, { email: 'a@x.lv', email_norm: 'a@x.lv', segment: 'small', device_band: '2-5' });
    insertLead(store, { email: 'b@x.lv', email_norm: 'b@x.lv', segment: 'small', device_band: '20+', wants_beta: 1 });
    const r = one("SELECT * FROM v_segment_demand WHERE code = 'small'");
    assert.equal(r.leads, 2);
    assert.equal(r.beta_volunteers, 1);
    assert.equal(r.min_devices, 22, 'joslu apakšējās robežas: 2 + 20');
  });

  test('v_device_models grupē neatkarīgi no reģistra un atstarpēm', () => {
    insertLead(store, { email: 'a@x.lv', email_norm: 'a@x.lv', device_model: 'Canon MF445dw' });
    insertLead(store, { email: 'b@x.lv', email_norm: 'b@x.lv', device_model: 'canon mf445dw' });
    insertLead(store, { email: 'c@x.lv', email_norm: 'c@x.lv', device_model: 'Ricoh IM C3000' });
    insertLead(store, { email: 'd@x.lv', email_norm: 'd@x.lv', device_model: null });

    const rows = all('SELECT * FROM v_device_models');
    assert.equal(rows.length, 2, 'tas pats modelis citā reģistrā nav divi modeļi');
    assert.equal(rows[0].mentions, 2);
    assert.match(rows[0].model, /canon mf445dw/i);
  });
});

/* Tulkojumi nav kods, bet tie lūst tikpat klusi: iztrūkstoša atslēga parādās
   kā latviešu teikums vācu lapā, un cits marķējums — kā salauzts izkārtojums.
   Rīks to zina; šis tests to tikai piesien pie `node --test`. */
describe('tulkojumi', () => {
  test('visās valodās ir tās pašas atslēgas un tas pats marķējums', () => {
    const { execFileSync } = require('node:child_process');
    const tool = require('node:path').join(__dirname, '..', 'tools', 'i18n.js');
    let out = '';
    try {
      out = execFileSync(process.execPath, [tool, 'check'], { encoding: 'utf8' });
    } catch (err) {
      assert.fail('tools/i18n.js check:\n' + (err.stderr || err.stdout || err.message));
    }
    assert.match(out, /Viss sakrīt/);
  });
});
