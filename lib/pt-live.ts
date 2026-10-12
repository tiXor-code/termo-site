import type { Episode, PtYear } from "@/lib/data";

/**
 * The interruptions a thermal point is still marked as being under, as of the
 * bundle's last snapshot.
 *
 * This is the question the site was being asked and not answering: six of the
 * eleven written feedback messages are some form of "cand revine apa calda la
 * blocul meu". CMTEB publishes an estimated restore time and a cause, the
 * scraper has always parsed both (`remediere_last`, `cause_raw`), and they
 * already ship in every Episode - they were simply only ever rendered on
 * /sector/N pages, which is not where those people landed.
 *
 * Deficiency episodes are deliberately excluded: degraded pressure or
 * temperature is not a stoppage, and conflating them is the exact error the
 * headline metric is careful to avoid.
 */
export interface OngoingEpisode {
  start: string;
  cause_class: Episode["cause_class"];
  cause_raw: string;
  /** CMTEB's estimated restore datetime; null when the announcement omits it. */
  remediere_last: string | null;
}

export function ongoingForPt(years: Record<string, PtYear>): OngoingEpisode[] {
  const out: OngoingEpisode[] = [];
  const seen = new Set<string>();

  for (const yd of Object.values(years ?? {})) {
    // Defensive: an older bundle (or a deficiency-only year) may carry no
    // `episodes` array, and this renders across ~1,200 static pages.
    for (const e of yd?.episodes ?? []) {
      if (!e.ongoing) continue;
      // An episode spanning a year boundary is published under both years.
      if (seen.has(e.start)) continue;
      seen.add(e.start);
      out.push({
        start: e.start,
        cause_class: e.cause_class,
        cause_raw: e.cause_raw,
        remediere_last: e.remediere_last,
      });
    }
  }

  // Avarie before programat (an unplanned outage is the more urgent answer),
  // then newest first - same ordering the sector pages use.
  out.sort((a, b) => {
    const aAvarie = a.cause_class === "avarie" ? 0 : 1;
    const bAvarie = b.cause_class === "avarie" ? 0 : 1;
    if (aAvarie !== bAvarie) return aAvarie - bAvarie;
    return b.start.localeCompare(a.start);
  });

  return out;
}

/** "2026-09-04T23:00" / "2026-09-04" -> UTC ms, treating the naive value as UTC. */
function parseDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * A short human qualifier for an estimated restore time, relative to the
 * bundle's snapshot date.
 *
 * Absolute datetimes alone read identically whether the estimate is tonight or
 * four weeks out, which is precisely the distinction someone without hot water
 * cares about. "termen depășit" matters most: an estimate that has already
 * passed while the outage is still flagged ongoing is real, common, and
 * invisible unless the page says it.
 *
 * Returns null on unparsable input so the caller falls back to the plain date.
 */
export function restoreQualifier(remediere: string, dataThrough: string): string | null {
  const a = parseDay(remediere);
  const b = parseDay(dataThrough);
  if (a === null || b === null) return null;
  const days = Math.round((a - b) / 86_400_000);
  if (days < 0) return 'termen depășit';
  if (days === 0) return 'azi';
  if (days === 1) return 'mâine';
  // Romanian needs "de" from 20 upward: 3 zile, but 27 de zile.
  return days >= 20 ? `peste ${days} de zile` : `peste ${days} zile`;
}
