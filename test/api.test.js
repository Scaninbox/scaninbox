'use strict';

/** HTTP layer tests. Each block starts its own server on a free port. */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, validLead } = require('./helpers.js');

const TOKEN = 'test-token-1234567890';
const auth = { Authorization: `Bearer ${TOKEN}` };

describe('POST /api/leads', () => {
  let s;
  beforeEach(async () => { s = await startApp({ rate: { max: 50 } }); });
  afterEach(async () => { await s.stop(); });

  test('a valid sign-up returns 201 and lands in the database', async () => {
    const res = await s.post('/api/leads', validLead());
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { ok: true, id: 1, status: 'created' });

    const row = s.store.db.prepare('SELECT * FROM leads').get();
    assert.equal(row.email, 'anna.berzina@inbox.lv');
    assert.equal(row.name, 'Anna Bērziņa');
    assert.equal(row.segment, 'small');
    assert.equal(row.device_band, '2-5');
    assert.equal(row.price_band, '5-10');
    assert.equal(row.wants_beta, 1);
    assert.equal(row.consent, 1);
  });

  test('the same e-mail in a different case updates rather than duplicates', async () => {
    await s.post('/api/leads', validLead());
    const res = await s.post('/api/leads', validLead({
      email: 'Anna.Berzina@INBOX.lv', segment: 'large', devices: '20+', priceBand: '10+', name: 'Anna B.',
    }));

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, id: 1, status: 'updated' });

    assert.equal(s.store.q.count.get().n, 1, 'a duplicate was created');
    const row = s.store.db.prepare('SELECT * FROM leads').get();
    assert.equal(row.segment, 'large', 'the answer was not updated');
    assert.equal(row.price_band, '10+');
    assert.equal(row.email, 'Anna.Berzina@INBOX.lv', 'we show the most recent spelling');
  });

  test('every submission is saved to history', async () => {
    await s.post('/api/leads', validLead({ priceBand: 'lt2' }));
    await s.post('/api/leads', validLead({ priceBand: '10+' }));

    const events = s.store.db.prepare('SELECT kind, payload FROM lead_events ORDER BY id').all();
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((e) => e.kind), ['created', 'updated']);
    /* The old answer can be found, not overwritten. */
    assert.equal(JSON.parse(events[0].payload).priceBand, 'lt2');
    assert.equal(JSON.parse(events[1].payload).priceBand, '10+');
  });

  test('no consent — 422 and no row', async () => {
    const res = await s.post('/api/leads', validLead({ consent: false }));
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: 'consent_required', field: 'consent' });
    assert.equal(s.store.q.count.get().n, 0);
  });

  test('invalid e-mail — 422', async () => {
    const res = await s.post('/api/leads', validLead({ email: 'not-an-email' }));
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, 'invalid_email');
    assert.equal(s.store.q.count.get().n, 0);
  });

  test('malformed JSON — 400', async () => {
    const res = await s.post('/api/leads', '{not valid json');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'invalid_json');
  });

  test('empty body — 400', async () => {
    const res = await s.post('/api/leads', '');
    assert.equal(res.status, 400);
  });

  test('a body that is not an object — 422', async () => {
    const res = await s.post('/api/leads', '"string"');
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, 'invalid_body');
  });

  test('diacritics survive the whole trip', async () => {
    await s.post('/api/leads', validLead({
      email: 'liga@inbox.lv', name: 'Līga Ozoliņa-Šķēle', model: 'Ricoh IM C3000 ķņūž',
    }));
    const row = s.store.db.prepare('SELECT name, device_model FROM leads').get();
    assert.equal(row.name, 'Līga Ozoliņa-Šķēle');
    assert.equal(row.device_model, 'Ricoh IM C3000 ķņūž');
  });

  test('unknown codes are sanitised, the sign-up still goes through', async () => {
    const res = await s.post('/api/leads', validLead({ segment: 'HACKER', devices: '999' }));
    assert.equal(res.status, 201);
    const row = s.store.db.prepare('SELECT segment, device_band FROM leads').get();
    assert.equal(row.segment, null);
    assert.equal(row.device_band, null);
  });
});

