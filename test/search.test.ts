import { describe, expect, it } from 'vitest';
import {
  entryHref,
  fold,
  prepareIndex,
  scoreEntry,
  search,
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
