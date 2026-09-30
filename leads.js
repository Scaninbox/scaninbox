'use strict';

/**
 * ScanInbox — a sign-up report in the terminal. Reads the database directly,
 * so the server doesn't need to be running and no token is needed.
 *
 *   node leads.js            → summary: languages, segments, brands, devices
 *   node leads.js --list     → every sign-up
 *   node leads.js --csv      → CSV to stdout (redirect to a file)
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.SCANINBOX_DB || path.join(__dirname, 'data', 'scaninbox.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`);
  console.error('Run the server at least once: node server.js');
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const total = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;

/** A simple text table, aligned to the widest value in each column. */
function table(rows, cols) {
  if (!rows.length) return '  (no data)';
  const head = cols.map((c) => c.title);
  const body = rows.map((r) => cols.map((c) => (c.get(r) ?? '').toString()));
  const width = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells) => '  ' + cells.map((c, i) => (cols[i].right ? c.padStart(width[i]) : c.padEnd(width[i]))).join('  ');
  return [line(head), '  ' + width.map((w) => '-'.repeat(w)).join('  '), ...body.map(line)].join('\n');
}

if (process.argv.includes('--csv')) {
  const rows = db.prepare('SELECT * FROM v_leads ORDER BY created_at').all();
  if (rows.length) {
    const cols = Object.keys(rows[0]);
    const cell = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    console.log(cols.join(','));
    for (const r of rows) console.log(cols.map((c) => cell(r[c])).join(','));
  }
  db.close();
  process.exit(0);
}

console.log(`\nScanInbox — ${total} sign-ups   (${DB_PATH})`);

if (total === 0) {
  console.log('\nNobody has signed up yet.\n');
  db.close();
  process.exit(0);
}

if (process.argv.includes('--list')) {
  console.log('\nSIGN-UPS\n');
  console.log(table(db.prepare('SELECT * FROM v_leads ORDER BY created_at DESC').all(), [
    { title: 'DATE', get: (r) => r.created_at.slice(0, 10) },
    { title: 'E-MAIL', get: (r) => r.email },
    { title: 'NAME', get: (r) => r.name || '—' },
    { title: 'SEGMENT', get: (r) => r.segment_lv || '—' },
    { title: 'DEVICES', get: (r) => r.device_band_lv || '—', right: true },
    { title: 'BRANDS', get: (r) => r.brands || '—' },
    { title: 'MODEL', get: (r) => r.device_model || '—' },
    { title: 'LANG', get: (r) => r.lang.toUpperCase() },
  ]));
  console.log('');
  db.close();
  process.exit(0);
}

/* The page's language is the closest thing we have to a market signal: an ad
   campaign in each country links to its own language, so this table answers
   "where is demand actually coming from". */
console.log('\nLANGUAGES\n');
console.log(table(db.prepare(`
  SELECT lang, COUNT(*) AS leads,
         ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads), 1) AS pct
  FROM leads GROUP BY lang ORDER BY leads DESC`).all(), [
  { title: 'LANGUAGE', get: (r) => r.lang.toUpperCase() },
  { title: 'PEOPLE', get: (r) => r.leads, right: true },
  { title: '%', get: (r) => r.pct, right: true },
]));

console.log('\nSEGMENTS\n');
console.log(table(db.prepare('SELECT * FROM v_segment_demand').all(), [
  { title: 'SEGMENT', get: (r) => r.label_en },
  { title: 'PEOPLE', get: (r) => r.leads, right: true },
  { title: 'BETA', get: (r) => r.beta_volunteers, right: true },
  { title: 'DEVICES (MIN)', get: (r) => r.min_devices, right: true },
]));

/* Which manufacturers' menus need documenting first. One person can tick
   several brands, so the percentages are of those who answered this
   question at all. */
const answeredBrands = db.prepare('SELECT COUNT(DISTINCT lead_id) AS n FROM lead_brands').get().n;
console.log(`\nBRANDS   (${answeredBrands} responses)\n`);
console.log(table(db.prepare('SELECT * FROM v_brand_demand WHERE leads > 0').all(), [
  { title: 'BRAND', get: (r) => r.label_en },
  { title: 'PEOPLE', get: (r) => r.leads, right: true },
  { title: '%', get: (r) => (r.pct === null ? '—' : r.pct), right: true },
]));

/* The form no longer asks the price question — the table stays for older sign-ups. */
const priced = db.prepare('SELECT COUNT(*) AS n FROM leads WHERE price_band IS NOT NULL').get().n;
if (priced) {
  console.log('\nWILLINGNESS TO PAY   (older sign-ups)\n');
  console.log(table(db.prepare('SELECT * FROM v_price_demand WHERE leads > 0').all(), [
    { title: 'BAND', get: (r) => r.label_en },
    { title: 'PEOPLE', get: (r) => r.leads, right: true },
    { title: '%', get: (r) => (r.pct === null ? '—' : r.pct), right: true },
  ]));
}

const models = db.prepare('SELECT * FROM v_device_models LIMIT 12').all();
if (models.length) {
  console.log('\nDEVICES MENTIONED\n');
  console.log(table(models, [
    { title: 'MODEL', get: (r) => r.model },
    { title: 'TIMES', get: (r) => r.mentions, right: true },
  ]));
}

console.log('\n  node leads.js --list   every sign-up');
console.log('  node leads.js --csv    export\n');

db.close();
