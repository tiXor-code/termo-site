// Pure, client-safe helpers for the OutageStrip SVG. Type-only import below is
// erased at compile time, so this module never pulls in server-only code.
import type { CauseClass, Run } from '@/lib/data';

export type StripSegment = { x: number; width: number; cause: CauseClass };

export function daysInYear(year: number): 365 | 366 {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 366 : 365;
}

/**
 * Converts runs ([startDoy 1-based, lengthDays, cause]) into non-overlapping
 * SVG segments sorted by x (x = startDoy - 1). Paints in cause order
 * unclassified → programat → avarie, so avarie wins overlaps. Runs are
 * clipped to the year's day count.
 */
export function runsToSegments(runs: Run[], year: number): StripSegment[] {
  // The bundle carries a 4th cause class "deficienta" whose days feed the
  // secondary days_deficienta counter and are NOT part of the headline `days`
  // (verified bundle-wide: union of non-deficienta runs == days for every
  // PT-year and street-year). Exclude those runs explicitly so the strip
  // always matches the headline; paintOrder below then acts as the allowlist
  // for any other unknown cause string (which is simply not painted).
  const painted = runs.filter((r) => r[2] !== 'deficienta');
  const total = daysInYear(year);
  // per-day cause map, index 0 = Jan 1
  const days: (CauseClass | undefined)[] = new Array(total).fill(undefined);
  const paintOrder: CauseClass[] = ['unclassified', 'programat', 'avarie'];
  for (const cause of paintOrder) {
    for (const [startDoy, lengthDays, runCause] of painted) {
      if (runCause !== cause) continue;
      const start = Math.max(0, startDoy - 1);
      const end = Math.min(total, startDoy - 1 + lengthDays); // exclusive
      for (let i = start; i < end; i++) {
        days[i] = cause;
      }
    }
  }
  const segments: StripSegment[] = [];
  let current: StripSegment | null = null;
  for (let i = 0; i < total; i++) {
    const cause = days[i];
    if (cause === undefined) {
      current = null;
      continue;
    }
    if (current && current.cause === cause && current.x + current.width === i) {
      current.width += 1;
    } else {
      current = { x: i, width: 1, cause };
      segments.push(current);
    }
  }
  return segments;
}
