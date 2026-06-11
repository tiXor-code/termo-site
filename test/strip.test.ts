import { describe, expect, it } from 'vitest';
import type { Run } from '@/lib/data';
import { daysInYear, runsToSegments } from '@/lib/strip';

describe('lib/strip', () => {
  it('maps [114,142,"programat"] to {x:113,width:142}', () => {
    const segs = runsToSegments([[114, 142, 'programat']], 2025);
    expect(segs).toEqual([{ x: 113, width: 142, cause: 'programat' }]);
  });

  it('clips a run overflowing the year end', () => {
    const segs = runsToSegments([[360, 30, 'avarie']], 2025); // 365 days
    expect(segs).toEqual([{ x: 359, width: 6, cause: 'avarie' }]);
  });

  it('handles leap years (2024 has 366 days)', () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2025)).toBe(365);
    expect(daysInYear(2000)).toBe(366);
    expect(daysInYear(2100)).toBe(365);
    const segs = runsToSegments([[360, 30, 'avarie']], 2024);
    expect(segs).toEqual([{ x: 359, width: 7, cause: 'avarie' }]);
  });

  it('avarie wins overlaps over programat', () => {
    const runs: Run[] = [
      [10, 10, 'programat'], // days 10..19
      [15, 5, 'avarie'], // days 15..19 overlap
    ];
    const segs = runsToSegments(runs, 2025);
    expect(segs).toEqual([
      { x: 9, width: 5, cause: 'programat' },
      { x: 14, width: 5, cause: 'avarie' },
    ]);
  });

  it('returns [] for empty runs', () => {
    expect(runsToSegments([], 2025)).toEqual([]);
  });

  it('excludes "deficienta" runs (4th bundle cause, not part of headline days)', () => {
    const runs: Run[] = [
      [10, 5, 'avarie'],
      [20, 7, 'deficienta'],
    ];
    expect(runsToSegments(runs, 2025)).toEqual([{ x: 9, width: 5, cause: 'avarie' }]);
  });

  it('does not paint unknown cause strings', () => {
    expect(runsToSegments([[30, 4, 'mentenanta']], 2025)).toEqual([]);
  });

  it('a 1-day run has width 1', () => {
    expect(runsToSegments([[42, 1, 'unclassified']], 2025)).toEqual([
      { x: 41, width: 1, cause: 'unclassified' },
    ]);
  });

  it('segments are sorted by x and non-overlapping', () => {
    const runs: Run[] = [
      [200, 5, 'avarie'],
      [10, 3, 'programat'],
      [100, 4, 'unclassified'],
    ];
    const segs = runsToSegments(runs, 2025);
    expect(segs.map((s) => s.x)).toEqual([9, 99, 199]);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].x).toBeGreaterThanOrEqual(segs[i - 1].x + segs[i - 1].width);
    }
  });
});
