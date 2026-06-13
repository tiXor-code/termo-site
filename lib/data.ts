import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type * as GeoJSON from 'geojson';

// ---------------------------------------------------------------------------
// Types — mirror /Users/johnopenclaw/repos/termo-data/ARTIFACTS.md exactly.
// ---------------------------------------------------------------------------

export type CauseClass = 'avarie' | 'programat' | 'unclassified';
/**
 * Cause carried by a run. The real bundle ships a 4th class `'deficienta'`
 * (counted in `days_deficienta`, NOT in the headline `days`) that ARTIFACTS.md
 * does not list in the run examples — keep this open to plain strings so an
 * upstream rename/addition widens gracefully instead of lying about the data.
 * Only the three CauseClass values are ever painted (see lib/strip.ts).
 */
export type RunCause = CauseClass | 'deficienta' | (string & {});
export type Run = [startDoy: number, lengthDays: number, cause: RunCause]; // 1-based local DOY

export interface Meta {
  generated_at: string;
  data_through: string;
  years: number[];
  last_complete_year: number;
  partial_years: number[];
  universe_size: number;
  coverage: Record<string, { snapshots: number; missing_days: number; gap_hours_max: number }>;
  sources_cutover_utc: string;
}

export interface YearSummary {
  year: number;
  partial: boolean;
  median_pt_days: number;
  mean_pt_days: number;
  p90_pt_days: number;
  pts_hit: number;
  share_universe_hit_pct: number;
  episodes: number;
  episodes_avarie: number;
  episodes_programat: number;
  monthly_pt_days: number[]; // length 12
}

export interface Distribution {
  year: number;
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number; p99: number };
  histogram: [bucketStart: number, ptCount: number][];
}

export interface PtRankingRow {
  slug: string;
  name: string;
  sector: number;
  days: number;
  days_avarie: number;
  days_programat: number;
  days_deficienta: number;
  episodes: number;
  longest_days: number;
  est_day_eq: number;
  delta_prev: number | null;
}

export interface StreetRankingRow extends Omit<PtRankingRow, 'sector'> {
  sectors: number[];
  pt_slugs: string[];
}

export interface SectorRankingRow {
  sector: number;
  pts: number;
  median_days: number;
  mean_days: number;
  mean_days_avarie: number;
  mean_days_programat: number;
  episodes: number;
}

export interface Episode {
  start: string;
  end: string | null;
  ongoing: boolean;
  uncertain: boolean;
  cause_class: CauseClass;
  cause_raw: string;
  remediere_last: string | null;
}

export interface PtYear {
  days: number;
  days_avarie: number;
  days_programat: number;
  days_deficienta: number;
  episodes_count: number;
  longest_days: number;
  est_hours: number;
  runs: Run[];
  episodes: Episode[];
}

export interface PtEntity {
  slug: string;
  name: string;
  sector: number;
  lat: number | null;
  lon: number | null;
  on_map: boolean;
  blocks_estimate: number | null;
  streets: { slug: string; name: string }[];
  nearest: string[];
  years: Record<string, PtYear>;
}

export interface StreetYear {
  days: number;
  days_avarie: number;
  days_programat: number;
  runs: Run[];
}

export interface StreetEntity {
  slug: string;
  name: string;
  type: string;
  sectors: number[];
  pts: string[];
  /**
   * Block label → serving thermal-point (PT) slug, from the additive `blocks`
   * field on the strazi bundle. ~98% of streets carry a non-empty array; some
   * carry `[]`. Each `pt` resolves to a slug in `pt/all.ndjson.gz`. The NDJSON
   * loader passes this through verbatim (it parses whole JSON records).
   */
  blocks: { label: string; pt: string }[];
  neighbors: string[];
  years: Record<string, StreetYear>;
}

export type OgStat = [t: 'pt' | 'st', name: string, sector: number | null, daysLastComplete: number, year: number];

// ---------------------------------------------------------------------------
// Internals — sync fs, module-level memoization keyed by absolute file path.
// ---------------------------------------------------------------------------

function dataDir(): string {
  return process.env.TERMO_DATA_DIR ?? path.join(process.cwd(), '.data');
}

const jsonCache = new Map<string, unknown>();