/* The page now signs somebody up with just an e-mail, and asks the rest
   afterwards in a popover. That reaches the server as two requests with the
   same address, so nothing may be lost on the second one. */
describe('POST /api/leads — two-stage sign-up', () => {
  let s;
  const email = 'anna.berzina@inbox.lv';
  beforeEach(async () => { s = await startApp({ rate: { max: 50 } }); });
  afterEach(async () => { await s.stop(); });

  const brandsOf = (id) => s.store.db
    .prepare('SELECT brand FROM lead_brands WHERE lead_id = ? ORDER BY brand').all(id).map((r) => r.brand);

  test('one e-mail with no answers is a valid sign-up', async () => {
    const res = await s.post('/api/leads', { email, consent: true, lang: 'it' });
    assert.equal(res.status, 201);
    const row = s.store.db.prepare('SELECT * FROM leads').get();
    assert.equal(row.email, email);
    assert.equal(row.segment, null);
    assert.equal(row.lang, 'it');
  });

  test('follow-up answers stick to the same sign-up', async () => {
    await s.post('/api/leads', { email, consent: true, lang: 'lv' });
    const res = await s.post('/api/leads', {
      email, consent: true, lang: 'lv',
      segment: 'small', devices: '2-5', brands: ['canon', 'hp'],
    });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, id: 1, status: 'updated' });
    assert.equal(s.store.q.count.get().n, 1);

    const row = s.store.db.prepare('SELECT * FROM leads').get();
    assert.equal(row.segment, 'small');
    assert.equal(row.device_band, '2-5');
    assert.deepEqual(brandsOf(1), ['canon', 'hp']);
  });

  test('a later submission with no answers does not erase them', async () => {
    await s.post('/api/leads', {
      email, consent: true, lang: 'lv', segment: 'medium', devices: '6-20', brands: ['ricoh'],
    });
    await s.post('/api/leads', { email, consent: true, lang: 'lv' });

    const row = s.store.db.prepare('SELECT * FROM leads').get();
    assert.equal(row.segment, 'medium', 'the answered field stays');
    assert.equal(row.device_band, '6-20');
    assert.deepEqual(brandsOf(1), ['ricoh'], 'brands stay, because the field wasn\'t there');
  });

  test('an empty brand list means "none" and clears the previous ones', async () => {
    await s.post('/api/leads', { email, consent: true, lang: 'lv', brands: ['canon', 'hp'] });
    await s.post('/api/leads', { email, consent: true, lang: 'lv', brands: [] });
    assert.deepEqual(brandsOf(1), []);
  });

  test('brands are replaced, not accumulated', async () => {
    await s.post('/api/leads', { email, consent: true, lang: 'lv', brands: ['canon', 'hp'] });
    await s.post('/api/leads', { email, consent: true, lang: 'lv', brands: ['xerox'] });
    assert.deepEqual(brandsOf(1), ['xerox']);
  });

  test('an unknown brand does not stop the sign-up', async () => {
    const res = await s.post('/api/leads', {
      email, consent: true, lang: 'lv', brands: ['canon', 'not-a-brand'],
    });
    assert.equal(res.status, 201);
    assert.deepEqual(brandsOf(1), ['canon']);
  });

  test('both steps stay in the event history', async () => {
    await s.post('/api/leads', { email, consent: true, lang: 'lv' });
    await s.post('/api/leads', { email, consent: true, lang: 'lv', segment: 'private' });
    const kinds = s.store.db.prepare('SELECT kind FROM lead_events ORDER BY id').all().map((r) => r.kind);
    assert.deepEqual(kinds, ['created', 'updated']);
  });

  test('v_leads shows brands in a human-readable form', async () => {
    await s.post('/api/leads', { email, consent: true, lang: 'lv', brands: ['konica', 'canon'] });
    const view = s.store.db.prepare('SELECT brands FROM v_leads').get();
    assert.match(view.brands, /Canon/);
    assert.match(view.brands, /Konica Minolta/);
  });
});

