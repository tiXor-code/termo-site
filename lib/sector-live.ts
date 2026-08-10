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

export interface SectorLive {
  /** Episodes still marked ongoing, avarie first, newest start first. */
  ongoing: OngoingRow[];
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

export function getSectorLive(sector: number, avarieYear: number): SectorLive {
  const meta = getMeta();
  const dataThroughMs = parseLocalIso(meta.data_through);
  if (dataThroughMs === null) {
    throw new Error(`[lib/sector-live] unparsable data_through: ${meta.data_through}`);
  }
  const cutoffMs = dataThroughMs - 30 * DAY_MS;

  const ongoing: OngoingRow[] = [];
  const seenOngoing = new Set<string>();
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

  return { ongoing, ptsHit30d: hit30d.size, ptsTotal, medianAvarieHours };
}
