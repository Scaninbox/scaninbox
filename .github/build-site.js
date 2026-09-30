'use strict';

/**
 * Saliek _site no viena index.html: sakne plus pa lapai katrai valodai.
 *
 *   node .github/build-site.js
 *
 * Kāpēc kopijas, nevis viens fails ar ?lang=: katrai valodai vajag savu
 * adresi. Meklētājs indeksē adreses, nevis JavaScript stāvokli, un reklāmas
 * kampaņa aizved uz /de/, nevis uz lapu, kas pati minēs, kas tu esi.
 *
 * Iznākums:
 *   _site/index.html      pāradresē uz valodu pēc sīkdatnes, laika joslas vai
 *                         pārlūka; citādi identisks
 *   _site/<lang>/         pati lapa tajā valodā, bez pāradresācijas
 *
 * Vides mainīgie:
 *   SCANINBOX_API   pilna API adrese. Ja nav, publicētā lapa strādā kā
 *                   priekšskatījums — forma iziet cauri, bet neko nesaglabā,
 *                   un tā to arī pasaka.
 *   SCANINBOX_API_KEY  Supabase publishable key for the `apikey` header.
 *                   Public by design: it only allows calling submit_lead().
 *   SITE_URL       lapas sakne canonical un hreflang saitēm.
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
if (!API_TAG.test(src)) throw new Error('index.html: <meta name="scaninbox:api"> nav atrasts');
const KEY_TAG = /<meta name="scaninbox:apikey" content="[^"]*">/;
if (!KEY_TAG.test(src)) throw new Error('index.html: <meta name="scaninbox:apikey"> not found');

/** Saites uz to pašu lapu pārējās valodās, plus kanoniskā adrese. */
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
 * @param {string} lang  valoda vai '' saknei
 */
function build(lang) {
  let html = src.replace(API_TAG, `<meta name="scaninbox:api" content="${API}">`)
    .replace(KEY_TAG, `<meta name="scaninbox:apikey" content="${API_KEY}">`);

  /* Šis marķieris ieslēdz gan saknes pāradresāciju, gan to, ka valodas slēdzis
     pārvieto uz citu adresi, nevis maina tekstu uz vietas. Lokālajā failā tā
     nav, tāpēc lokāli nekas no tā nenotiek. */
  let head = '<meta name="scaninbox:langpaths" content="1">\n';
  if (lang) {
    head += `<meta name="scaninbox:lang" content="${lang}">\n`;
    head += `<meta property="og:locale" content="${LOCALE[lang]}">\n`;
  }
  head += alternates(lang);

  html = html.replace('<meta name="scaninbox:api"', head + '<meta name="scaninbox:api"');

  /* Valodas lapa jau zina savu valodu, tāpēc <html lang> ir pareizs arī tad,
     ja JavaScript nenostrādā. */
  if (lang) html = html.replace('<html lang="lv">', `<html lang="${lang}">`);

  const dir = lang ? path.join(OUT, lang) : OUT;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  return path.relative(ROOT, path.join(dir, 'index.html'));
}

fs.rmSync(OUT, { recursive: true, force: true });
const written = ['', ...LANGS].map(build);

console.log(written.join('\n'));
console.log(API ? `API: ${API}` : 'API nav uzstādīts — publicētā lapa pieteikumus nesaglabās');
console.log(SITE ? `Sakne: ${SITE}` : 'SITE_URL nav uzstādīts — bez canonical un hreflang');
