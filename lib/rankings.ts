// Pure, client-safe mapping from contract ranking rows to RankingTable view
// rows (Group B owns this file). Type-only imports keep it server-free.
import type { PtRankingRow, SectorRankingRow, StreetRankingRow } from '@/lib/data';

export interface RankingRowView {
  rank: number;
  slug: string | null;
  name: string;
  href: string;
  sectorLabel: string;
  days: number;
  days_avarie: number;
  days_programat: number;
  episodes: number;
  longest_days: number;
  delta_prev: number | null;
}

export function ptRowToView(row: PtRankingRow, rank: number): RankingRowView {
  return {
    rank,
    slug: row.slug,
    name: row.name,
    href: `/punct-termic/${row.slug}`,
    sectorLabel: String(row.sector),
    days: row.days,
    days_avarie: row.days_avarie,
    days_programat: row.days_programat,
    episodes: row.episodes,
    longest_days: row.longest_days,
    delta_prev: row.delta_prev,
  };
}

/** Streets spanning sectors get "2–3" style labels. */
export function sectorsLabel(sectors: number[]): string {
  return sectors.join('–');
}

export function streetRowToView(row: StreetRankingRow, rank: number): RankingRowView {
  return {
    rank,
    slug: row.slug,
    name: row.name,
    href: `/strada/${row.slug}`,
    sectorLabel: sectorsLabel(row.sectors),
    days: row.days,
    days_avarie: row.days_avarie,
    days_programat: row.days_programat,
    episodes: row.episodes,
    longest_days: row.longest_days,
    delta_prev: row.delta_prev,
  };
}

/**
 * Sector rows carry medians/means (means may be fractional); longest/delta do
 * not exist at sector level — RankingTable hides those columns for unit
 * 'sector'.
 */
export function sectorRowToView(row: SectorRankingRow, rank: number): RankingRowView {
  return {
    rank,
    slug: null,
    name: `Sector ${row.sector}`,
    href: `/sector/${row.sector}`,
    sectorLabel: String(row.sector),
    days: row.median_days,
    days_avarie: row.mean_days_avarie,
    days_programat: row.mean_days_programat,
    episodes: row.episodes,
    longest_days: 0,
    delta_prev: null,
  };
}
