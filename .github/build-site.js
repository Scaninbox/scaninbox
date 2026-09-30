'use strict';

/**
 * Assembles _site from one index.html: the root plus one page per language.
 *
 *   node .github/build-site.js
 *
 * Why copies rather than one file with ?lang=: each language needs its own
 * address. A search engine indexes addresses, not JavaScript state, and an
 * ad campaign should link to /de/, not to a page that guesses who you are.
 *
 * Output:
 *   _site/index.html      redirects to a language by cookie, time zone, or
 *                         browser; otherwise identical
 *   _site/<lang>/         the page itself in that language, no redirect
 *
 * Environment variables:
 *   SCANINBOX_API   the full API address. If unset, the published page runs
 *                   as a preview — the form goes through but saves nothing,
 *                   and says so.
 *   SITE_URL        the page's root, for canonical and hreflang links.
 */

const fs = require('node:fs');
const path = require('node:path');

const LANGS = ['lv', 'en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el', 'es', 'fi',
               'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv'];
const LOCALE = {
  lv: 'lv_LV', en: 'en_GB', it: 'it_IT', fr: 'fr_FR', de: 'de_DE',
  bg: 'bg_BG', cs: 'cs_CZ', da: 'da_DK', el: 'el_GR', es: 'es_ES', fi: 'fi_FI',
  hr: 'hr_HR', hu: 'hu_HU', lt: 'lt_LT', nl: 'nl_NL', pl: 'pl_PL', pt: 'pt_PT',
  ro: 'ro_RO', sk: 'sk_SK', sl: 'sl_SI', sv: 'sv_SE',
};

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_site');
const API = process.env.SCANINBOX_API || '';
const SITE = (process.env.SITE_URL || '').replace(/\/+$/, '');

const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const API_TAG = /<meta name="scaninbox:api" content="[^"]*">/;
if (!API_TAG.test(src)) throw new Error('index.html: <meta name="scaninbox:api"> not found');

/** Links to the same page in every other language, plus the canonical address. */
function alternates(lang) {
  if (!SITE) return '';
  const rows = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${SITE}/${l}/">`
  );
  rows.push(`<link rel="alternate" hreflang="x-default" href="${SITE}/">`);
  rows.push(`<link rel="canonical" href="${SITE}${lang ? '/' + lang + '/' : '/'}">`);
  return rows.join('\n') + '\n';
}

/**
 * @param {string} lang  the language, or '' for the root
 */
function build(lang) {
  let html = src.replace(API_TAG, `<meta name="scaninbox:api" content="${API}">`);

  /* This marker switches on both the root redirect and the language switcher
     navigating to a different address rather than swapping text in place.
     The local file doesn't have it, so locally none of that happens. */
  let head = '<meta name="scaninbox:langpaths" content="1">\n';
  if (lang) {
    head += `<meta name="scaninbox:lang" content="${lang}">\n`;
    head += `<meta property="og:locale" content="${LOCALE[lang]}">\n`;
  }
  head += alternates(lang);

  html = html.replace('<meta name="scaninbox:api"', head + '<meta name="scaninbox:api"');

  /* A language page already knows its own language, so <html lang> is
     correct even if JavaScript doesn't run. */
  if (lang) html = html.replace('<html lang="lv">', `<html lang="${lang}">`);

  const dir = lang ? path.join(OUT, lang) : OUT;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  return path.relative(ROOT, path.join(dir, 'index.html'));
}

fs.rmSync(OUT, { recursive: true, force: true });
const written = ['', ...LANGS].map(build);

console.log(written.join('\n'));
console.log(API ? `API: ${API}` : 'SCANINBOX_API not set — the published page will not save sign-ups');
console.log(SITE ? `Root: ${SITE}` : 'SITE_URL not set — no canonical or hreflang');
