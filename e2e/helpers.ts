// Shared e2e setup: resolves known-good slugs from the real data bundle so the
// specs never hard-code entity names.
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('.data');

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), 'utf8')) as T;
}

export interface BundleMeta {
  years: number[];
  last_complete_year: number;
  partial_years: number[];
  data_through: string;
  universe_size: number;
}

interface RankingRow {
  slug: string;
  name: string;
  days: number;
}

export function bundleMeta(): BundleMeta {
  return readJson<BundleMeta>('meta.json');
}

export function lcy(): number {
  return bundleMeta().last_complete_year;
}

/** Years the site actually maps — mirrors fetch-data's non-future filter. */
export function mapYears(): number[] {
  const meta = bundleMeta();
  const dataThroughYear = Number(String(meta.data_through).slice(0, 4));
  return meta.years.filter((y) => y <= dataThroughYear);
}

export function topPt(): RankingRow {
  return readJson<RankingRow[]>(`rankings/pt-${lcy()}.json`)[0];
}

export function topStreet(): RankingRow {
  return readJson<RankingRow[]>(`rankings/strazi-${lcy()}.json`)[0];
}

export function straziCount(): number {
  return readJson<RankingRow[]>(`rankings/strazi-${lcy()}.json`).length;
}
