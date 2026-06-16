import { describe, expect, it } from 'vitest';
import {
  entryHref,
  fold,
  prepareIndex,
  scoreEntry,
  search,
  searchAddress,
  splitHouseNumber,
  type SearchEntry,
} from '@/lib/search';

const ENTRIES: SearchEntry[] = [
  { t: 'st', n: 'Șoseaua Olteniței', s: 'sos-oltenitei', sec: 4, d: 23 },
  { t: 'st', n: 'Str Oltina', s: 'str-oltina', sec: 4, d: 9 },
  { t: 'pt', n: 'Modul Toporași', s: 'pt-modul-toporasi', sec: 5, d: 179 },
  { t: 'st', n: 'Str Toporasi', s: 'str-toporasi', sec: 5, d: 193 },
  { t: 'pt', n: 'PT Olt', s: 'pt-olt', sec: 3, d: 50 },
  { t: 'st', n: 'Intrarea Zero', s: 'int-zero', sec: null, d: 0 },
];

describe('lib/search', () => {
  it('fold strips Romanian diacritics (comma-below and legacy cedilla)', () => {
    expect(fold('Șoseaua Olteniței')).toBe('soseaua oltenitei');
    expect(fold('Ţară Înțelegere ăâî')).toBe('tara intelegere aai');
  });

  it('prefix beats word-boundary beats substring', () => {
    expect(scoreEntry('olt', 'oltenitei')).toBe(3);
    expect(scoreEntry('olt', 'soseaua oltenitei')).toBe(2);
    expect(scoreEntry('olt', 'voltaj')).toBe(1);
    expect(scoreEntry('olt', 'fara apa')).toBe(0);
  });

  it('search ranks by score desc then days desc', () => {
    const prepared = prepareIndex(ENTRIES);
    const results = search(prepared, 'olt');
    // 'PT Olt' full prefix on second word? No — nf is 'pt olt', word-boundary (2).
    // 'Str Oltina' word boundary (2, d 9), 'Șoseaua Olteniței' word boundary (2, d 23).
    expect(results.map((r) => r.s)).toEqual(['pt-olt', 'sos-oltenitei', 'str-oltina']);
  });

  it('query without diacritics finds diacritic names', () => {
    const prepared = prepareIndex(ENTRIES);
    const results = search(prepared, 'oltenitei');
    expect(results.map((r) => r.s)).toContain('sos-oltenitei');
  });

  it('ties broken by d desc', () => {
    const prepared = prepareIndex(ENTRIES);
    const results = search(prepared, 'toporas');
    // Both word-boundary matches ('modul toporasi', 'str toporasi') → d desc.
    expect(results.map((r) => r.s)).toEqual(['str-toporasi', 'pt-modul-toporasi']);
  });

  it('empty and whitespace queries return []', () => {
    const prepared = prepareIndex(ENTRIES);
    expect(search(prepared, '')).toEqual([]);
    expect(search(prepared, '   ')).toEqual([]);
  });

  it('limit respected', () => {
    const prepared = prepareIndex(ENTRIES);
    expect(search(prepared, 'r', 2).length).toBe(2);
  });

  it('zero-day entries still listed', () => {
    const prepared = prepareIndex(ENTRIES);
    expect(search(prepared, 'zero').map((r) => r.s)).toEqual(['int-zero']);
  });

  it('entryHref maps both types', () => {
    expect(entryHref(ENTRIES[0])).toBe('/strada/sos-oltenitei');
    expect(entryHref(ENTRIES[2])).toBe('/punct-termic/pt-modul-toporasi');
  });
});

describe('house-number search', () => {
  it('splits a trailing house number from the street part', () => {
    expect(splitHouseNumber('Colentina 64')).toEqual({ streetPart: 'colentina', nr: '64' });
    expect(splitHouseNumber('Constantin Radulescu Motru 12')).toEqual({
      streetPart: 'constantin radulescu motru',
      nr: '12',
    });
    expect(splitHouseNumber('Colentina 64A')).toEqual({ streetPart: 'colentina', nr: '64a' });
    expect(splitHouseNumber('Colentina 64-66')).toEqual({ streetPart: 'colentina', nr: '64-66' });
  });

  it('leaves bare streets and bare numbers untouched', () => {
    expect(splitHouseNumber('Pajurei')).toEqual({ streetPart: 'pajurei', nr: null });
    expect(splitHouseNumber('64')).toEqual({ streetPart: '64', nr: null });
    // a street whose name ends in a word (even if it starts with a number)
    expect(splitHouseNumber('13 Septembrie')).toEqual({ streetPart: '13 septembrie', nr: null });
  });

  it('searchAddress tags street results with the number, PTs untouched', () => {
    const prepared = prepareIndex(ENTRIES);
    const results = searchAddress(prepared, 'oltenitei 64');
    const street = results.find((r) => r.s === 'sos-oltenitei');
    expect(street?.nr).toBe('64');
    expect(entryHref(street!)).toBe('/strada/sos-oltenitei?nr=64');
    // bare query behaves exactly like search()
    expect(searchAddress(prepared, 'oltenitei').map((r) => r.s)).toContain('sos-oltenitei');
  });

  it('hyphenated/dotted names match when typed with spaces', () => {
    const prepared = prepareIndex([
      { t: 'st', n: 'Str Constantin Radulescu-Motru', s: 'str-constantin-radulescu-motru', sec: 4, d: 30 },
      { t: 'st', n: 'Str C.A. Rosetti', s: 'str-c-a-rosetti', sec: 1, d: 5 },
    ]);
    expect(search(prepared, 'constantin radulescu motru').map((r) => r.s)).toContain(
      'str-constantin-radulescu-motru',
    );
    expect(searchAddress(prepared, 'Constantin Radulescu Motru 12')[0]?.nr).toBe('12');
    expect(search(prepared, 'c a rosetti').map((r) => r.s)).toContain('str-c-a-rosetti');
  });
});
