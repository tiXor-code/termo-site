import { describe, expect, it } from 'vitest';
import type { Meta } from '@/lib/data';
import {
  fmtDateRo,
  fmtDateTimeRo,
  fmtDec,
  fmtInt,
  fmtRatio,
  fmtZile,
  yearLabel,
} from '@/lib/format';

const meta: Meta = {
  generated_at: '2026-06-11T03:10:00Z',
  data_through: '2026-06-10',
  years: [2021, 2024, 2025, 2026],
  last_complete_year: 2025,
  partial_years: [2021, 2026],
  universe_size: 947,
  coverage: {},
  sources_cutover_utc: '2026-06-10T19:34:00Z',
};

describe('lib/format', () => {
  it('fmtDec uses Romanian decimal comma', () => {
    expect(fmtDec(2.1)).toBe('2,1');
    expect(fmtDec(2)).toBe('2,0');
    expect(fmtDec(3.14159, 2)).toBe('3,14');
  });

  it('fmtInt formats integers for ro-RO', () => {
    expect(fmtInt(7)).toBe('7');
  });

  it('fmtZile applies Romanian plural rules', () => {
    expect(fmtZile(1)).toBe('1 zi');
    expect(fmtZile(3)).toBe('3 zile');
    expect(fmtZile(19)).toBe('19 zile');
    expect(fmtZile(22)).toBe('22 de zile');
    expect(fmtZile(0)).toBe('0 zile');
  });

  it('fmtDateRo renders full Romanian dates', () => {
    expect(fmtDateRo('2025-10-16')).toBe('16 octombrie 2025');
    expect(fmtDateRo('2025-10-16T23:00')).toBe('16 octombrie 2025');
  });

  it('fmtDateTimeRo renders short date plus time', () => {
    expect(fmtDateTimeRo('2025-10-16T23:00')).toBe('16 oct. 2025, 23:00');
    expect(fmtDateTimeRo('2025-05-04T07:30')).toBe('4 mai 2025, 07:30');
    expect(fmtDateTimeRo('2025-05-04')).toBe('4 mai 2025');
  });

  it('fmtRatio formats the ratio and is null when median is 0', () => {
    expect(fmtRatio(44, 22)).toBe('de 2,0 ori');
    expect(fmtRatio(46, 22)).toBe('de 2,1 ori');
    expect(fmtRatio(5, 0)).toBeNull();
  });

  it('yearLabel marks partial years', () => {
    expect(yearLabel(2025, meta)).toBe('2025');
    expect(yearLabel(2026, meta)).toBe('2026 (până la 10 iunie 2026)');
    expect(yearLabel(2021, meta)).toBe('2021 (parțial)');
  });
});
