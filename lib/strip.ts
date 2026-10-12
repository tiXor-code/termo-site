// Pure, client-safe helpers for the OutageStrip SVG. Type-only import below is
// erased at compile time, so this module never pulls in server-only code.
import type { CauseClass, Run } from '@/lib/data';

/** Classes the strip can paint. 'deficienta' is opt-in and never overrides an outage day. */
export type PaintClass = CauseClass | 'deficienta';
export type StripSegment = { x: number; width: number; cause: PaintClass };

const OPRIRE_ORDER: CauseClass[] = ['unclassified', 'programat', 'avarie'];

export function daysInYear(year: number): 365 | 366 {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return leap ? 366 : 365;
}

/**
 * Converts runs ([startDoy 1-based, lengthDays, cause]) into non-overlapping
 * SVG segments sorted by x (x = startDoy - 1). Runs are clipped to the year.
 *
 * `paintOrder` is BOTH the z-order (later wins) and the allowlist: an unknown
 * cause string is simply never painted. The bundle's 4th class 'deficienta'
 * feeds the secondary days_deficienta counter and is NOT part of the headline
 * `days`, so it is excluded by default. When opted in it paints FIRST, i.e. at
 * the LOWEST priority, so an outage day is never repainted as deficienta and
 * the strip's outage footprint stays bit-for-bit identical either way.
 */
export function runsToSegments(
  runs: Run[],
  year: number,
  opts?: { includeDeficienta?: boolean },
): StripSegment[] {
  const total = daysInYear(year);
  // per-day cause map, index 0 = Jan 1
  const days: (PaintClass | undefined)[] = new Array(total).fill(undefined);
  const paintOrder: PaintClass[] = opts?.includeDeficienta
    ? ['deficienta', ...OPRIRE_ORDER]
    : OPRIRE_ORDER;
  for (const cause of paintOrder) {
    for (const [startDoy, lengthDays, runCause] of runs) {
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
