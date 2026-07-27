/**
 * Build-time statistics for the six sector hub pages.
 *
 * Everything here is DERIVED from the published termo-data bundle (see
 * /Users/johnopenclaw/repos/termo-data/ARTIFACTS.md) at build time — no numbers
 * are stored in the repo, so every figure on a sector page is as fresh as the
 * nightly bundle. The functions are pure with respect to the loaded artifacts:
 * given the same bundle they return the same values, which is what the unit
 * tests in test/sector-stats.test.ts pin.
 *
 * Definitions used on the page (documented on /metodologie#durate-si-termene):
 *  - a resolved episode's DURATION = end − start, both naive Bucharest-local
 *    minute stamps, compared as wall-clock (so a DST boundary can shift a single
 *    episode by an hour; irrelevant at the medians we publish);
 *  - "announced deadline met" = the episode disappeared from Termoenergetica's
 *    functioning list no later than the last announced remediation hour
 *    (`remediere_last`);
 *  - PT-days per month = distinct (thermal point, calendar day) pairs, taken
 *    from the published `runs` array, `deficienta` runs excluded (they are not
 *    part of the headline day counter).
 */
import {
  getMeta,
  getPtAll,
  getPtRanking,
  getSectoareRanking,
  getStraziRanking,
  getYearSummary,
  lastCompleteYear,
  type Episode,
  type PtEntity,
  type PtRankingRow,
  type SectorRankingRow,
  type YearSummary,
} from '@/lib/data';

export const SECTORS = [1, 2, 3, 4, 5, 6] as const;

/** How many years of episodes feed the duration/deadline stats. */
export const DURATION_WINDOW_YEARS = 3;

/** How many streets / thermal points we surface as internal links. */
export const TOP_STREETS = 5;

export interface OngoingOutage {
  ptSlug: string;
  ptName: string;
  /** Naive Bucharest-local start, e.g. "2026-07-06T14:11". */
  start: string;
  causeClass: string;
  causeRaw: string;
  /** Last announced remediation hour, when Termoenergetica published one. */
  announcedEnd: string | null;
}

export interface DurationStats {
  /** Resolved episodes in the window. */
  n: number;
  medianHours: number;
  p90Hours: number;
  shareUnder24hPct: number;
  /** Of `n`, how many carried an announced remediation hour. */
  withDeadline: number;
  /** Share of those that cleared the list by the announced hour; null when none. */
  metDeadlinePct: number | null;
}

export interface MonthLoad {
  /** 1-based month. */
  month: number;
  ptDays: number;
}

export interface CityAggregate {
  /** Universe thermal points across all six sectors. */
  pts: number;
  medianDays: number;
  meanDays: number;
  meanDaysAvarie: number;
  meanDaysProgramat: number;
  episodes: number;
}

export interface TopStreet {
  slug: string;
  name: string;
  days: number;
  daysAvarie: number;
}

export interface SectorStats {
  sector: number;
  /** Last complete year — the reference year for the headline numbers. */
  year: number;
  /** Year the bundle is still filling in (may equal `year` if none is partial). */
  currentYear: number;
  /** "2026-07-11" — the bundle's data horizon. */
  dataThrough: string;
  /** Years feeding the duration/deadline stats, ascending. */
  durationWindow: number[];
  /** Complete years feeding the monthly seasonality stats, ascending. */
  monthWindow: number[];
  row: SectorRankingRow;
  currentYearRow: SectorRankingRow | null;
  city: CityAggregate;
  citySummary: YearSummary;
  /** 1 = most median days of the six sectors. */
  rankByMedianDays: number;
  ongoing: OngoingOutage[];
  avarie: DurationStats;
  programat: DurationStats;
  /** Heaviest month for opriri of any cause. */
  peakMonth: MonthLoad;
  /** Heaviest month for planned works only. */
  peakMonthProgramat: MonthLoad;
  /** Share of planned-work PT-days that fall in June–September. */
  programatSummerSharePct: number;
  topStreets: TopStreet[];
  topPts: PtRankingRow[];
}

// ---------------------------------------------------------------------------
// Pure numeric helpers (exported for unit tests).
// ---------------------------------------------------------------------------

/**
 * Naive local timestamp ("2026-07-06T14:11" or "2026-07-06") → epoch ms, the
 * fields read as if they were UTC. Both ends of an episode go through this, so
 * differences are wall-clock differences and never depend on the timezone of
 * the build machine. Returns null on anything unparsable.
 */
