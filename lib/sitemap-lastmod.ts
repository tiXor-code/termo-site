/**
 * Per-URL <lastmod> for the sitemap.
 *
 * Before this module every one of the ~2,350 URLs carried the same lastmod
 * (the bundle's generated_at, which moves every day the data refreshes), so
 * the sitemap told Google "everything changed today" every day. Google
 * documents that it stops trusting lastmod in exactly that pattern, which
 * costs a small site the one signal that lets crawlers skip unchanged pages
 * and spend budget on the ones it has not seen yet.
 *
 * Rules (pure functions, no data loading — see app/sitemap.ts for wiring):
 *   - entity pages (punct termic, strada): the day their last outage run
 *     ended, i.e. the last time the substance of the page changed; a page
 *     with no runs at all gets no lastmod rather than a made-up one.
 *   - a completed year's ranking: the last day of that year.
 *   - everything that presents current-year aggregates: data_through.
 */
import type { Run } from '@/lib/data';

const DAY_MS = 86_400_000;

/** ISO date (YYYY-MM-DD) for a 1-based day-of-year within `year`, UTC. */
function isoFromDoy(year: number, doy: number): string {
  return new Date(Date.UTC(year, 0, doy)).toISOString().slice(0, 10);
}

/**
 * Last day of the last outage run across all years, as YYYY-MM-DD, capped at
 * `dataThrough` (an ongoing run cannot have changed later than the data
 * itself). `null` when the entity has no runs at all.
 */
export function lastRunDate(
  years: Record<string, { runs: Run[] }>,
  dataThrough: string,
): string | null {
  let latest: string | null = null;
  for (const [y, yr] of Object.entries(years)) {
    const year = Number(y);
    if (!Number.isFinite(year)) continue;
    for (const [startDoy, lengthDays] of yr.runs) {
      const endDoy = startDoy + Math.max(lengthDays, 1) - 1;
      const iso = isoFromDoy(year, endDoy);
      if (latest === null || iso > latest) latest = iso;
    }
  }
  if (latest === null) return null;
  return latest > dataThrough ? dataThrough : latest;
}

/** Ranking pages: a finished year is frozen on its last day; the running year moves with the data. */
export function rankingLastmod(year: number, dataThrough: string): string {
  const dataYear = Number(dataThrough.slice(0, 4));
  return year < dataYear ? `${year}-12-31` : dataThrough;
}

/** Days between two ISO dates, for tests and sanity checks. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}
