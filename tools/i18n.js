'use strict';

/**
 * ScanInbox — tulkojumu rīks.
 *
 *   node tools/i18n.js extract   index.html  ->  i18n/lv.json
 *   node tools/i18n.js merge     i18n/*.json ->  index.html
 *   node tools/i18n.js check     pārbauda, vai viss sakrīt (neko neraksta)
 *
 * Kā tas ir salikts
 * -----------------
 * Latviešu teksts dzīvo pašā `index.html` uz elementiem ar `data-i18n="atslēga"`,
 * tāpēc lapa bez JavaScript ir latviski un neviens teikums nav ierakstīts divreiz.
 * Pārējās četras valodas ir `i18n/<lang>.json`, un `merge` tās ieliek lapā kā
 * `window.SCANINBOX_I18N` bloku starp `<!-- I18N:BEGIN -->` un `<!-- I18N:END -->`.
 *
 * `i18n/lv.json` ir ĢENERĒTS — to raksta `extract`, nevis cilvēks. Tas pastāv,
 * lai varētu redzēt, kuras atslēgas mainījušās kopš pēdējās tulkošanas:
 *
 *   git diff i18n/lv.json
 *
 * Darba gaita, mainot tekstu
 * --------------------------
 *   1. izlabo latviešu tekstu `index.html`
 *   2. node tools/i18n.js extract
 *   3. git diff i18n/lv.json    -> redzi, kas jātulko
 *   4. izlabo tās pašas atslēgas i18n/en|it|fr|de.json
 *   5. node tools/i18n.js merge
 *   6. node --test
 *
 * Ja 4. solis izlaists, `merge` par to pasaka, un neiztulkotā vieta lapā paliek
 * latviski — nevis tukša.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'index.html');
const DIR = path.join(ROOT, 'i18n');
const LANGS = ['en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el', 'es', 'fi',
  'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv'];

const BEGIN = '<!-- I18N:BEGIN -->';
const END = '<!-- I18N:END -->';

// ------------------------------------------------------------- izvilkšana ---

/**
 * Savāc latviešu virknes no lapas dokumenta secībā.
 * @returns {Record<string,string>}
 */
function extract(html) {
  const out = {};
  const order = [];

  /* data-i18n="atslēga" — ņem elementa iekšpusi. Nosaukumu skaitu iekšā
     skaita, lai iekļauts tāds pats tags neapstādinātu par agru. */
  const tagRe = /<([a-z0-9]+)\b([^>]*?)data-i18n="([^"]+)"([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[1];
    const key = m[3];
    const start = tagRe.lastIndex;
    let depth = 1;
    let i = start;
    const open = new RegExp('<' + tag + '\\b', 'gi');
    const close = new RegExp('</' + tag + '\\s*>', 'gi');
    while (depth > 0) {
      open.lastIndex = i;
      close.lastIndex = i;
      const o = open.exec(html);
      const c = close.exec(html);
      if (!c) break;
      if (o && o.index < c.index) { depth++; i = o.index + 1; }
      else { depth--; i = depth === 0 ? c.index : c.index + c[0].length; }
    }
    const inner = html.slice(start, i).trim().replace(/\s*\n\s*/g, ' ');
    if (!(key in out)) { out[key] = inner; order.push(key); }
  }

  for (const [attr, src] of [['data-i18n-ph', 'placeholder'], ['data-i18n-aria', 'aria-label']]) {
    const re = new RegExp('<[^>]*?' + attr + '="([^"]+)"[^>]*>', 'gi');
    let a;
    while ((a = re.exec(html))) {
      const key = a[1];
      const v = new RegExp(src + '="([^"]*)"').exec(a[0]);
      if (v && !(key in out)) { out[key] = v[1]; order.push(key); }
    }
  }

  /* Formas paziņojumiem nav elementa, uz kura sēdēt, tāpēc latviešu oriģināli
     ir MSG_LV kartē skripta iekšā un tulkojumi — ar msg. priedēkli. */
  const block = /var MSG_LV = \{([\s\S]*?)\n  \};/.exec(html);
  if (!block) throw new Error('index.html: MSG_LV bloks nav atrasts');
  const msgRe = /^\s*(\w+):\s*"((?:[^"\\]|\\.)*)"/gm;
  let g;
  while ((g = msgRe.exec(block[1]))) {
    const key = 'msg.' + g[1];
    out[key] = g[2].replace(/\\"/g, '"');
    order.push(key);
  }

  out['meta.title'] = /<title>([^<]*)<\/title>/.exec(html)[1];
  order.push('meta.title');
  out['meta.desc'] = /<meta name="description"[^>]*content="([^"]*)"/.exec(html)[1];
  order.push('meta.desc');

  const ordered = {};
  for (const k of order) ordered[k] = out[k];
  return ordered;
}