export function parseNaive(iso: string | null | undefined): number | null {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const t = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
  return Number.isFinite(t) ? t : null;
}

/** Median of a non-empty numeric array (mean of the two middle values when even). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest-rank percentile, `p` in [0,1]. p=0.9 over 10 values returns the 9th. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1));
  return s[idx];
}

// ---------------------------------------------------------------------------
// Episode-level derivation
// ---------------------------------------------------------------------------

interface EpisodeSample {
  hours: number;
  hadDeadline: boolean;
  metDeadline: boolean;
}

function sampleOf(ep: Episode): EpisodeSample | null {
  if (ep.ongoing) return null;
  const start = parseNaive(ep.start);
  const end = parseNaive(ep.end);
  if (start === null || end === null || end < start) return null;
  const deadline = parseNaive(ep.remediere_last);
  return {
    hours: (end - start) / 3_600_000,
    hadDeadline: deadline !== null,
    metDeadline: deadline !== null && end <= deadline,
  };
}

function durationStats(samples: EpisodeSample[]): DurationStats {
  const hours = samples.map((s) => s.hours);
  const withDeadline = samples.filter((s) => s.hadDeadline).length;
  const met = samples.filter((s) => s.hadDeadline && s.metDeadline).length;
  return {
    n: samples.length,
    medianHours: median(hours),
    p90Hours: percentile(hours, 0.9),
    shareUnder24hPct:
      hours.length === 0 ? 0 : (hours.filter((h) => h <= 24).length / hours.length) * 100,
    withDeadline,
    metDeadlinePct: withDeadline === 0 ? null : (met / withDeadline) * 100,
  };
}

/**
 * Still-open outages a thermal point carries in `year`, newest first.
 *
 * Only the bundle's `data_through` year is ever asked for: episodes are split at
 * New Year, so anything still open has a slice in that year, and a stale
 * `ongoing` flag left on an older year can never be mistaken for "right now".
 */
export function ongoingFor(pt: PtEntity, year: number): OngoingOutage[] {
  const data = pt.years[String(year)];
  if (!data) return [];
  return data.episodes
    .filter((ep) => ep.ongoing)
    .map((ep) => ({
      ptSlug: pt.slug,
      ptName: pt.name,
      start: ep.start,
      causeClass: ep.cause_class,
      causeRaw: ep.cause_raw,
      announcedEnd: ep.remediere_last,
    }))
    .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
}

/** 1-based day-of-year → 1-based month, for the given (possibly leap) year. */
function monthOfDoy(year: number, doy: number): number {
  const t = Date.UTC(year, 0, 1) + (doy - 1) * 86_400_000;
  const d = new Date(t);
  return d.getUTCFullYear() === year ? d.getUTCMonth() + 1 : 0;
}

// ---------------------------------------------------------------------------
// Heavy pass — one sweep over pt/all.ndjson.gz for all six sectors, memoized.
// ---------------------------------------------------------------------------

interface SectorPass {
  avarie: EpisodeSample[];
  programat: EpisodeSample[];
  ongoing: OngoingOutage[];
  /** PT-days per 1-based month, all opriri (deficienta excluded). */
  monthAll: number[];
  /** PT-days per 1-based month, planned works only. */
  monthProgramat: number[];
}

function emptyPass(): SectorPass {
  return {
    avarie: [],
    programat: [],
    ongoing: [],
    monthAll: Array<number>(13).fill(0),
    monthProgramat: Array<number>(13).fill(0),
  };
}

let passCache: Map<number, SectorPass> | null = null;