function readJson<T>(rel: string): T {
  const file = path.join(dataDir(), rel);
  if (jsonCache.has(file)) return jsonCache.get(file) as T;
  if (!fs.existsSync(file)) {
    throw new Error(`[lib/data] missing data file: ${file}`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  jsonCache.set(file, parsed);
  return parsed;
}

const ndjsonCache = new Map<string, Map<string, unknown>>();

function readNdjsonGz<T extends { slug: string }>(rel: string): Map<string, T> {
  const file = path.join(dataDir(), rel);
  if (ndjsonCache.has(file)) return ndjsonCache.get(file) as Map<string, T>;
  if (!fs.existsSync(file)) {
    throw new Error(`[lib/data] missing data file: ${file}`);
  }
  const text = gunzipSync(fs.readFileSync(file)).toString('utf8');
  const map = new Map<string, T>();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue; // skip trailing/blank lines
    let obj: T;
    try {
      obj = JSON.parse(line) as T;
    } catch (err) {
      throw new Error(
        `[lib/data] corrupt NDJSON in ${file} at line ${i + 1}: ${(err as Error).message}`,
      );
    }
    map.set(obj.slug, obj);
  }
  ndjsonCache.set(file, map);
  return map;
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export function getMeta(): Meta {
  return readJson<Meta>('meta.json');
}

export function getYears(): number[] {
  return getMeta().years; // ascending by contract
}

export function lastCompleteYear(): number {
  return getMeta().last_complete_year;
}

export function isPartialYear(y: number): boolean {
  return getMeta().partial_years.includes(y);
}

export function getCitySummary(): YearSummary[] {
  return readJson<YearSummary[]>(path.join('city', 'summary.json'));
}

export function getYearSummary(y: number): YearSummary {
  const found = getCitySummary().find((s) => s.year === y);
  if (!found) {
    throw new Error(`[lib/data] no city summary for year ${y}`);
  }
  return found;
}

export function getDistribution(y: number): Distribution {
  return readJson<Distribution>(path.join('city', `distribution-${y}.json`));
}

export function getPtRanking(y: number): PtRankingRow[] {
  return readJson<PtRankingRow[]>(path.join('rankings', `pt-${y}.json`));
}

export function getStraziRanking(y: number): StreetRankingRow[] {
  return readJson<StreetRankingRow[]>(path.join('rankings', `strazi-${y}.json`));
}

export function getSectoareRanking(y: number): SectorRankingRow[] {
  return readJson<SectorRankingRow[]>(path.join('rankings', `sectoare-${y}.json`));
}

export function getPtAll(): Map<string, PtEntity> {
  return readNdjsonGz<PtEntity>(path.join('pt', 'all.ndjson.gz'));
}

export function getPt(slug: string): PtEntity | undefined {
  return getPtAll().get(slug);
}

export function getStradaAll(): Map<string, StreetEntity> {
  return readNdjsonGz<StreetEntity>(path.join('strazi', 'all.ndjson.gz'));
}

export function getStrada(slug: string): StreetEntity | undefined {
  return getStradaAll().get(slug);
}

const GEO_NULL = Symbol('geo-null');
const geoCache = new Map<string, GeoJSON.FeatureCollection | typeof GEO_NULL>();

/** Returns null if the file is absent or unparsable — NEVER throws. */
export function getSectoareGeo(): GeoJSON.FeatureCollection | null {
  const file = path.join(dataDir(), 'client', 'sectoare.geojson');
  const cached = geoCache.get(file);
  if (cached !== undefined) return cached === GEO_NULL ? null : cached;
  let result: GeoJSON.FeatureCollection | null = null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as GeoJSON.FeatureCollection;
    if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      result = parsed;
    }
  } catch {
    result = null;
  }
  geoCache.set(file, result ?? GEO_NULL);
  return result;
}

export function getClientManifest(): Record<string, string | null> {
  return readJson<Record<string, string | null>>('client-manifest.json');
}

/**
 * Manifest lookup; throws on miss. ('sectoare.geojson' may be null in the
 * manifest — callers that need it should null-guard via getClientManifest()
 * or getSectoareGeo() instead of calling this.)
 */
export function clientAsset(name: string): string {
  const manifest = getClientManifest();
  const value = manifest[name];
  if (value === undefined || value === null) {
    throw new Error(`[lib/data] client asset not in manifest: ${name}`);
  }
  return value;
}
