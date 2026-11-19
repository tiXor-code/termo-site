import 'server-only';

import { getMeta, getPtAll, type Episode } from '@/lib/data';

/**
 * Live-ish view over a sector's episodes, computed from the nightly bundle.
 * "Ongoing" mirrors the Episode.ongoing flag Termoenergetica's announcements
 * imply at data_through — the global SourceFooter carries the staleness caveat.
 */

export interface OngoingRow {
  slug: string;
  name: string;
  streets: string[]; // first street names, for orientation ("zona")
  cause_class: Episode['cause_class'];
  start: string;
  remediere_last: string | null;
}

/**
 * One Termoenergetica announcement: the ongoing episodes that share cause,
 * start and estimated restore time. A city-wide planned shutdown flags dozens
 * of thermal points in one sector at once (90 in Sector 6 on 2026-08-17);
 * grouped, that is one line instead of ninety.
 */
export interface OngoingGroup {
  cause_class: Episode['cause_class'];
  start: string;
  remediere_last: string | null;
  /** Affected thermal points, sorted by name (numeric-aware, ro locale). */
  pts: { slug: string; name: string; streets: string[] }[];
}

/** A completed episode, kept for the recent-outages log. */
export interface RecentRow {
  slug: string;
  name: string;
  streets: string[];
  cause_class: Episode['cause_class'];
  start: string;
  end: string;
  uncertain: boolean;
}

/**
 * One Termoenergetica announcement that is over: the completed episodes that
 * share cause, start and actual end. Mirrors OngoingGroup so a city-wide
 * shutdown that ended yesterday is one line, not ninety.
 */
export interface RecentGroup {
  cause_class: Episode['cause_class'];
  start: string;
  end: string;
  /** True when any member episode has an estimated (≈) interval. */
  uncertain: boolean;
  /** Hours between start and end; null when either timestamp is unparsable. */
  durationHours: number | null;
  /** Affected thermal points, sorted by name (numeric-aware, ro locale). */
  pts: { slug: string; name: string; streets: string[] }[];
}

export interface SectorLive {
  /** Episodes still marked ongoing, avarie first, newest start first. */
  ongoing: OngoingRow[];
  /** `ongoing` collapsed per announcement, same order (avarie first, newest first). */
  groups: OngoingGroup[];
  /** Completed episodes ended in the 30 days before data_through, grouped per announcement, newest end first. */
  recent: RecentGroup[];
  /** Distinct PTs in the sector with any episode overlapping the last 30 days. */
  ptsHit30d: number;
  /** Total PTs in the sector (same universe the scan runs over). */
  ptsTotal: number;
  /** Median duration in hours of completed avarie episodes in `year`; null if none. */
  medianAvarieHours: number | null;
}

/** "2026-04-16T10:31" / "2026-04-16" → ms since epoch (naive local-as-UTC). */
function parseLocalIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
}

const DAY_MS = 86_400_000;

const nameCollator = new Intl.Collator('ro', { numeric: true, sensitivity: 'base' });

/**
 * Collapse ongoing rows into one group per (cause, start, restore) announcement.
 * Group order follows the first row seen for that key, so an avarie-first /
 * newest-first input keeps that order; PTs inside a group sort by name.
 */
export function groupOngoing(rows: OngoingRow[]): OngoingGroup[] {
  const byKey = new Map<string, OngoingGroup>();
  for (const r of rows) {
    const key = `${r.cause_class}|${r.start}|${r.remediere_last ?? ''}`;
    let g = byKey.get(key);
    if (g === undefined) {
      g = { cause_class: r.cause_class, start: r.start, remediere_last: r.remediere_last, pts: [] };
      byKey.set(key, g);
    }
    g.pts.push({ slug: r.slug, name: r.name, streets: r.streets });
  }
  const groups = [...byKey.values()];
  for (const g of groups) g.pts.sort((a, b) => nameCollator.compare(a.name, b.name));
  return groups;
}

/**
 * The recent-outages log: completed rows whose end falls at or after
 * `cutoffMs`, newest end first, collapsed into one group per (cause, start,
 * end) announcement. Rows with an unparsable end are dropped — without a
 * comparable end there is no way to know they belong in the window.
 */
