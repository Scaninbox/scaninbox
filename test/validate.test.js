'use strict';

/** validate() ir tīra funkcija — šie testi neaiztiek ne HTTP, ne rakstīšanu. */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { validate, LIMITS } = require('../server.js');
const { freshStore, validLead } = require('./helpers.js');

let ctx;
let codes;

before(() => { ctx = freshStore(); codes = ctx.store.codes; });
after(() => ctx.cleanup());

describe('validate() — e-pasts', () => {
  test('pieņem derīgu pieteikumu', () => {
    const { lead, error } = validate(validLead(), codes);
    assert.equal(error, undefined);
    assert.equal(lead.email, 'anna.berzina@inbox.lv');
    assert.equal(lead.consent, undefined, 'consent netiek nests uz priekšu — to nosaka shēma');
  });

  test('saglabā oriģinālo rakstību un normalizē dublikātu atslēgu', () => {
    const { lead } = validate(validLead({ email: 'Anna.Berzina@INBOX.lv' }), codes);
    assert.equal(lead.email, 'Anna.Berzina@INBOX.lv');
    assert.equal(lead.email_norm, 'anna.berzina@inbox.lv');
  });

  test('nogriež apkārtējās atstarpes', () => {
    const { lead } = validate(validLead({ email: '  anna@inbox.lv \n' }), codes);
    assert.equal(lead.email, 'anna@inbox.lv');
  });

  for (const bad of ['', '   ', 'nav-epasta', 'a@b', '@inbox.lv', 'anna@', 'anna @inbox.lv',
    'anna@inbox', 'anna@@inbox.lv', 'anna@inbox.l']) {
    test(`noraida nederīgu adresi ${JSON.stringify(bad)}`, () => {
      const res = validate(validLead({ email: bad }), codes);
      assert.equal(res.error, 'invalid_email');
      assert.equal(res.field, 'email');
      assert.equal(res.lead, undefined);
    });
  }

  for (const bad of [undefined, null, 42, {}, []]) {
    test(`noraida e-pastu, kas nav virkne: ${JSON.stringify(bad)}`, () => {
      assert.equal(validate(validLead({ email: bad }), codes).error, 'invalid_email');
    });
  }

  test('noraida pārgaru adresi, nevis to apgriež', () => {
    const long = 'a'.repeat(LIMITS.email) + '@inbox.lv';
    const res = validate(validLead({ email: long }), codes);
    assert.equal(res.error, 'invalid_email',
      'apgriezts e-pasts ir cita adrese, tāpēc to nedrīkst klusi saglabāt');
  });

  test('pieņem adresi tieši uz garuma robežas', () => {
    const local = 'a'.repeat(LIMITS.email - '@inbox.lv'.length);
    const { lead, error } = validate(validLead({ email: local + '@inbox.lv' }), codes);
    assert.equal(error, undefined);
    assert.equal(lead.email.length, LIMITS.email);
  });
});

describe('validate() — piekrišana', () => {
  test('pieņem tikai burtisko true', () => {
    assert.equal(validate(validLead({ consent: true }), codes).error, undefined);
  });

  for (const bad of [false, undefined, null, 1, 'true', 'on', {}]) {
    test(`noraida piekrišanu ${JSON.stringify(bad)}`, () => {
      const res = validate(validLead({ consent: bad }), codes);
      assert.equal(res.error, 'consent_required');
      assert.equal(res.field, 'consent');
    });
  }

  test('e-pasta kļūda tiek ziņota pirms piekrišanas', () => {
    const res = validate({ email: 'slikts', consent: false }, codes);
    assert.equal(res.error, 'invalid_email');
  });
});

describe('validate() — kodu attīrīšana', () => {
  test('patur derīgus kodus', () => {
    const { lead } = validate(validLead({ segment: 'large', devices: '20+', priceBand: 'lt2' }), codes);
    assert.equal(lead.segment, 'large');
    assert.equal(lead.device_band, '20+');
    assert.equal(lead.price_band, 'lt2');
  });

  test('nezināmus kodus izmet uz null, nevis noraida pieteikumu', () => {
    const { lead, error } = validate(validLead({
      segment: 'HAKERIS', devices: '999', priceBand: "'; DROP TABLE leads; --",
    }), codes);
    assert.equal(error, undefined, 'nederīgs kods nedrīkst pazaudēt e-pastu');
    assert.equal(lead.segment, null);
    assert.equal(lead.device_band, null);
    assert.equal(lead.price_band, null);
  });

  test('tukšu izvēli uzskata par neatbildētu', () => {
    const { lead } = validate(validLead({ segment: '', devices: '', priceBand: '' }), codes);
    assert.equal(lead.segment, null);
    assert.equal(lead.device_band, null);
    assert.equal(lead.price_band, null);
  });

  test('kodi ir reģistrjutīgi', () => {
    const { lead } = validate(validLead({ segment: 'SMALL' }), codes);
    assert.equal(lead.segment, null);
  });
});