// --------------------------------------------------------------- pārbaude ---

/** Kādi tagi ir virknē — salīdzināšanai starp valodām. */
function tagsOf(s) {
  return (String(s).match(/<[^>]+>/g) || []).map((t) => t.replace(/\s+/g, ' ')).sort().join('|');
}

/**
 * @returns {{problems: string[], dicts: Record<string, Record<string,string>>}}
 */
function inspect(source) {
  const keys = Object.keys(source);
  const problems = [];
  const dicts = {};

  for (const lang of LANGS) {
    const file = path.join(DIR, lang + '.json');
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      problems.push(`${lang}: nav nolasāms (${err.message})`);
      continue;
    }

    const missing = keys.filter((k) => !(k in obj));
    const extra = Object.keys(obj).filter((k) => !keys.includes(k));
    if (missing.length) {
      problems.push(`${lang}: trūkst ${missing.length} — ${missing.slice(0, 8).join(', ')}`);
    }
    if (extra.length) {
      problems.push(`${lang}: lieki ${extra.length} — ${extra.slice(0, 8).join(', ')}`);
    }

    for (const k of keys) {
      if (!(k in obj)) continue;
      if (typeof obj[k] !== 'string') { problems.push(`${lang}.${k}: nav virkne`); continue; }
      /* Marķējumam jāizdzīvo tulkojumā: citi tagi nozīmē salauztu lapu. */
      if (tagsOf(source[k]) !== tagsOf(obj[k])) {
        problems.push(`${lang}.${k}: cits marķējums\n    lv: ${tagsOf(source[k])}\n    ${lang}: ${tagsOf(obj[k])}`);
      }
    }

    /* Avota secībā, lai lapas diff paliek lasāms. */
    const ordered = {};
    for (const k of keys) if (k in obj) ordered[k] = obj[k];
    dicts[lang] = ordered;
  }

  return { problems, dicts };
}

// ------------------------------------------------------------- iemontēšana ---

function merge(html, dicts) {
  const body = LANGS.filter((l) => dicts[l]).map((lang) => {
    const rows = Object.entries(dicts[lang])
      .map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v))
      .join(',\n');
    return ' ' + lang + ': {\n' + rows + '\n }';
  }).join(',\n');

  const block = [
    BEGIN,
    '<!-- Valodu vārdnīcas. Latviešu teksta šeit nav: tas ir pašā lapā, tāpēc',
    '     bez JavaScript lapa ir latviski un nekas nav ierakstīts divreiz.',
    '     ĢENERĒTS no i18n/*.json — raksti tur, tad node tools/i18n.js merge. -->',
    '<script>',
    'window.SCANINBOX_I18N = {',
    body,
    '};',
    '</script>',
    END,
  ].join('\n');

  const a = html.indexOf(BEGIN);
  if (a < 0) throw new Error('index.html: ' + BEGIN + ' nav atrasts');
  const b = html.indexOf(END);
  if (b < 0) throw new Error('index.html: ' + END + ' nav atrasts');
  return html.slice(0, a) + block + html.slice(b + END.length);
}

// ------------------------------------------------------------------ CLI ---

const cmd = process.argv[2];
const html = fs.readFileSync(PAGE, 'utf8');
const source = extract(html);

if (cmd === 'extract') {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'lv.json'), JSON.stringify(source, null, 2) + '\n', 'utf8');
  console.log(`i18n/lv.json — ${Object.keys(source).length} atslēgas`);
  console.log('Kas mainījies kopš pēdējās tulkošanas: git diff i18n/lv.json');
} else if (cmd === 'merge' || cmd === 'check') {
  const { problems, dicts } = inspect(source);
  if (problems.length) {
    console.error('PROBLĒMAS:\n  ' + problems.join('\n  '));
  }
  if (cmd === 'check') {
    if (problems.length) process.exit(1);
    console.log(`Viss sakrīt — ${Object.keys(source).length} atslēgas × ${LANGS.length} valodas`);
  } else {
    fs.writeFileSync(PAGE, merge(html, dicts), 'utf8');
    const kb = (fs.statSync(PAGE).size / 1024).toFixed(1);
    console.log(`Iemontēts: ${LANGS.join(', ')} — index.html ${kb} KB`);
    if (problems.length) console.error('Neiztulkotās vietas lapā paliek latviski.');
  }
} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^'use strict';\n+\/\*\*\n/, '').replace(/^ \* ?/gm, ''));
  process.exit(1);
}
