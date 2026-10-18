'use strict';

/**
 * Validates data/native/<lang>.json and writes one Google Ads Editor CSV per
 * language (same 21-column layout as the Ireland and Latvia CSVs) plus
 * data/campaign-settings.json with the campaign-level settings the CSV cannot
 * carry (country, languages, budget, dates).
 *
 *   node tools/google-ads/build_native_campaigns.js
 *
 * English keywords are shared: the 154 rows of the Ireland CSV, Exact match,
 * in their original ad groups. Native-language keywords are Phrase match.
 * No dependencies, nothing is sent anywhere.
 */

const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const NATIVE = path.join(HERE, 'data', 'native');
const OUT = path.join(HERE, 'campaigns');
const ENG_CSV = path.join(HERE, 'ScanInbox-ENG-154-Keywords-and-Ads.csv');

const MAX_CPC = '0.25';
const BUDGET_EUR = 50;
const START = '2026-10-19';
const END = '2026-11-18';
const LANGS = ['it', 'fr', 'de', 'bg', 'cs', 'da', 'el', 'es', 'fi', 'hr', 'hu',
               'lt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv'];
const GROUPS = ['Printer SMTP', 'Scan-to-Email Setup', 'Microsoft 365 Alternative'];
const LANGUAGE_ID = { it: 1004, fr: 1002, de: 1001, bg: 1020, cs: 1021, da: 1009,
  el: 1022, es: 1003, fi: 1011, hr: 1039, hu: 1024, lt: 1026, nl: 1010, pl: 1030,
  pt: 1014, ro: 1032, sk: 1033, sl: 1034, sv: 1015 };