function sectorPasses(): Map<number, SectorPass> {
  if (passCache) return passCache;

  const meta = getMeta();
  const durationWindow = durationWindowYears();
  const monthWindow = monthWindowYears();
  const currentYear = Number(meta.data_through.slice(0, 4));

  const passes = new Map<number, SectorPass>();
  for (const s of SECTORS) passes.set(s, emptyPass());

  for (const pt of getPtAll().values()) {
    const pass = passes.get(pt.sector);
    if (!pass) continue; // standalone entities outside the six sectors

    for (const year of durationWindow) {
      const data = pt.years[String(year)];
      if (!data) continue;
      for (const ep of data.episodes) {
        const sample = sampleOf(ep);
        if (!sample) continue;
        if (ep.cause_class === 'avarie') pass.avarie.push(sample);
        else if (ep.cause_class === 'programat') pass.programat.push(sample);
      }
    }

    pass.ongoing.push(...ongoingFor(pt, currentYear));

    for (const year of monthWindow) {
      const data = pt.years[String(year)];
      if (!data) continue;
      for (const [startDoy, length, cause] of data.runs) {
        if (cause === 'deficienta') continue; // not part of the headline counter
        for (let k = 0; k < length; k++) {
          const month = monthOfDoy(year, startDoy + k);
          if (month === 0) continue; // clipped past year end
          pass.monthAll[month] += 1;
          if (cause === 'programat') pass.monthProgramat[month] += 1;
        }
      }
    }
  }

  for (const pass of passes.values()) {
    pass.ongoing.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
  }

  passCache = passes;
  return passes;
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/** Last `DURATION_WINDOW_YEARS` years present in the bundle, ascending. */
export function durationWindowYears(): number[] {
  const years = getMeta().years;
  return years.slice(Math.max(0, years.length - DURATION_WINDOW_YEARS));
}

/** Complete years only (partial years are not comparable), ascending. */
export function monthWindowYears(): number[] {
  const meta = getMeta();
  const complete = meta.years.filter((y) => !meta.partial_years.includes(y));
  return complete.length > 0 ? complete : meta.years;
}

// ---------------------------------------------------------------------------
// City aggregate — derived from the sector rows themselves so the definitions
// match column-for-column (the sector rows average over universe PTs including
// zeros; city/summary.json's pts_hit counts something else entirely).
// ---------------------------------------------------------------------------

export function cityAggregate(year: number): CityAggregate {
  const rows = getSectoareRanking(year);
  const pts = rows.reduce((a, r) => a + r.pts, 0);
  const weighted = (pick: (r: SectorRankingRow) => number) =>
    pts === 0 ? 0 : rows.reduce((a, r) => a + pick(r) * r.pts, 0) / pts;
  return {
    pts,
    medianDays: getYearSummary(year).median_pt_days,
    meanDays: weighted((r) => r.mean_days),
    meanDaysAvarie: weighted((r) => r.mean_days_avarie),
    meanDaysProgramat: weighted((r) => r.mean_days_programat),
    episodes: rows.reduce((a, r) => a + r.episodes, 0),
  };
}

function peakOf(monthly: number[]): MonthLoad {
  let month = 1;
  let ptDays = monthly[1] ?? 0;
  for (let m = 2; m <= 12; m++) {
    if ((monthly[m] ?? 0) > ptDays) {
      month = m;
      ptDays = monthly[m];
    }
  }
  return { month, ptDays };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function getSectorStats(sector: number): SectorStats {
  const meta = getMeta();
  const year = lastCompleteYear();
  const currentYear = Number(meta.data_through.slice(0, 4));

  const rows = getSectoareRanking(year);
  const row = rows.find((r) => r.sector === sector);
  if (!row) throw new Error(`[sector-stats] no sector ranking row for sector ${sector} in ${year}`);

  const currentYearRow =
    currentYear === year
      ? null
      : (getSectoareRanking(currentYear).find((r) => r.sector === sector) ?? null);

  // Rank 1 = most median days. Ties share the better (lower) rank.
  const byMedian = [...rows].sort((a, b) => b.median_days - a.median_days);
  const rankByMedianDays =
    byMedian.findIndex((r) => r.median_days === row.median_days) + 1 || rows.length;

  const pass = sectorPasses().get(sector) ?? emptyPass();

  const topStreets = getStraziRanking(year)
    .filter((s) => s.sectors.includes(sector))
    .slice(0, TOP_STREETS)
    .map((s) => ({ slug: s.slug, name: s.name, days: s.days, daysAvarie: s.days_avarie }));

  const programatTotal = pass.monthProgramat.reduce((a, b) => a + b, 0);
  const programatSummer = [6, 7, 8, 9].reduce((a, m) => a + (pass.monthProgramat[m] ?? 0), 0);

  return {
    sector,
    year,
    currentYear,
    dataThrough: meta.data_through,
    durationWindow: durationWindowYears(),
    monthWindow: monthWindowYears(),
    row,
    currentYearRow,
    city: cityAggregate(year),
    citySummary: getYearSummary(year),
    rankByMedianDays,
    ongoing: pass.ongoing,
    avarie: durationStats(pass.avarie),
    programat: durationStats(pass.programat),
    peakMonth: peakOf(pass.monthAll),
    peakMonthProgramat: peakOf(pass.monthProgramat),
    programatSummerSharePct: programatTotal === 0 ? 0 : (programatSummer / programatTotal) * 100,
    topStreets,
    topPts: getPtRanking(year)
      .filter((r) => r.sector === sector)
      .slice(0, 20),
  };
}
