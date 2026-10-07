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
 *   _site/assets/         static files the page references (the og:image
 *                         share cards, one per language) — index.html has
 *                         no other assets, being a single file by design
 *
 * Environment variables:
 *   SCANINBOX_API      the full API address. If unset, the published page
 *                      runs as a preview — the form goes through but saves
 *                      nothing, and says so.
 *   SCANINBOX_API_KEY  Supabase publishable key for the `apikey` header.
 *                      Public by design: it only allows calling submit_lead().
 *   SITE_URL           the page's root, for canonical and hreflang links.
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
const API_KEY = process.env.SCANINBOX_API_KEY || '';
const SITE = (process.env.SITE_URL || '').replace(/\/+$/, '');

const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const API_TAG = /<meta name="scaninbox:api" content="[^"]*">/;
if (!API_TAG.test(src)) throw new Error('index.html: <meta name="scaninbox:api"> not found');
const KEY_TAG = /<meta name="scaninbox:apikey" content="[^"]*">/;
if (!KEY_TAG.test(src)) throw new Error('index.html: <meta name="scaninbox:apikey"> not found');

/* Bots that unfurl a shared link (Discord, Slack, iMessage, ...) fetch the
   raw HTML and never run the client-side script that swaps this same text
   after load. So the title, description, and share-card tags have to be
   baked into each language's file at build time, or every link — whatever
   language it points at — unfurls in Latvian. */
const LV_TITLE = /<title>([^<]*)<\/title>/.exec(src)[1];
const LV_DESC = /<meta name="description" id="metadesc"[^>]*content="([^"]*)"/.exec(src)[1];
const LV_H1 = /<h1 data-i18n="hero\.h1">([\s\S]*?)<\/h1>/.exec(src)[1];

/** Strips tags and collapses whitespace — same as the page's own plain(). */
function plain(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** The window.SCANINBOX_I18N block, parsed once, so each language's own
    title/description/heading can be baked in rather than left in Latvian. */
function loadDict(lang) {
  if (lang === 'lv' || !lang) return null;
  const file = path.join(ROOT, 'i18n', lang + '.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Links to the same page in every other language, plus the canonical address. */
function alternates(lang) {
  if (!SITE) return '';
  const rows = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${SITE}/${l}/">`
  );
  rows.push(`<link rel="alternate" hreflang="x-default" href="${SITE}/">`);
  rows.push(`<link rel="canonical" href="${SITE}${lang ? '/' + lang + '/' : '/'}">`);
  rows.push(`<meta property="og:url" content="${SITE}${lang ? '/' + lang + '/' : '/'}">`);
  return rows.join('\n') + '\n';
}

/**
 * @param {string} lang  the language, or '' for the root
 */
function build(lang) {
  let html = src.replace(API_TAG, `<meta name="scaninbox:api" content="${API}">`)
    .replace(KEY_TAG, `<meta name="scaninbox:apikey" content="${API_KEY}">`);

  const dict = loadDict(lang);
  const title = escapeAttr(dict && dict['meta.title'] || LV_TITLE);
  const desc = escapeAttr(dict && dict['meta.desc'] || LV_DESC);
  const h1Plain = escapeAttr(plain(dict && dict['hero.h1'] || LV_H1));

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(
    /<meta name="description" id="metadesc"[^>]*content="[^"]*">/,
    `<meta name="description" id="metadesc" content="${desc}">`,
  );
  html = html.replace(
    /<meta property="og:title" id="ogtitle"[^>]*content="[^"]*">/,
    `<meta property="og:title" id="ogtitle" content="${h1Plain}">`,
  );
  html = html.replace(
    /<meta property="og:description" id="ogdesc"[^>]*content="[^"]*">/,
    `<meta property="og:description" id="ogdesc" content="${desc}">`,
  );
  html = html.replace(
    /<meta property="og:locale" id="oglocale"[^>]*content="[^"]*">/,
    `<meta property="og:locale" id="oglocale" content="${LOCALE[lang || 'lv']}">`,
  );

  /* A share card is only worth having if it unfurls: relative image URLs
     don't resolve for bots, so this needs SITE_URL to become absolute. */
  const imageUrl = SITE
    ? `${SITE}/assets/og/${lang || 'lv'}.jpg`
    : `assets/og/${lang || 'lv'}.jpg`;
  html = html.replace(
    /<meta property="og:image" id="ogimage"[^>]*content="[^"]*">/,
    `<meta property="og:image" id="ogimage" content="${imageUrl}">`,
  );
  html = html.replace(
    /<meta name="twitter:image" id="twimage"[^>]*content="[^"]*">/,
    `<meta name="twitter:image" id="twimage" content="${imageUrl}">`,
  );

  /* This marker switches on both the root redirect and the language switcher
     navigating to a different address rather than swapping text in place.
     The local file doesn't have it, so locally none of that happens. */
  let head = '<meta name="scaninbox:langpaths" content="1">\n';
  if (lang) head += `<meta name="scaninbox:lang" content="${lang}">\n`;
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
fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true });
// Public privacy notice has its own stable URL and does not load tracking tags.
fs.cpSync(path.join(ROOT, 'privacy'), path.join(OUT, 'privacy'), { recursive: true });

console.log(written.join('\n'));
console.log(API ? `API: ${API}` : 'SCANINBOX_API not set — the published page will not save sign-ups');
console.log(SITE ? `Root: ${SITE}` : 'SITE_URL not set — no canonical or hreflang');
