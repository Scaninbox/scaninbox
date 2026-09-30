'use strict';

/** validate() is a pure function — these tests touch neither HTTP nor writes. */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { validate, LIMITS } = require('../server.js');
const { freshStore, validLead } = require('./helpers.js');

let ctx;
let codes;

before(() => { ctx = freshStore(); codes = ctx.store.codes; });
after(() => ctx.cleanup());

describe('validate() — e-mail', () => {
  test('accepts a valid sign-up', () => {
    const { lead, error } = validate(validLead(), codes);
    assert.equal(error, undefined);
    assert.equal(lead.email, 'anna.berzina@inbox.lv');
    assert.equal(lead.consent, undefined, 'consent is not carried forward — the schema decides that');
  });

  test('keeps the original spelling and normalises the dedup key', () => {
    const { lead } = validate(validLead({ email: 'Anna.Berzina@INBOX.lv' }), codes);
    assert.equal(lead.email, 'Anna.Berzina@INBOX.lv');
    assert.equal(lead.email_norm, 'anna.berzina@inbox.lv');
  });

  test('trims surrounding whitespace', () => {
    const { lead } = validate(validLead({ email: '  anna@inbox.lv \n' }), codes);
    assert.equal(lead.email, 'anna@inbox.lv');
  });

  for (const bad of ['', '   ', 'not-an-email', 'a@b', '@inbox.lv', 'anna@', 'anna @inbox.lv',
    'anna@inbox', 'anna@@inbox.lv', 'anna@inbox.l']) {
    test(`rejects an invalid address ${JSON.stringify(bad)}`, () => {
      const res = validate(validLead({ email: bad }), codes);
      assert.equal(res.error, 'invalid_email');
      assert.equal(res.field, 'email');
      assert.equal(res.lead, undefined);
    });
  }

  for (const bad of [undefined, null, 42, {}, []]) {
    test(`rejects an e-mail that isn't a string: ${JSON.stringify(bad)}`, () => {
      assert.equal(validate(validLead({ email: bad }), codes).error, 'invalid_email');
    });
  }

  test('rejects an over-long address rather than truncating it', () => {
    const long = 'a'.repeat(LIMITS.email) + '@inbox.lv';
    const res = validate(validLead({ email: long }), codes);
    assert.equal(res.error, 'invalid_email',
      'a truncated e-mail is a different address, so it must not be silently saved');
  });

  test('accepts an address right at the length limit', () => {
    const local = 'a'.repeat(LIMITS.email - '@inbox.lv'.length);
    const { lead, error } = validate(validLead({ email: local + '@inbox.lv' }), codes);
    assert.equal(error, undefined);
    assert.equal(lead.email.length, LIMITS.email);
  });
});

describe('validate() — consent', () => {
  test('accepts only the literal true', () => {
    assert.equal(validate(validLead({ consent: true }), codes).error, undefined);
  });

  for (const bad of [false, undefined, null, 1, 'true', 'on', {}]) {
    test(`rejects consent ${JSON.stringify(bad)}`, () => {
      const res = validate(validLead({ consent: bad }), codes);
      assert.equal(res.error, 'consent_required');
      assert.equal(res.field, 'consent');
    });
  }

  test('an e-mail error is reported before the consent one', () => {
    const res = validate({ email: 'bad', consent: false }, codes);
    assert.equal(res.error, 'invalid_email');
  });
});

describe('validate() — code sanitising', () => {
  test('keeps valid codes', () => {
    const { lead } = validate(validLead({ segment: 'large', devices: '20+', priceBand: 'lt2' }), codes);
    assert.equal(lead.segment, 'large');
    assert.equal(lead.device_band, '20+');
    assert.equal(lead.price_band, 'lt2');
  });

  test('drops unknown codes to null rather than rejecting the sign-up', () => {
    const { lead, error } = validate(validLead({
      segment: 'HACKER', devices: '999', priceBand: "'; DROP TABLE leads; --",
    }), codes);
    assert.equal(error, undefined, 'an invalid code must not lose the e-mail');
    assert.equal(lead.segment, null);
    assert.equal(lead.device_band, null);
    assert.equal(lead.price_band, null);
  });

  test('treats an empty choice as unanswered', () => {
    const { lead } = validate(validLead({ segment: '', devices: '', priceBand: '' }), codes);
    assert.equal(lead.segment, null);
    assert.equal(lead.device_band, null);
    assert.equal(lead.price_band, null);
  });

  test('codes are case-sensitive', () => {
    const { lead } = validate(validLead({ segment: 'SMALL' }), codes);
    assert.equal(lead.segment, null);
  });
});