describe('validate() — brīvie lauki', () => {
  test('apgriež vārdu un modeli līdz robežai', () => {
    const { lead } = validate(validLead({
      name: 'Ā'.repeat(LIMITS.name + 50),
      model: 'M'.repeat(LIMITS.model + 50),
    }), codes);
    assert.equal(lead.name.length, LIMITS.name);
    assert.equal(lead.model, undefined);
    assert.equal(lead.device_model.length, LIMITS.model);
  });

  test('tikai atstarpes kļūst par null', () => {
    const { lead } = validate(validLead({ name: '   \t\n ', model: ' ' }), codes);
    assert.equal(lead.name, null);
    assert.equal(lead.device_model, null);
  });

  test('saglabā diakritiku', () => {
    const { lead } = validate(validLead({ name: 'Līga Ozoliņa-Šķēle', model: 'Ricoh IM C3000 ķņūž' }), codes);
    assert.equal(lead.name, 'Līga Ozoliņa-Šķēle');
    assert.equal(lead.device_model, 'Ricoh IM C3000 ķņūž');
  });
});

describe('validate() — karodziņi un valoda', () => {
  test('wantsBeta prasa burtisko true', () => {
    assert.equal(validate(validLead({ wantsBeta: true }), codes).lead.wants_beta, 1);
    for (const truthy of ['yes', 1, {}, 'on']) {
      assert.equal(validate(validLead({ wantsBeta: truthy }), codes).lead.wants_beta, 0,
        `${JSON.stringify(truthy)} nav apzināta izvēle`);
    }
    assert.equal(validate(validLead({ wantsBeta: undefined }), codes).lead.wants_beta, 0);
  });

  test('pieņem visas lapas valodas, viss cits kļūst lv', () => {
    for (const known of ['lv', 'en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el', 'es',
      'fi', 'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv']) {
      assert.equal(validate(validLead({ lang: known }), codes).lead.lang, known);
    }
    for (const other of ['ru', 'EN', 'en-GB', '', undefined, null, 7]) {
      assert.equal(validate(validLead({ lang: other }), codes).lead.lang, 'lv');
    }
  });
});

describe('validate() — bojāts ķermenis', () => {
  for (const bad of [null, undefined, 'virkne', 42, true, []]) {
    test(`noraida ķermeni ${JSON.stringify(bad)}`, () => {
      assert.equal(validate(bad, codes).error, 'invalid_body');
    });
  }

  test('ignorē laukus, ko forma nesūta', () => {
    const { lead, error } = validate(validLead({
      id: 999, created_at: '1999-01-01', contacted_at: 'tagad', notes: 'injekcija',
    }), codes);
    assert.equal(error, undefined);
    assert.deepEqual(Object.keys(lead).sort(), [
      'brands', 'device_band', 'device_model', 'email', 'email_norm', 'lang',
      'name', 'price_band', 'segment', 'wants_beta',
    ], 'uz datubāzi aiziet tikai zināmie lauki');
  });
});

describe('validate() — zīmoli', () => {
  test('bez lauka paliek null, lai jau atzīmētais netiktu izdzēsts', () => {
    assert.equal(validate(validLead(), codes).lead.brands, null);
  });

  test('tukšs masīvs paliek tukšs masīvs — tā ir atbilde «nevienu»', () => {
    assert.deepEqual(validate(validLead({ brands: [] }), codes).lead.brands, []);
  });

  test('pieņem zināmus kodus un saglabā tikai tos', () => {
    const { lead } = validate(validLead({ brands: ['canon', 'hp'] }), codes);
    assert.deepEqual(lead.brands, ['canon', 'hp']);
  });

  test('nezināmus kodus klusi izmet', () => {
    const { lead } = validate(validLead({ brands: ['canon', 'nav-taada', '', null, 7] }), codes);
    assert.deepEqual(lead.brands, ['canon']);
  });

  test('dublikātus sapludina', () => {
    const { lead } = validate(validLead({ brands: ['hp', 'hp', 'hp'] }), codes);
    assert.deepEqual(lead.brands, ['hp']);
  });

  test('ierobežo skaitu, lai iesniegums nevarētu uzpūsties', () => {
    const many = Array.from({ length: 50 }, (_, i) => `zimols-${i}`).concat([...codes.brand]);
    const { lead } = validate(validLead({ brands: many }), codes);
    assert.ok(lead.brands.length <= LIMITS.brands);
  });

  for (const bad of ['canon', 42, {}, null]) {
    test(`saraksts, kas nav masīvs, ir «lauka nebija»: ${JSON.stringify(bad)}`, () => {
      assert.equal(validate(validLead({ brands: bad }), codes).lead.brands, null);
    });
  }
});