describe('POST /api/leads — limits', () => {
  test('an oversized body gets 413, not a dropped connection', async () => {
    const s = await startApp({ maxBody: 1024, rate: { max: 50 } });
    try {
      const res = await s.post('/api/leads', validLead({ name: 'x'.repeat(4000) }));
      assert.equal(res.status, 413);
      assert.equal((await res.json()).error, 'too_large');
      assert.equal(s.store.q.count.get().n, 0);
    } finally {
      await s.stop();
    }
  });

  test('the rate limit kicks in after the set count', async () => {
    const s = await startApp({ rate: { max: 3, windowMs: 60_000 } });
    try {
      const codes = [];
      for (let i = 0; i < 5; i += 1) {
        const res = await s.post('/api/leads', validLead({ email: `n${i}@inbox.lv` }));
        codes.push(res.status);
      }
      assert.deepEqual(codes, [201, 201, 201, 429, 429]);
      assert.equal(s.store.q.count.get().n, 3, 'rate-limited submissions must not reach the database');
    } finally {
      await s.stop();
    }
  });

  test('an invalid submission counts toward the limit too', async () => {
    const s = await startApp({ rate: { max: 2, windowMs: 60_000 } });
    try {
      await s.post('/api/leads', validLead({ consent: false }));
      await s.post('/api/leads', '{broken');
      const res = await s.post('/api/leads', validLead());
      assert.equal(res.status, 429, 'otherwise the limit could be bypassed with broken submissions');
    } finally {
      await s.stop();
    }
  });
});

describe('read endpoints', () => {
  let s;
  beforeEach(async () => {
    s = await startApp({ adminToken: TOKEN, rate: { max: 50 } });
    await s.post('/api/leads', validLead({ email: 'a@inbox.lv', segment: 'medium', priceBand: '5-10' }));
    await s.post('/api/leads', validLead({ email: 'b@inbox.lv', segment: 'small', priceBand: 'lt2', model: 'HP M428' }));
  });
  afterEach(async () => { await s.stop(); });

  for (const route of ['/api/leads', '/api/leads.csv', '/api/stats']) {
    test(`${route} without a token — 401`, async () => {
      const res = await s.get(route);
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error, 'unauthorized');
    });

    test(`${route} with an incorrect token — 401`, async () => {
      const res = await s.get(route, { Authorization: 'Bearer incorrect' });
      assert.equal(res.status, 401);
    });

    test(`${route} with a token of the same length — 401`, async () => {
      const res = await s.get(route, { Authorization: `Bearer ${'x'.repeat(TOKEN.length)}` });
      assert.equal(res.status, 401);
    });
  }

  test('/api/leads returns sign-ups', async () => {
    const res = await s.get('/api/leads', auth);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.count, 2);
    assert.equal(body.leads.length, 2);
    assert.deepEqual(body.leads.map((l) => l.email).sort(), ['a@inbox.lv', 'b@inbox.lv']);
    assert.equal(body.leads[0].email_norm, undefined, 'the internal dedup key is not exposed');
  });

  test('/api/leads honours the limit parameter', async () => {
    const body = await (await s.get('/api/leads?limit=1', auth)).json();
    assert.equal(body.leads.length, 1);
    assert.equal(body.count, 2, 'the total count stays the full one');
  });

  test('/api/leads.csv quotes values containing commas', async () => {
    const res = await s.get('/api/leads.csv', auth);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-disposition'), /attachment/);

    const text = await res.text();
    const [header] = text.split('\r\n');
    assert.match(header, /^id,email,name,/);
    assert.match(text, /"Uzņēmums, 10 līdz 100 cilvēku"/, 'a comma in a value has to be quoted');
  });

  test('/api/stats summarises demand', async () => {
    const body = await (await s.get('/api/stats', auth)).json();
    assert.equal(body.total, 2);

    const price = Object.fromEntries(body.price_demand.map((r) => [r.code, r.leads]));
    assert.equal(price['5-10'], 1);
    assert.equal(price['lt2'], 1);

    const segment = Object.fromEntries(body.segment_demand.map((r) => [r.code, r.leads]));
    assert.equal(segment.medium, 1);
    assert.equal(segment.small, 1);
    assert.equal(segment.private, 0);

    /* When mention counts tie, the view sorts by name. */
    assert.deepEqual(body.device_models.map((m) => m.model), ['Canon MF445dw', 'HP M428']);
    assert.deepEqual(body.device_models.map((m) => m.mentions), [1, 1]);
  });

  test('/api/health is open, but does not reveal the sign-up count', async () => {
    const res = await s.get('/api/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.leads, undefined,
      'the count is both a competitive metric and proof that the "first 50" are already taken');
    assert.equal(body.db, undefined, 'nobody outside needs to know the file name');
  });
});

