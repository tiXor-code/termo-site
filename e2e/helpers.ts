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
  years: Record<string, { days: number }>;
  inferred_pt?: string | null;
  inferred_km?: number | null;
  addr?: Record<string, [number, number | null]>;
}

interface PtRecord {
  slug: string;
  name: string;
  years: Record<string, { days: number }>;
}

/** A serving PT, identified by its slug (the <option> value) and lcy days. */
export interface FinderOption {
  /** PT slug — the <option> value the BlockFinder uses. */
  ptSlug: string;
  /** lcy days for the serving PT — the verdict number that should appear. */
  days: number;
}

export interface FinderFixture {
  slug: string;
  ptCount: number;
  /** Two serving PTs (one grouped option each) with DIFFERENT lcy days. */
  optionA: FinderOption;
  optionB: FinderOption;
}

/**
 * Resolve, straight from the bundle, a multi-PT street with `blocks` (so the
 * finder renders) whose serving PTs have at least two distinct lcy day-counts.
 * The finder now lists one grouped option per PT (value = PT slug), so the spec
 * selects by slug and asserts the verdict number changes.
 */
export function finderFixture(): FinderFixture {
  const year = String(lcy());
  const pts = new Map(readNdjsonGz<PtRecord>('pt/all.ndjson.gz').map((p) => [p.slug, p]));
  const streets = readNdjsonGz<StreetRecord>('strazi/all.ndjson.gz');

  for (const st of streets) {
    if (st.pts.length < 2) continue;
    const serving = new Set(st.pts);
    // The finder only renders when there are blocks mapping to serving PTs.
    const blockPts = new Set((st.blocks ?? []).map((b) => b.pt).filter((p) => serving.has(p)));
    if (blockPts.size < 2) continue;

    const toOption = (ptSlug: string): FinderOption => ({
      ptSlug,
      days: pts.get(ptSlug)?.years[year]?.days ?? 0,
    });
    const order = st.pts.filter((p) => pts.has(p));
    const first = toOption(order[0]);
    const diff = order.map(toOption).find((o) => o.days !== first.days);
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

export interface AddressFixture {
  slug: string;
  name: string;
  pts: string[];
  /** A house number present in the street's addr map. */
  number: string;
  /** The serving PT slug that number resolves to. */
  ptSlug: string;
}

/**
 * A multi-PT street with a block finder (Case 3) AND a non-empty OSM `addr` map,
 * so a typed house number resolves to one of its serving PTs while the finder
 * still renders below. Mirrors finderFixture's "renders the BlockFinder" guard.
 */
export function addressedStreet(): AddressFixture {
  const streets = readNdjsonGz<StreetRecord>('strazi/all.ndjson.gz');
  for (const st of streets) {
    if (st.pts.length < 2 || !st.addr) continue;
    const serving = new Set(st.pts);
    const blockPts = new Set((st.blocks ?? []).map((b) => b.pt).filter((p) => serving.has(p)));
    if (blockPts.size < 2) continue; // ensures the BlockFinder renders
    const hit = Object.entries(st.addr).find(([, v]) => v[0] >= 0 && st.pts[v[0]]);
    if (!hit) continue;
    const [number, [idx]] = hit;
    return { slug: st.slug, name: st.name, pts: st.pts, number, ptSlug: st.pts[idx] };
  }
  throw new Error('[e2e] no multi-PT addressed street with a block finder in the bundle');
}

export interface InferredFixture {
  slug: string;
  name: string;
  /** The geographically-inferred serving PT slug. */
  inferredPt: string;
  /** That PT's lcy days — the estimate number the page should surface. */
  days: number;
}

/**
 * An OSM-only street CMTEB never named (empty `years`) that carries an inferred
 * serving PT — the proximity-estimate page variant. Prefers `str-dambovita`
 * (the feature's acceptance case: it resolves to `pt-desisului`) when present,
 * else the first inferred street in the bundle.
 */
export function inferredStreet(): InferredFixture {
  const year = String(lcy());
  const pts = new Map(readNdjsonGz<PtRecord>('pt/all.ndjson.gz').map((p) => [p.slug, p]));
  const streets = readNdjsonGz<StreetRecord>('strazi/all.ndjson.gz');
  const candidates = streets.filter(
    (s) => Object.keys(s.years).length === 0 && s.inferred_pt && pts.has(s.inferred_pt),
  );
  const chosen = candidates.find((s) => s.slug === 'str-dambovita') ?? candidates[0];
  if (!chosen) throw new Error('[e2e] no OSM-only street with an inferred PT in the bundle');
  return {
    slug: chosen.slug,
    name: chosen.name,
    inferredPt: chosen.inferred_pt as string,
    days: pts.get(chosen.inferred_pt as string)?.years[year]?.days ?? 0,
  };
}
