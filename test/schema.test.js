'use strict';

/**
 * Schema tests. The database has to protect the data even if something later
 * writes to it bypassing server.js — a migration script or a manual fix, say.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { freshStore, insertLead } = require('./helpers.js');

let ctx;
let store;

beforeEach(() => { ctx = freshStore(); store = ctx.store; });
afterEach(() => ctx.cleanup());

const all = (sql, ...args) => store.db.prepare(sql).all(...args);
const one = (sql, ...args) => store.db.prepare(sql).get(...args);

describe('lookup tables', () => {
  test('segment codes match what the form sends', () => {
    const found = all('SELECT code FROM segments ORDER BY sort').map((r) => r.code);
    assert.deepEqual(found, ['private', 'small', 'medium', 'large']);
  });

  test('device band codes match', () => {
    const found = all('SELECT code FROM device_bands ORDER BY sort').map((r) => r.code);
    assert.deepEqual(found, ['1', '2-5', '6-20', '20+']);
  });

  test('price band codes match', () => {
    const found = all('SELECT code FROM price_bands ORDER BY sort').map((r) => r.code);
    assert.deepEqual(found, ['lt2', '2-5', '5-10', '10+', 'unsure']);
  });

  test('every label has both languages', () => {
    for (const t of ['segments', 'device_bands', 'price_bands']) {
      const gaps = one(
        `SELECT COUNT(*) AS n FROM ${t} WHERE label_lv IS NULL OR label_lv = '' OR label_en IS NULL OR label_en = ''`);
      assert.equal(gaps.n, 0, `${t} is missing a label`);
    }
  });

  test('price bands have a midpoint, except "cannot say yet"', () => {
    const missing = all('SELECT code FROM price_bands WHERE eur_midpoint IS NULL').map((r) => r.code);
    assert.deepEqual(missing, ['unsure'], 'the ARPU calculation relies on midpoints');
  });

  test('re-running the schema does not duplicate seed data', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    store.db.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
    assert.equal(one('SELECT COUNT(*) AS n FROM segments').n, 4);
  });
});

describe('leads constraints', () => {
  test('consent is required — a row without it is impossible', () => {
    assert.throws(() => insertLead(store, { consent: 0 }), /CHECK|constraint/i);
  });

  test('one e-mail, one row', () => {
    insertLead(store, { email: 'a@inbox.lv', email_norm: 'a@inbox.lv' });
    assert.throws(
      () => insertLead(store, { email: 'A@Inbox.LV', email_norm: 'a@inbox.lv' }),
      /UNIQUE|constraint/i,
    );
  });

  test('language is only one of the page\'s languages', () => {
    assert.throws(() => insertLead(store, { lang: 'ru' }), /CHECK|constraint/i);
  });

  test('wants_beta is 0 or 1', () => {
    assert.throws(() => insertLead(store, { wants_beta: 2 }), /CHECK|constraint/i);
  });

  test('an unknown segment code is not accepted', () => {
    assert.throws(() => insertLead(store, { segment: 'not-a-segment' }), /FOREIGN KEY|constraint/i);
  });

  test('an unknown price band is not accepted', () => {
    assert.throws(() => insertLead(store, { price_band: '100+' }), /FOREIGN KEY|constraint/i);
  });

  test('timestamps are set in ISO-8601 UTC format', () => {
    insertLead(store);
    const r = one('SELECT created_at, updated_at FROM leads');
    assert.match(r.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(r.updated_at, r.created_at);
  });
});

describe('privacy', () => {
  test('the leads table has no ip or user-agent column', () => {
    const cols = all('PRAGMA table_info(leads)').map((c) => c.name.toLowerCase());
    for (const forbidden of ['ip', 'ip_address', 'remote_addr', 'user_agent', 'useragent', 'referrer']) {
      assert.equal(cols.includes(forbidden), false,
        `the page promises to store only the e-mail and the answers, so ${forbidden} must not be in the schema`);
    }
  });

  test('lead_events has no technical identifier columns either', () => {
    const cols = all('PRAGMA table_info(lead_events)').map((c) => c.name.toLowerCase());
    assert.deepEqual(cols, ['id', 'lead_id', 'kind', 'payload', 'created_at']);
  });
});

describe('lead_events', () => {
  test('accepts only known event kinds', () => {
    const res = insertLead(store);
    const id = Number(res.lastInsertRowid);
    store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)')
      .run(id, 'created', '{}');
    assert.throws(
      () => store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)')
        .run(id, 'deleted', '{}'),
      /CHECK|constraint/i,
    );
  });

  test('deleting a sign-up takes its history with it', () => {
    const id = Number(insertLead(store).lastInsertRowid);
    store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)').run(id, 'created', '{}');
    store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)').run(id, 'updated', '{}');
    assert.equal(one('SELECT COUNT(*) AS n FROM lead_events').n, 2);

    store.db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    assert.equal(one('SELECT COUNT(*) AS n FROM lead_events').n, 0, 'the cascade did not fire');
  });

  test('cannot log an event for a sign-up that does not exist', () => {
    assert.throws(
      () => store.db.prepare('INSERT INTO lead_events (lead_id, kind, payload) VALUES (?, ?, ?)')
        .run(9999, 'created', '{}'),
      /FOREIGN KEY|constraint/i,
    );
  });
});

describe('views', () => {
  test('v_leads adds Latvian labels', () => {
    insertLead(store, { segment: 'medium', device_band: '6-20', price_band: '10+' });
    const r = one('SELECT * FROM v_leads');
    assert.equal(r.segment_lv, 'Uzņēmums, 10 līdz 100 cilvēku');
    assert.equal(r.device_band_lv, '6–20');
    assert.equal(r.price_band_lv, 'Vairāk par 10 €');
    assert.equal(r.eur_midpoint, 12);
  });

  test('v_leads does not expose the internal dedup key', () => {
    const cols = all('PRAGMA table_info(v_leads)').map((c) => c.name);
    assert.equal(cols.includes('email_norm'), false);
    assert.equal(cols.includes('consent'), false);
  });

  test('v_price_demand counts and calculates percentages', () => {
    insertLead(store, { email: 'a@x.lv', email_norm: 'a@x.lv', price_band: '5-10' });
    insertLead(store, { email: 'b@x.lv', email_norm: 'b@x.lv', price_band: '5-10' });
    insertLead(store, { email: 'c@x.lv', email_norm: 'c@x.lv', price_band: 'lt2' });
    insertLead(store, { email: 'd@x.lv', email_norm: 'd@x.lv', price_band: null });

    const rows = all('SELECT * FROM v_price_demand');
    const by = Object.fromEntries(rows.map((r) => [r.code, r]));
    assert.equal(by['5-10'].leads, 2);
    assert.equal(by['lt2'].leads, 1);
    assert.equal(by['2-5'].leads, 0, 'empty bands stay visible');
    /* Percentages are calculated from those who answered, not from every sign-up. */
    assert.equal(by['5-10'].pct, 66.7);
    assert.equal(by['lt2'].pct, 33.3);
  });

  test('v_price_demand does not divide by zero when nobody has answered', () => {
    insertLead(store, { price_band: null });
    const rows = all('SELECT * FROM v_price_demand');
    assert.equal(rows.length, 5);
    for (const r of rows) assert.equal(r.pct, null);
  });

  test('v_segment_demand sums devices conservatively', () => {
    insertLead(store, { email: 'a@x.lv', email_norm: 'a@x.lv', segment: 'small', device_band: '2-5' });
    insertLead(store, { email: 'b@x.lv', email_norm: 'b@x.lv', segment: 'small', device_band: '20+', wants_beta: 1 });
    const r = one("SELECT * FROM v_segment_demand WHERE code = 'small'");
    assert.equal(r.leads, 2);
    assert.equal(r.beta_volunteers, 1);
    assert.equal(r.min_devices, 22, 'band lower bounds: 2 + 20');
  });

  test('v_device_models groups independently of case and spacing', () => {
    insertLead(store, { email: 'a@x.lv', email_norm: 'a@x.lv', device_model: 'Canon MF445dw' });
    insertLead(store, { email: 'b@x.lv', email_norm: 'b@x.lv', device_model: 'canon mf445dw' });
    insertLead(store, { email: 'c@x.lv', email_norm: 'c@x.lv', device_model: 'Ricoh IM C3000' });
    insertLead(store, { email: 'd@x.lv', email_norm: 'd@x.lv', device_model: null });

    const rows = all('SELECT * FROM v_device_models');
    assert.equal(rows.length, 2, 'the same model in a different case is not two models');
    assert.equal(rows[0].mentions, 2);
    assert.match(rows[0].model, /canon mf445dw/i);
  });
});

/* Translations aren't code, but they break just as quietly: a missing key
   shows up as a Latvian sentence on the German page, and different markup
   shows up as a broken layout. The tool knows this; this test just wires it
   into `node --test`. */
describe('translations', () => {
  test('every language has the same keys and the same markup', () => {
    const { execFileSync } = require('node:child_process');
    const tool = require('node:path').join(__dirname, '..', 'tools', 'i18n.js');
    let out = '';
    try {
      out = execFileSync(process.execPath, [tool, 'check'], { encoding: 'utf8' });
    } catch (err) {
      assert.fail('tools/i18n.js check:\n' + (err.stderr || err.stdout || err.message));
    }
    assert.match(out, /Everything matches/);
  });
});
