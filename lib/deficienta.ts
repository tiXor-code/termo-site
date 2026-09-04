// Pure, client-safe. The bundle's 4th run class ('deficienta') carries the
// pressure/temperature-degraded days.
//
// PT-years and street-years both ship an explicit `days_deficienta` as of the
// 2026-08-25 bundle. Street-years did NOT before it, so every street read goes
// through deficientaDays(), which prefers the field and falls back to the runs.
// Verified bundle-wide: for all 5,054 PT-years and 6,670 street-years,
// |union of 'deficienta' run days| === days_deficienta, zero mismatches. The
// fallback is therefore EXACT, not an approximation.
//
// Never read StreetYear.days_deficienta directly - on an older data-latest it
// is undefined, and fmtInt(undefined) renders NaN across ~1,200 static pages.
import type { Run } from '@/lib/data';
import { daysInYear } from '@/lib/strip';

export function deficientaDaysFromRuns(runs: Run[] | undefined, year?: number): number {
  if (!runs || runs.length === 0) return 0;
  const limit = year !== undefined ? daysInYear(year) : Number.POSITIVE_INFINITY;
  const days = new Set<number>();
  for (const [startDoy, lengthDays, cause] of runs) {
    if (cause !== 'deficienta') continue;
    for (let i = 0; i < lengthDays; i++) {
      const doy = startDoy + i;
      if (doy >= 1 && doy <= limit) days.add(doy);
    }
  }
  return days.size;
}

/** Deficiency days for a PT-year or street-year. Prefers the field, falls back to runs. */
export function deficientaDays(
  y: { days_deficienta?: number; runs?: Run[] } | undefined,
  year?: number,
): number {
  if (!y) return 0;
  if (typeof y.days_deficienta === 'number') return y.days_deficienta;
  return deficientaDaysFromRuns(y.runs, year);
}
