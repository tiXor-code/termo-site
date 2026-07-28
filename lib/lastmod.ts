/**
 * Per-URL `lastmod` for the sitemap.
 *
 * Why this file exists: the sitemap used to stamp EVERY url with
 * `meta.generated_at`, and the data bundle is rebuilt daily. That told Google
 * all 2.353 de pagini changed every single day, which is false for the ~2.324
 * entity pages whose outage history has not moved in months. Google discounts
 * a `lastmod` it can see is unreliable, so the signal was worth nothing and the
 * crawler had no way to tell a genuinely updated page from a static one.
 *
 * Rule applied here:
 *   - entity pages (punct termic / stradă)  -> the day that entity's last
 *     recorded outage run ended, capped at `data_through`
 *   - frozen year archives                  -> 31 December of that year
 *   - live hubs (home, sector, harta, current-year rankings) -> `data_through`
 *   - editorial pages (despre, metodologie) -> no `lastmod` at all; omitting is
 *     honest, inventing a date is not
 *
 * All arithmetic is UTC so a machine's local timezone can never shift a date.
 */
import type { Run } from '@/lib/data';

/** Midnight UTC on 1 January of `year`, plus `doy - 1` whole days. */
export function dateFromDoy(year: number, doy: number): Date {
  return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86_400_000);
}

/** Parse a `YYYY-MM-DD` (or ISO timestamp) as a UTC instant. */
export function parseUtcDay(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * The last day an outage run touched this entity.
 *
 * `Run` is `[startDoy, lengthDays, cause]` with a 1-based day-of-year, so a run
 * of length 2 starting on doy 95 covers doy 95 and 96 and therefore ENDS on
 * `95 + 2 - 1`. A zero/negative length is treated as a single day so a bad
 * upstream record can never push the date backwards past its own start.
 *
 * Returns `null` when the entity has no runs at all (a street or PT that has
 * never been recorded as interrupted) - the caller decides the fallback.
 */
export function lastRunDate(years: Record<string, { runs?: Run[] }>): Date | null {
  let best: number | null = null;
  for (const [yearKey, year] of Object.entries(years)) {
    const y = Number(yearKey);
    if (!Number.isFinite(y)) continue;
    for (const run of year?.runs ?? []) {
      const [startDoy, lengthDays] = run;
      if (!Number.isFinite(startDoy) || startDoy < 1) continue;
      const span = Number.isFinite(lengthDays) && lengthDays > 1 ? lengthDays : 1;
      const end = dateFromDoy(y, startDoy + span - 1).getTime();
      if (best === null || end > best) best = end;
    }
  }
  return best === null ? null : new Date(best);
}

/** `a` unless it is after `cap`. Keeps a malformed run from claiming the future. */
export function cap(a: Date, capAt: Date): Date {
  return a.getTime() > capAt.getTime() ? capAt : a;
}

/**
 * `lastmod` for an entity page. Falls back to the end of the entity's most
 * recent data year when it has no runs, so the value is still stable across
 * builds instead of drifting to "today".
 */
export function entityLastmod(
  years: Record<string, { runs?: Run[] }>,
  dataThrough: Date,
): Date | undefined {
  const last = lastRunDate(years);
  if (last) return cap(last, dataThrough);
  const yearNums = Object.keys(years)
    .map(Number)
    .filter((y) => Number.isFinite(y));
  if (yearNums.length === 0) return undefined;
  return cap(new Date(Date.UTC(Math.max(...yearNums), 11, 31)), dataThrough);
}

/**
 * `lastmod` for a year archive: 31 December of that year, capped at
 * `data_through` so the in-progress year tracks the data instead of claiming a
 * date that has not happened yet.
 */
export function yearLastmod(year: number, dataThrough: Date): Date {
  return cap(new Date(Date.UTC(year, 11, 31)), dataThrough);
}
