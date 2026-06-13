// Shared e2e setup: resolves known-good slugs from the real data bundle so the
// specs never hard-code entity names.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const DATA_DIR = path.resolve('.data');

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), 'utf8')) as T;
}

function readNdjsonGz<T>(rel: string): T[] {
  const text = gunzipSync(fs.readFileSync(path.join(DATA_DIR, rel))).toString('utf8');
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as T);
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

interface StreetRecord {
  slug: string;
  name: string;
  pts: string[];
  blocks?: { label: string; pt: string }[];
}

interface PtRecord {
  slug: string;
  name: string;
  years: Record<string, { days: number }>;
}

/** A block option resolved to its serving PT's display label and lcy days. */
export interface FinderOption {
  /** The exact <option> text the BlockFinder renders: `PT <name> — <label>`. */
  optionText: string;
  /** lcy days for the serving PT — the verdict number that should appear. */
  days: number;
}

export interface FinderFixture {
  slug: string;
  ptCount: number;
  /** Two block options whose serving PTs have DIFFERENT lcy days. */
  optionA: FinderOption;
  optionB: FinderOption;
}

/**
 * Resolve, straight from the bundle, a multi-PT street whose `blocks` field maps
 * to serving PTs with at least two distinct lcy day-counts. Returns the two
 * option labels + their expected verdict numbers so the finder spec proves that
 * picking different blocks yields different verdicts. Mirrors BlockFinder's
 * option text and the page's serving-PT filter (blocks whose PT serves the street).
 */
export function finderFixture(): FinderFixture {
  const year = String(lcy());
  const pts = new Map(readNdjsonGz<PtRecord>('pt/all.ndjson.gz').map((p) => [p.slug, p]));
  const streets = readNdjsonGz<StreetRecord>('strazi/all.ndjson.gz');

  for (const st of streets) {
    if (st.pts.length < 2) continue;
    const serving = new Set(st.pts);
    const opts = (st.blocks ?? []).filter((b) => serving.has(b.pt) && pts.has(b.pt));
    if (opts.length < 2) continue;

    const toOption = (b: { label: string; pt: string }): FinderOption => {
      const pt = pts.get(b.pt)!;
      return { optionText: `PT ${pt.name} — ${b.label}`, days: pt.years[year]?.days ?? 0 };
    };
    const first = toOption(opts[0]);
    const diff = opts.map(toOption).find((o) => o.days !== first.days);
    if (!diff) continue;

    return { slug: st.slug, ptCount: st.pts.length, optionA: first, optionB: diff };
  }
  throw new Error('[e2e] no multi-PT street with distinct-day block options in the bundle');
}

/** A street served by exactly one PT — renders the verdict directly, no finder. */
export function singlePtStreet(): { slug: string; name: string } {
  const st = readNdjsonGz<StreetRecord>('strazi/all.ndjson.gz').find((s) => s.pts.length === 1);
  if (!st) throw new Error('[e2e] no single-PT street in the bundle');
  return { slug: st.slug, name: st.name };
}