describe('validate() — free-text fields', () => {
  test('truncates name and model to the limit', () => {
    const { lead } = validate(validLead({
      name: 'A'.repeat(LIMITS.name + 50),
      model: 'M'.repeat(LIMITS.model + 50),
    }), codes);
    assert.equal(lead.name.length, LIMITS.name);
    assert.equal(lead.model, undefined);
    assert.equal(lead.device_model.length, LIMITS.model);
  });

  test('whitespace-only becomes null', () => {
    const { lead } = validate(validLead({ name: '   \t\n ', model: ' ' }), codes);
    assert.equal(lead.name, null);
    assert.equal(lead.device_model, null);
  });

  test('preserves diacritics', () => {
    const { lead } = validate(validLead({ name: 'Līga Ozoliņa-Šķēle', model: 'Ricoh IM C3000 ķņūž' }), codes);
    assert.equal(lead.name, 'Līga Ozoliņa-Šķēle');
    assert.equal(lead.device_model, 'Ricoh IM C3000 ķņūž');
  });
});

describe('validate() — flags and language', () => {
  test('wantsBeta requires the literal true', () => {
    assert.equal(validate(validLead({ wantsBeta: true }), codes).lead.wants_beta, 1);
    for (const truthy of ['yes', 1, {}, 'on']) {
      assert.equal(validate(validLead({ wantsBeta: truthy }), codes).lead.wants_beta, 0,
        `${JSON.stringify(truthy)} is not a deliberate opt-in`);
    }
    assert.equal(validate(validLead({ wantsBeta: undefined }), codes).lead.wants_beta, 0);
  });

  test('accepts every page language, everything else becomes lv', () => {
    for (const known of ['lv', 'en', 'it', 'fr', 'de', 'bg', 'cs', 'da', 'el', 'es',
      'fi', 'hr', 'hu', 'lt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv']) {
      assert.equal(validate(validLead({ lang: known }), codes).lead.lang, known);
    }
    for (const other of ['ru', 'EN', 'en-GB', '', undefined, null, 7]) {
      assert.equal(validate(validLead({ lang: other }), codes).lead.lang, 'lv');
    }
  });
});

describe('validate() — malformed body', () => {
  for (const bad of [null, undefined, 'string', 42, true, []]) {
    test(`rejects body ${JSON.stringify(bad)}`, () => {
      assert.equal(validate(bad, codes).error, 'invalid_body');
    });
  }

  test('ignores fields the form never sends', () => {
    const { lead, error } = validate(validLead({
      id: 999, created_at: '1999-01-01', contacted_at: 'now', notes: 'injection',
    }), codes);
    assert.equal(error, undefined);
    assert.deepEqual(Object.keys(lead).sort(), [
      'brands', 'device_band', 'device_model', 'email', 'email_norm', 'lang',
      'name', 'price_band', 'segment', 'wants_beta',
    ], 'only known fields reach the database');
  });
});

describe('validate() — brands', () => {
  test('stays null without the field, so an already-marked set is not erased', () => {
    assert.equal(validate(validLead(), codes).lead.brands, null);
  });

  test('an empty array stays an empty array — that is the answer "none"', () => {
    assert.deepEqual(validate(validLead({ brands: [] }), codes).lead.brands, []);
  });

  test('accepts known codes and keeps only those', () => {
    const { lead } = validate(validLead({ brands: ['canon', 'hp'] }), codes);
    assert.deepEqual(lead.brands, ['canon', 'hp']);
  });

  test('silently drops unknown codes', () => {
    const { lead } = validate(validLead({ brands: ['canon', 'not-a-brand', '', null, 7] }), codes);
    assert.deepEqual(lead.brands, ['canon']);
  });

  test('merges duplicates', () => {
    const { lead } = validate(validLead({ brands: ['hp', 'hp', 'hp'] }), codes);
    assert.deepEqual(lead.brands, ['hp']);
  });

  test('caps the count, so a submission can\'t be inflated', () => {
    const many = Array.from({ length: 50 }, (_, i) => `brand-${i}`).concat([...codes.brand]);
    const { lead } = validate(validLead({ brands: many }), codes);
    assert.ok(lead.brands.length <= LIMITS.brands);
  });

  for (const bad of ['canon', 42, {}, null]) {
    test(`a list that isn't an array is "the field wasn't there": ${JSON.stringify(bad)}`, () => {
      assert.equal(validate(validLead({ brands: bad }), codes).lead.brands, null);
    });
  }
});
