import { describe, expect, it } from 'vitest';
import { getPtAll, getStradaAll, type Run } from '@/lib/data';
import { deficientaDays, deficientaDaysFromRuns } from '@/lib/deficienta';

describe('lib/deficienta', () => {
  it('counts the UNION of deficienta run days, never their sum', () => {
    const runs: Run[] = [
      [10, 5, 'deficienta'],
      [12, 5, 'deficienta'],
    ];
    expect(deficientaDaysFromRuns(runs)).toBe(7); // days 10..16, not 10
  });

  it('ignores every non-deficienta run', () => {
    expect(
      deficientaDaysFromRuns([
        [1, 100, 'avarie'],
        [1, 100, 'programat'],
      ]),
    ).toBe(0);
  });

  it('clips to the year, including leap years', () => {
    expect(deficientaDaysFromRuns([[360, 30, 'deficienta']], 2025)).toBe(6);
    expect(deficientaDaysFromRuns([[360, 30, 'deficienta']], 2024)).toBe(7);
  });

  it('prefers the explicit field and falls back to runs when it is absent', () => {
    expect(deficientaDays({ days_deficienta: 42, runs: [] })).toBe(42);
    expect(deficientaDays({ runs: [[5, 3, 'deficienta']] })).toBe(3);
    expect(deficientaDays(undefined)).toBe(0);
  });

  it('the runs fallback reproduces days_deficienta exactly on every fixture entity-year', () => {
    // The invariant the street fallback rests on. Verified bundle-wide on real
    // data (5,054 PT-years + 6,670 street-years, zero mismatches); locked here.
    for (const pt of getPtAll().values()) {
      for (const [year, y] of Object.entries(pt.years)) {
        expect(deficientaDaysFromRuns(y.runs, Number(year))).toBe(y.days_deficienta);
      }
    }
    for (const st of getStradaAll().values()) {
      for (const [year, y] of Object.entries(st.years)) {
        if (typeof y.days_deficienta === 'number') {
          expect(deficientaDaysFromRuns(y.runs, Number(year))).toBe(y.days_deficienta);
        }
      }
    }
  });
});