const BANNED = /\b(not working|doesn'?t work|stopped working|error|fix|repair|troubleshoot\w*|helpline)\b/i;

const HEADER = ['Campaign', 'Ad Group', 'Keyword', 'Match type', 'Max CPC', 'Status',
  'Campaign status', 'Ad group status', 'Final URL', 'Headline 1', 'Headline 2',
  'Headline 3', 'Headline 4', 'Headline 5', 'Headline 6', 'Description 1',
  'Description 2', 'Description 3', 'Path 1', 'Path 2', 'Headline 1 position'];

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const [eh, ...eng] = parseCsv(fs.readFileSync(ENG_CSV, 'utf8'));
const col = (n) => eh.indexOf(n);
const englishKeywords = eng
  .filter((r) => r[col('Keyword')])
  .map((r) => ({ group: r[col('Ad Group')], keyword: r[col('Keyword')] }));
if (englishKeywords.length !== 154) throw new Error(`expected 154 English keywords, got ${englishKeywords.length}`);

const problems = [];
const settings = [];
fs.mkdirSync(OUT, { recursive: true });

for (const lang of LANGS) {
  const file = path.join(NATIVE, `${lang}.json`);
  if (!fs.existsSync(file)) { problems.push(`${lang}: missing ${path.relative(HERE, file)}`); continue; }
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bad = (m) => problems.push(`${lang}: ${m}`);

  if (d.lang !== lang) bad(`lang field is "${d.lang}"`);
  if (d.final_url !== `https://scaninbox.me/${lang}/`) bad(`final_url ${d.final_url}`);
  const expectedName = `ScanInbox | ${lang.toUpperCase()} | ${d.country} | Desktop | EUR${BUDGET_EUR}`;
  if (d.campaign_name !== expectedName) bad(`campaign_name "${d.campaign_name}" != "${expectedName}"`);
  if (!Number.isInteger(d.geo_id)) bad('geo_id missing');
  if (JSON.stringify((d.ad_groups || []).map((g) => g.name)) !== JSON.stringify(GROUPS)) bad('ad group names/order');

  const seen = new Set(englishKeywords.map((k) => k.keyword.toLowerCase()));
  const rows = [];
  const base = (extra) => HEADER.map((h) => extra[h] ?? '');

  for (const k of englishKeywords) {
    rows.push(base({ Campaign: d.campaign_name, 'Ad Group': k.group, Keyword: k.keyword,
      'Match type': 'Exact', 'Max CPC': MAX_CPC, Status: 'Enabled',
      'Campaign status': 'Paused', 'Ad group status': 'Enabled' }));
  }

  let nativeCount = 0;
  for (const g of d.ad_groups || []) {
    const kws = g.native_keywords || [];
    if (kws.length < 12 || kws.length > 16) bad(`${g.name}: ${kws.length} native keywords`);
    for (const kw of kws) {
      const key = kw.toLowerCase();
      if (seen.has(key)) bad(`${g.name}: duplicate keyword "${kw}"`);
      seen.add(key);
      if (kw !== kw.trim() || /\s{2}/.test(kw)) bad(`keyword whitespace "${kw}"`);
      if (BANNED.test(kw)) bad(`support-intent keyword "${kw}"`);
      rows.push(base({ Campaign: d.campaign_name, 'Ad Group': g.name, Keyword: kw,
        'Match type': 'Phrase', 'Max CPC': MAX_CPC, Status: 'Enabled',
        'Campaign status': 'Paused', 'Ad group status': 'Enabled' }));
      nativeCount++;
    }
    const ad = g.ad || {};
    const hs = ad.headlines || [], ds = ad.descriptions || [];
    if (hs.length !== 6) bad(`${g.name}: ${hs.length} headlines`);
    if (ds.length !== 3) bad(`${g.name}: ${ds.length} descriptions`);
    if (new Set(hs).size !== hs.length) bad(`${g.name}: duplicate headlines`);
    hs.forEach((h) => { if ([...h].length > 30) bad(`${g.name}: headline >30 "${h}"`); if (/!|\s$|^\s|\s{2}/.test(h)) bad(`${g.name}: headline format "${h}"`); });
    ds.forEach((x) => { if ([...x].length > 90) bad(`${g.name}: description >90 "${x}"`); if (/\s$|^\s|\s{2}/.test(x)) bad(`${g.name}: description format "${x}"`); });
    if (!/ScanInbox/.test(hs.join(' ') + ds.join(' '))) bad(`${g.name}: ad never names ScanInbox`);
    rows.push(base({ Campaign: d.campaign_name, 'Ad Group': g.name, Status: 'Enabled',
      'Campaign status': 'Paused', 'Ad group status': 'Enabled', 'Final URL': d.final_url,
      'Headline 1': hs[0], 'Headline 2': hs[1], 'Headline 3': hs[2], 'Headline 4': hs[3],
      'Headline 5': hs[4], 'Headline 6': hs[5], 'Description 1': ds[0],
      'Description 2': ds[1], 'Description 3': ds[2] }));
  }

  const name = `ScanInbox-${lang.toUpperCase()}-${englishKeywords.length + nativeCount}-Keywords-and-Ads.csv`;
  const csv = '﻿' + [HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(`ScanInbox-${lang.toUpperCase()}-`)) fs.rmSync(path.join(OUT, f));
  fs.writeFileSync(path.join(OUT, name), csv, 'utf8');

  settings.push({
    lang, campaign_name: d.campaign_name, country: d.country, geo_id: d.geo_id,
    language_ids: [LANGUAGE_ID[lang], 1000], final_url: d.final_url,
    english_keywords_exact: englishKeywords.length, native_keywords_phrase: nativeCount,
    total_budget_eur: BUDGET_EUR, max_cpc_eur: Number(MAX_CPC), start: START, end: END, csv: `campaigns/${name}`,
  });
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem(s) - settings file not written`);
  process.exit(1);
}
fs.writeFileSync(path.join(HERE, 'data', 'campaign-settings.json'), JSON.stringify(settings, null, 2) + '\n');
console.log(`OK: ${settings.length} campaigns, ${settings.reduce((n, s) => n + s.native_keywords_phrase, 0)} native keywords, CSVs in tools/google-ads/campaigns/`);