export function groupRecentCompleted(rows: RecentRow[], cutoffMs: number): RecentGroup[] {
  const inWindow = rows.filter((r) => {
    const endMs = parseLocalIso(r.end);
    return endMs !== null && endMs >= cutoffMs;
  });
  inWindow.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));

  const byKey = new Map<string, RecentGroup>();
  for (const r of inWindow) {
    const key = `${r.cause_class}|${r.start}|${r.end}`;
    let g = byKey.get(key);
    if (g === undefined) {
      const startMs = parseLocalIso(r.start);
      const endMs = parseLocalIso(r.end);
      g = {
        cause_class: r.cause_class,
        start: r.start,
        end: r.end,
        uncertain: false,
        durationHours:
          startMs !== null && endMs !== null && endMs > startMs
            ? (endMs - startMs) / 3_600_000
            : null,
        pts: [],
      };
      byKey.set(key, g);
    }
    if (r.uncertain) g.uncertain = true;
    g.pts.push({ slug: r.slug, name: r.name, streets: r.streets });
  }
  const groups = [...byKey.values()];
  for (const g of groups) g.pts.sort((a, b) => nameCollator.compare(a.name, b.name));
  return groups;
}

export function getSectorLive(sector: number, avarieYear: number): SectorLive {
  const meta = getMeta();
  const dataThroughMs = parseLocalIso(meta.data_through);
  if (dataThroughMs === null) {
    throw new Error(`[lib/sector-live] unparsable data_through: ${meta.data_through}`);
  }
  const cutoffMs = dataThroughMs - 30 * DAY_MS;

  const ongoing: OngoingRow[] = [];
  const completed: RecentRow[] = [];
  const seenOngoing = new Set<string>();
  const seenCompleted = new Set<string>();
  const hit30d = new Set<string>();
  const avarieDurations: number[] = [];
  let ptsTotal = 0;

  for (const pt of getPtAll().values()) {
    if (pt.sector !== sector) continue;
    ptsTotal++;
    for (const [year, yd] of Object.entries(pt.years)) {
      for (const e of yd.episodes) {
        // An episode spanning a year boundary appears under both years —
        // dedupe by (pt, start) so it is only counted once.
        const key = `${pt.slug}|${e.start}`;
        const startMs = parseLocalIso(e.start);
        const endMs = e.end !== null ? parseLocalIso(e.end) : null;

        if (e.ongoing && !seenOngoing.has(key)) {
          seenOngoing.add(key);
          ongoing.push({
            slug: pt.slug,
            name: pt.name,
            streets: pt.streets.slice(0, 2).map((s) => s.name),
            cause_class: e.cause_class,
            start: e.start,
            remediere_last: e.remediere_last,
          });
        }

        if (!e.ongoing && e.end !== null && !seenCompleted.has(key)) {
          seenCompleted.add(key);
          completed.push({
            slug: pt.slug,
            name: pt.name,
            streets: pt.streets.slice(0, 2).map((s) => s.name),
            cause_class: e.cause_class,
            start: e.start,
            end: e.end,
            uncertain: e.uncertain,
          });
        }

        const effectiveEndMs = e.ongoing ? dataThroughMs : endMs;
        if (effectiveEndMs !== null && effectiveEndMs >= cutoffMs) {
          hit30d.add(pt.slug);
        }

        if (
          Number(year) === avarieYear &&
          e.cause_class === 'avarie' &&
          !e.ongoing &&
          startMs !== null &&
          endMs !== null &&
          endMs > startMs
        ) {
          avarieDurations.push((endMs - startMs) / 3_600_000);
        }
      }
    }
  }

  ongoing.sort((a, b) => {
    const aAvarie = a.cause_class === 'avarie' ? 0 : 1;
    const bAvarie = b.cause_class === 'avarie' ? 0 : 1;
    if (aAvarie !== bAvarie) return aAvarie - bAvarie;
    return b.start.localeCompare(a.start);
  });

  let medianAvarieHours: number | null = null;
  if (avarieDurations.length > 0) {
    avarieDurations.sort((a, b) => a - b);
    const mid = Math.floor(avarieDurations.length / 2);
    medianAvarieHours =
      avarieDurations.length % 2 === 1
        ? avarieDurations[mid]
        : (avarieDurations[mid - 1] + avarieDurations[mid]) / 2;
  }

  return {
    ongoing,
    groups: groupOngoing(ongoing),
    recent: groupRecentCompleted(completed, cutoffMs),
    ptsHit30d: hit30d.size,
    ptsTotal,
    medianAvarieHours,
  };
}
