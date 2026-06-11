import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  clientAsset,
  getDistribution,
  getMeta,
  getPt,
  getPtAll,
  getPtRanking,
  getSectoareGeo,
  getStradaAll,
  getYears,
  isPartialYear,
  lastCompleteYear,
} from '@/lib/data';

const FIXTURES = path.resolve('test/fixtures');

describe('lib/data', () => {
  it('meta years are ascending', () => {
    const years = getYears();
    expect(years).toEqual([2024, 2025]);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });

  it('lastCompleteYear and isPartialYear read meta', () => {
    expect(lastCompleteYear()).toBe(2024);
    expect(isPartialYear(2025)).toBe(true);
    expect(isPartialYear(2024)).toBe(false);
  });

  it('pt ranking is sorted by days desc', () => {
    const rows = getPtRanking(2024);
    expect(rows.length).toBe(2);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].days).toBeGreaterThanOrEqual(rows[i].days);
    }
  });

  it('getPtAll returns a Map keyed by slug with parsed runs and episodes', () => {
    const all = getPtAll();
    expect(all).toBeInstanceOf(Map);
    const alfa = all.get('pt-modul-alfa');
    expect(alfa).toBeDefined();
    expect(alfa!.years['2024'].runs).toEqual([
      [114, 14, 'programat'],
      [200, 5, 'avarie'],
      [300, 2, 'programat'],
    ]);
    expect(alfa!.years['2024'].episodes[2].ongoing).toBe(true);
    expect(alfa!.years['2024'].episodes[2].end).toBeNull();
    expect(getPt('pt-modul-beta')?.sector).toBe(4);
    expect(getPt('pt-nu-exista')).toBeUndefined();
  });

  it('ndjson tolerates a trailing newline', () => {
    // fixture files end with "\n"; both lines must still parse
    expect(getPtAll().size).toBe(2);
    expect(getStradaAll().size).toBe(2);
  });

  it('corrupt ndjson line throws with file and line number', () => {
    const prev = process.env.TERMO_DATA_DIR;
    process.env.TERMO_DATA_DIR = path.join(FIXTURES, 'corrupt-data');
    try {
      expect(() => getPtAll()).toThrowError(/all\.ndjson\.gz at line 2/);
    } finally {
      process.env.TERMO_DATA_DIR = prev;
    }
  });

  it('missing distribution file throws with the path', () => {
    expect(() => getDistribution(1999)).toThrowError(/distribution-1999\.json/);
    // present year parses
    expect(getDistribution(2024).percentiles.p50).toBe(14);
  });

  it('getSectoareGeo returns null when the file is absent (never throws)', () => {
    expect(getSectoareGeo()).toBeNull();
  });

  it('clientAsset resolves known keys and throws on unknown', () => {
    expect(clientAsset('search-index.json')).toBe('/data/search-index.ab12cd34.json');
    expect(() => clientAsset('nu-exista.json')).toThrowError(/nu-exista\.json/);
  });

  it('meta coverage is keyed by string years', () => {
    expect(getMeta().coverage[String(2024)].snapshots).toBe(5600);
  });
});