describe('reads with no token set', () => {
  test('stays locked and says what to do', async () => {
    const s = await startApp();
    try {
      const res = await s.get('/api/leads', auth);
      assert.equal(res.status, 401, 'must not open just because the server is running');
      assert.match((await res.json()).hint, /SCANINBOX_ADMIN_TOKEN/);
    } finally {
      await s.stop();
    }
  });
});

describe('methods and static files', () => {
  let s;
  beforeEach(async () => { s = await startApp(); });
  afterEach(async () => { await s.stop(); });

  test('PUT to /api/leads — 405', async () => {
    const res = await s.request('/api/leads', { method: 'PUT' });
    assert.equal(res.status, 405);
    assert.equal((await res.json()).error, 'method_not_allowed');
  });

  test('GET /api/leads.csv with a POST method returns no data', async () => {
    const res = await s.post('/api/leads.csv', {}, auth);
    assert.equal(res.status, 405);
  });

  test('/ serves the page', async () => {
    const res = await s.get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, /<title>ScanInbox<\/title>/);
  });

  /* This test guards a deliberate decision, not code: a sign-up has one
     destination and there is no fallback storage. The endpoint is now
     configurable, since there's no server on GitHub Pages and the API lives
     elsewhere — but it's configurable in exactly one place, and the page
     still sends only there. */
  test('the page sends sign-ups to one endpoint and nowhere else', async () => {
    const html = await (await s.get('/')).text();

    /* The default is the same origin; the only other source is
       <meta name="scaninbox:api">, set at publish time. */
    assert.match(html, /LEADS_ENDPOINT = \(apiMeta[\s\S]{0,120}"\/api\/leads"/,
      'the endpoint comes from the meta tag or the same origin');
    assert.match(html, /<meta name="scaninbox:api" content="[^"]*">/);

    /* Across the whole page — not just one script — there is exactly one
       network call, and it goes to LEADS_ENDPOINT. The page has several
       scripts (the language redirect in the head), so count across the
       whole document. */
    const fetches = html.match(/fetch\s*\(/g) || [];
    assert.equal(fetches.length, 1, 'the page has exactly one fetch');
    assert.match(html, /fetch\(LEADS_ENDPOINT,/);
    assert.equal(/XMLHttpRequest|sendBeacon|navigator\.sendBeacon/.test(html), false,
      'there is no second path the data could take');

    /* No second storage: no Artifact, no foreign domain, no stashing the
       sign-up in the browser. */
    assert.equal(/claude\.use\(/.test(html), false, 'the Artifact store has been removed');
    assert.equal(/localStorage\.setItem\(\s*["'][^"']*lead/i.test(html), false,
      'sign-ups are not stored in the browser');
    assert.equal(/document\.cookie\s*=\s*["'][^"']*(lead|email)/i.test(html), false,
      'sign-ups are not stored in a cookie');
  });

  for (const route of ['/data/test.db', '/db/schema.sql', '/test/api.test.js', '/.gitignore']) {
    test(`${route} is not served`, async () => {
      const res = await s.get(route);
      assert.equal(res.status, 404);
    });
  }

  test('an encoded path escaping the root is rejected', async () => {
    for (const attempt of ['/%2e%2e%2f%2e%2e%2fWindows/win.ini', '/..%2f..%2fetc/passwd']) {
      const res = await s.get(attempt);
      assert.ok([403, 404].includes(res.status), `${attempt} -> ${res.status}`);
    }
  });

  test('broken percent-encoding — 400, not a crash', async () => {
    const res = await s.get('/%zz');
    assert.equal(res.status, 400);
  });

  test('a file that does not exist — 404', async () => {
    const res = await s.get('/no-such-page.html');
    assert.equal(res.status, 404);
  });
});
