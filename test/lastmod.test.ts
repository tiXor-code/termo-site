import { describe, expect, it } from 'vitest';
import type { Run } from '@/lib/data';
import {
  cap,
  dateFromDoy,
  entityLastmod,
  lastRunDate,
  parseUtcDay,
  yearLastmod,
} from '@/lib/lastmod';

const iso = (d: Date | null | undefined) => d?.toISOString().slice(0, 10);
const THROUGH = parseUtcDay('2026-07-27');

describe('dateFromDoy', () => {
  it('treats doy as 1-based: doy 1 is 1 January', () => {
    expect(iso(dateFromDoy(2025, 1))).toBe('2025-01-01');
  });

  it('handles a leap year without drifting', () => {
    // 2024 is a leap year: doy 60 is 29 February, doy 366 is 31 December.
    expect(iso(dateFromDoy(2024, 60))).toBe('2024-02-29');
    expect(iso(dateFromDoy(2024, 366))).toBe('2024-12-31');
    expect(iso(dateFromDoy(2025, 365))).toBe('2025-12-31');
  });
});

describe('lastRunDate', () => {
  it('returns null when the entity has no runs at all', () => {
    expect(lastRunDate({})).toBeNull();
    expect(lastRunDate({ '2025': { runs: [] } })).toBeNull();
  });

  it('a run of length 2 starting on doy 95 ends on doy 96, not 97', () => {
    const years = { '2025': { runs: [[95, 2, 'avarie']] as Run[] } };
    // doy 95 of 2025 = 5 April; the run covers 5 and 6 April.
    expect(iso(lastRunDate(years))).toBe('2025-04-06');
  });

  it('picks the latest run across every year, not the last one listed', () => {
    const years = {
      '2026': { runs: [[10, 1, 'programat']] as Run[] },
      '2022': { runs: [[300, 5, 'avarie']] as Run[] },
    };
    expect(iso(lastRunDate(years))).toBe('2026-01-10');
  });

  it('clamps a zero or negative length to a single day', () => {
    // A bad upstream record must never resolve BEFORE its own start date.
    const years = { '2025': { runs: [[100, 0, 'avarie']] as Run[] } };
    expect(iso(lastRunDate(years))).toBe(iso(dateFromDoy(2025, 100)));
  });

  it('ignores malformed year keys and malformed start days', () => {
    const years = {
      notayear: { runs: [[5, 1, 'avarie']] as Run[] },
      '2025': { runs: [[0, 1, 'avarie'], [-4, 1, 'avarie']] as Run[] },
    };
    expect(lastRunDate(years)).toBeNull();
  });
});

describe('entityLastmod', () => {
  it('uses the last run, capped at data_through', () => {
    const years = { '2026': { runs: [[150, 3, 'programat']] as Run[] } };
    expect(iso(entityLastmod(years, THROUGH))).toBe('2026-06-01');
  });

  it('never claims a date after data_through even if a run overruns it', () => {
    // doy 250 of 2026 is well past 2026-07-27.
    const years = { '2026': { runs: [[250, 4, 'avarie']] as Run[] } };
    expect(iso(entityLastmod(years, THROUGH))).toBe('2026-07-27');
  });

  it('falls back to the end of the latest data year when there are no runs', () => {
    const years = { '2023': { runs: [] }, '2024': { runs: [] } };
    expect(iso(entityLastmod(years, THROUGH))).toBe('2024-12-31');
  });

  it('returns undefined when there is nothing to date at all', () => {
    expect(entityLastmod({}, THROUGH)).toBeUndefined();
  });

  it('is stable across builds: the same data yields the same date', () => {
    const years = { '2025': { runs: [[42, 2, 'avarie']] as Run[] } };
    const a = entityLastmod(years, THROUGH);
    const b = entityLastmod(years, parseUtcDay('2026-09-30'));
    // A later build with unchanged entity data must not move the stamp — that
    // was the whole bug (every url re-stamped on every rebuild).
    expect(iso(a)).toBe(iso(b));
  });
});

describe('yearLastmod', () => {
  it('freezes a closed year at 31 December', () => {
    expect(iso(yearLastmod(2023, THROUGH))).toBe('2023-12-31');
  });

  it('caps the in-progress year at data_through', () => {
    expect(iso(yearLastmod(2026, THROUGH))).toBe('2026-07-27');
  });
});

describe('cap', () => {
  it('passes a date through untouched when it is within the cap', () => {
    const d = parseUtcDay('2025-01-01');
    expect(cap(d, THROUGH)).toBe(d);
  });
});
