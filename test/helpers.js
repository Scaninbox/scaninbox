'use strict';

/** Shared test helpers. Each test runs against its own temporary database. */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore, createApp } = require('../server.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scaninbox-test-'));
}

function removeDir(dir) {
  /* Windows sometimes still holds the WAL files for a moment; not worth
     failing test cleanup over. */
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/** An empty database with the schema applied. */
function freshStore() {
  const dir = tempDir();
  const store = openStore(path.join(dir, 'test.db'));
  return {
    store,
    cleanup() { store.close(); removeDir(dir); },
  };
}

/** A running app on a free port, with fetch shortcuts. */
async function startApp(options = {}) {
  const dir = tempDir();
  const app = createApp({ dbPath: path.join(dir, 'test.db'), quiet: true, ...options });
  await app.listen(0);
  const base = `http://127.0.0.1:${app.port()}`;

  return {
    app,
    base,
    store: app.store,
    get: (route, headers) => fetch(base + route, { headers }),
    post: (route, body, headers) => fetch(base + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    request: (route, init) => fetch(base + route, init),
    async stop() { await app.close(); removeDir(dir); },
  };
}

/** A valid sign-up, with fields that can be overridden. */
function validLead(overrides = {}) {
  return {
    email: 'anna.berzina@inbox.lv',
    name: 'Anna Bērziņa',
    segment: 'small',
    devices: '2-5',
    model: 'Canon MF445dw',
    priceBand: '5-10',
    wantsBeta: true,
    consent: true,
    lang: 'lv',
    ...overrides,
  };
}

/** Writes a row straight into the database, bypassing the API — for schema tests. */
function insertLead(store, overrides = {}) {
  const row = {
    email: 'x@inbox.lv',
    email_norm: 'x@inbox.lv',
    name: null,
    segment: null,
    device_band: null,
    device_model: null,
    price_band: null,
    wants_beta: 0,
    consent: 1,
    lang: 'lv',
    ...overrides,
  };
  return store.db.prepare(`
    INSERT INTO leads (email, email_norm, name, segment, device_band, device_model,
                       price_band, wants_beta, consent, lang)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    row.email, row.email_norm, row.name, row.segment, row.device_band,
    row.device_model, row.price_band, row.wants_beta, row.consent, row.lang);
}

module.exports = { freshStore, startApp, validLead, insertLead, tempDir, removeDir };
