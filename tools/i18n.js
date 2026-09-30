'use strict';

/**
 * ScanInbox — translation tool.
 *
 *   node tools/i18n.js extract   index.html  ->  i18n/lv.json
 *   node tools/i18n.js merge     i18n/*.json ->  index.html
 *   node tools/i18n.js check     checks that everything matches (writes nothing)
 *
 * How this is put together
 * -------------------------
 * Latvian text lives in `index.html` itself, on elements with
 * `data-i18n="key"`, so the page without JavaScript is in Latvian and no
 * sentence is written twice. The other languages are `i18n/<lang>.json`, and
 * `merge` puts them into the page as a `window.SCANINBOX_I18N` block between
 * `<!-- I18N:BEGIN -->` and `<!-- I18N:END -->`.
 *
 * `i18n/lv.json` is GENERATED — `extract` writes it, not a person. It exists
 * so you can see which keys changed since the last translation pass:
 *
 *   git diff i18n/lv.json
 *
 * Workflow when changing text
 * ----------------------------
 *   1. fix the Latvian text in `index.html`
 *   2. node tools/i18n.js extract
 *   3. git diff i18n/lv.json    -> see what needs translating
 *   4. fix the same keys in i18n/<lang>.json for each language
 *   5. node tools/i18n.js merge
 *   6. node --test
 *
 * If step 4 is skipped, `merge` says so, and the untranslated spot in the
 * page stays in Latvian — not blank.
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

// ---------------------------------------------------------------- extract ---

/**
 * Collects Latvian strings from the page, in document order.
 * @returns {Record<string,string>}
 */
function extract(html) {
  const out = {};
  const order = [];

  /* data-i18n="key" — take the inside of the element. Counts nested tags of
     the same name so an included matching tag doesn't stop it too early. */
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

  /* Form status messages have no element to sit on, so the Latvian
     originals are in the MSG_LV map inside the script, and translations
     carry an msg. prefix. */
  const block = /var MSG_LV = \{([\s\S]*?)\n  \};/.exec(html);
  if (!block) throw new Error('index.html: MSG_LV block not found');
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

// ----------------------------------------------------------------- check ---

/** Which tags are in a string — for comparing across languages. */
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
      problems.push(`${lang}: unreadable (${err.message})`);
      continue;
    }

    const missing = keys.filter((k) => !(k in obj));
    const extra = Object.keys(obj).filter((k) => !keys.includes(k));
    if (missing.length) {
      problems.push(`${lang}: missing ${missing.length} — ${missing.slice(0, 8).join(', ')}`);
    }
    if (extra.length) {
      problems.push(`${lang}: extra ${extra.length} — ${extra.slice(0, 8).join(', ')}`);
    }

    for (const k of keys) {
      if (!(k in obj)) continue;
      if (typeof obj[k] !== 'string') { problems.push(`${lang}.${k}: not a string`); continue; }
      /* Markup must survive translation: different tags mean a broken page. */
      if (tagsOf(source[k]) !== tagsOf(obj[k])) {
        problems.push(`${lang}.${k}: different markup\n    lv: ${tagsOf(source[k])}\n    ${lang}: ${tagsOf(obj[k])}`);
      }
    }

    /* In source order, so the page diff stays readable. */
    const ordered = {};
    for (const k of keys) if (k in obj) ordered[k] = obj[k];
    dicts[lang] = ordered;
  }

  return { problems, dicts };
}

// ------------------------------------------------------------------ merge ---

function merge(html, dicts) {
  const body = LANGS.filter((l) => dicts[l]).map((lang) => {
    const rows = Object.entries(dicts[lang])
      .map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v))
      .join(',\n');
    return ' ' + lang + ': {\n' + rows + '\n }';
  }).join(',\n');

  const block = [
    BEGIN,
    '<!-- Language dictionaries. Latvian text is not here: it lives in the',
    '     page itself, so without JavaScript the page is in Latvian and',
    '     nothing is written twice.',
    '     GENERATED from i18n/*.json — write there, then node tools/i18n.js merge. -->',
    '<script>',
    'window.SCANINBOX_I18N = {',
    body,
    '};',
    '</script>',
    END,
  ].join('\n');

  const a = html.indexOf(BEGIN);
  if (a < 0) throw new Error('index.html: ' + BEGIN + ' not found');
  const b = html.indexOf(END);
  if (b < 0) throw new Error('index.html: ' + END + ' not found');
  return html.slice(0, a) + block + html.slice(b + END.length);
}

// -------------------------------------------------------------------- CLI ---

const cmd = process.argv[2];
const html = fs.readFileSync(PAGE, 'utf8');
const source = extract(html);

if (cmd === 'extract') {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'lv.json'), JSON.stringify(source, null, 2) + '\n', 'utf8');
  console.log(`i18n/lv.json — ${Object.keys(source).length} keys`);
  console.log('What changed since the last translation pass: git diff i18n/lv.json');
} else if (cmd === 'merge' || cmd === 'check') {
  const { problems, dicts } = inspect(source);
  if (problems.length) {
    console.error('PROBLEMS:\n  ' + problems.join('\n  '));
  }
  if (cmd === 'check') {
    if (problems.length) process.exit(1);
    console.log(`Everything matches — ${Object.keys(source).length} keys × ${LANGS.length} languages`);
  } else {
    fs.writeFileSync(PAGE, merge(html, dicts), 'utf8');
    const kb = (fs.statSync(PAGE).size / 1024).toFixed(1);
    console.log(`Merged: ${LANGS.join(', ')} — index.html ${kb} KB`);
    if (problems.length) console.error('Untranslated spots in the page stay in Latvian.');
  }
} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^'use strict';\n+\/\*\*\n/, '').replace(/^ \* ?/gm, ''));
  process.exit(1);
}
