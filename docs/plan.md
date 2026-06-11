Plan read against the frozen contract (`/Users/johnopenclaw/repos/termo-data/ARTIFACTS.md`) and the design spec. Notes that shaped decisions: the real bundle has ~1050 PT entities and ~1240 streets (not the spec's 3.4k estimate); `web/` does not exist yet in termo-data, so the site must tolerate `DATA_BUNDLE_PATH` pointing at any tarball with ARTIFACTS shapes; Node on this machine is v25.8.0 / npm 11.11.0.

# Phase 3 implementation plan — /Users/johnopenclaw/repos/termo-site

## 0. Global decisions (read first, they bind all groups)

- **URL slug = registry slug verbatim**, including prefix: `/punct-termic/pt-modul-toporasi`, `/strada/sos-pantelimon`. Never strip `pt-`/type prefixes; slugs are the only stable keys.
- **Pure SSG enforcement**: every `page.tsx` exports `export const dynamic = 'error'`; every dynamic segment exports `export const dynamicParams = false` + `generateStaticParams`. The ONLY dynamic route is `app/og/[slug]/route.tsx` (`export const dynamic = 'force-dynamic'`). Do NOT enable cacheComponents/PPR experiments.
- **OG exemption implemented as one route handler**, not per-segment `opengraph-image.tsx` (a file convention inside a `dynamicParams=false` segment gets prerendered for every param = 2,300 build renders; a route handler is unambiguously exempt). Pages reference it via `openGraph.images: ['/og/<slug>']`.
- **Client JS allowed in exactly 3 components**: `SearchBox`, `RankingTable`, `MapView` (+ trivial `harta-client.tsx` wrapper). Everything else is a server component. Home page makes zero fetches at load (SearchBox fetches index on first focus only).
- **`lib/data.ts` is server-only** (`import 'server-only'` at top). Client components receive plain serializable props.
- **Romanian copy uses proper comma-below diacritics** (ș U+0219, ț U+021B) in all UI strings. Data `name` fields come diacritic-normalized from the pipeline ("Sos Pantelimon"); render them as-is, never re-diacritize.
- **Headline day counts** everywhere = oprire-ACC union days (`days`). `days_deficienta` always rendered as a visibly secondary counter, never summed into headline.

## 1. Scaffold (Group A, task A1)

Hand-write files (no interactive create-next-app). Dependencies:

```
next@latest react@latest react-dom@latest typescript @types/react @types/node
tailwindcss@^4 @tailwindcss/postcss
maplibre-gl@^5        (only imported inside MapView chunk)
server-only
devDeps: vitest @playwright/test
```

Files:

- `package.json` — scripts:
  ```json
  {
    "prebuild": "node scripts/fetch-data.mjs",
    "build": "next build",
    "dev": "next dev",
    "predev": "node scripts/fetch-data.mjs",
    "start": "next start",
    "test": "vitest run",
    "e2e": "playwright test"
  }
  ```
- `next.config.ts`:
  ```ts
  const nextConfig: NextConfig = {
    outputFileTracingIncludes: {
      '/og/[slug]': ['./.data/og/stats.json', './assets/og/**'],
    },
    async headers() {
      return [{
        source: '/data/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      }];
    },
  };
  ```
  (immutable is safe because fetch-data.mjs content-hashes every filename under public/data/)
- `postcss.config.mjs` — `{ plugins: { '@tailwindcss/postcss': {} } }`. No tailwind.config; v4 `@theme` lives in globals.css.
- `tsconfig.json` — strict, `paths: { "@/*": ["./*"] }`, `resolveJsonModule: true`.
- `.gitignore` — add `.data/`, `public/data/`, `test-results/`, `.next/`.
- `assets/og/SourceSerif4-Bold.ttf`, `assets/og/Inter-Regular.ttf` — OFL files vendored from the google/fonts repo (latin-ext build).
- `app/layout.tsx` — fonts:
  ```ts
  const serif = Source_Serif_4({ subsets: ['latin', 'latin-ext'], variable: '--font-serif-next', display: 'swap' });
  const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans-next', display: 'swap' });
  ```
  `<html lang="ro">`, body classes `bg-paper text-ink font-sans`, renders `<SiteNav />`, `{children}`, `<SourceFooter />`, and the WebSite+SearchAction JSON-LD. Root `metadata`: `metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://faraapacalda.ro')`, `title: { default: 'Fără Apă Caldă — câte zile pe an stă Bucureștiul fără apă caldă', template: '%s | Fără Apă Caldă' }`.

## 2. scripts/fetch-data.mjs (Group A, task A2)

Plain Node, no deps. Flow:

1. If `process.env.SKIP_DATA_FETCH === '1'` and `.data/meta.json` exists → exit 0.
2. Acquire tarball: `DATA_BUNDLE_PATH` (local file) else download `https://github.com/tiXor-code/termo-data/releases/download/data-latest/bundle.tar.gz` (follow redirects, 3 retries exponential backoff, fail loudly with status code).
3. `rm -rf .data && mkdir .data`, extract via `spawnSync('tar', ['-xzf', tmp, '-C', '.data'])`.
4. Validate presence, exit 1 listing anything missing: `meta.json`, `city/summary.json`, `city/distribution-{y}.json`, `rankings/{pt,strazi,sectoare}-{y}.json` for every `y` in `meta.years`, `pt/all.ndjson.gz`, `strazi/all.ndjson.gz`, `client/search-index.json`, `client/map/pt-{y}.geojson` for non-future years, `client/sectoare.geojson` (warn-only — site degrades gracefully), `og/stats.json`.
5. `rm -rf public/data && mkdir -p`. Copy with content hashing (first 8 hex of sha256) and write manifest `.data/client-manifest.json`:
   - `client/search-index.json` → `public/data/search-index.<h>.json`
   - `client/map/pt-{y}.geojson` → `public/data/map/pt-{y}.<h>.geojson`
   - `client/sectoare.geojson` → `public/data/sectoare.<h>.geojson` (if present)
   - `rankings/strazi-{y}.json` → `public/data/rankings/strazi-{y}.<h>.json` (needed for RankingTable "rest on demand"; still a contract artifact, just republished)
   - manifest shape: `{ "search-index.json": "/data/search-index.ab12cd34.json", "map/pt-2025.geojson": "/data/map/...", "rankings/strazi-2025.json": "/data/rankings/...", "sectoare.geojson": "/data/..." | null }`
6. Print summary (years, universe_size, data_through).

## 3. lib/ (Group A, task A4) — frozen API after foundation milestone

### lib/data.ts (server-only; module-level memo, sync fs + `zlib.gunzipSync`; `DATA_DIR = process.env.TERMO_DATA_DIR ?? path.join(process.cwd(), '.data')` — env override exists for test fixtures)

Types mirror ARTIFACTS.md exactly:

```ts
export type CauseClass = 'avarie' | 'programat' | 'unclassified';
export type Run = [startDoy: number, lengthDays: number, cause: CauseClass]; // 1-based local DOY

export interface Meta {
  generated_at: string; data_through: string; years: number[];
  last_complete_year: number; partial_years: number[]; universe_size: number;
  coverage: Record<string, { snapshots: number; missing_days: number; gap_hours_max: number }>;
  sources_cutover_utc: string;
}
export interface YearSummary {
  year: number; partial: boolean; median_pt_days: number; mean_pt_days: number;
  p90_pt_days: number; pts_hit: number; share_universe_hit_pct: number;
  episodes: number; episodes_avarie: number; episodes_programat: number;
  monthly_pt_days: number[]; // length 12
}
export interface Distribution {
  year: number;
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number; p99: number };
  histogram: [bucketStart: number, ptCount: number][];
}
export interface PtRankingRow {
  slug: string; name: string; sector: number; days: number; days_avarie: number;
  days_programat: number; days_deficienta: number; episodes: number;
  longest_days: number; est_day_eq: number; delta_prev: number | null;
}
export interface StreetRankingRow extends Omit<PtRankingRow, 'sector'> {
  sectors: number[]; pt_slugs: string[];
}
export interface SectorRankingRow {
  sector: number; pts: number; median_days: number; mean_days: number;
  mean_days_avarie: number; mean_days_programat: number; episodes: number;
}
export interface Episode {
  start: string; end: string | null; ongoing: boolean; uncertain: boolean;
  cause_class: CauseClass; cause_raw: string; remediere_last: string | null;
}
export interface PtYear {
  days: number; days_avarie: number; days_programat: number; days_deficienta: number;
  episodes_count: number; longest_days: number; est_hours: number;
  runs: Run[]; episodes: Episode[];
}
export interface PtEntity {
  slug: string; name: string; sector: number; lat: number | null; lon: number | null;
  on_map: boolean; blocks_estimate: number | null;
  streets: { slug: string; name: string }[]; nearest: string[];
  years: Record<string, PtYear>;
}
export interface StreetYear { days: number; days_avarie: number; days_programat: number; runs: Run[]; }
export interface StreetEntity {
  slug: string; name: string; type: string; sectors: number[];
  pts: string[]; neighbors: string[]; years: Record<string, StreetYear>;
}
export type OgStat = [t: 'pt' | 'st', name: string, sector: number | null, daysLastComplete: number, year: number];
```

Loaders (all memoized in module-level `Map`s; ndjson parsed line-by-line with try/catch that rethrows with file+line number; trailing blank lines skipped):

```ts
export function getMeta(): Meta
export function getYears(): number[]                       // meta.years ascending
export function lastCompleteYear(): number
export function isPartialYear(y: number): boolean
export function getCitySummary(): YearSummary[]
export function getYearSummary(y: number): YearSummary     // throws if absent
export function getDistribution(y: number): Distribution
export function getPtRanking(y: number): PtRankingRow[]
export function getStraziRanking(y: number): StreetRankingRow[]
export function getSectoareRanking(y: number): SectorRankingRow[]
export function getPtAll(): Map<string, PtEntity>          // from pt/all.ndjson.gz, ~1050
export function getPt(slug: string): PtEntity | undefined
export function getStradaAll(): Map<string, StreetEntity>  // ~1240
export function getStrada(slug: string): StreetEntity | undefined
export function getSectoareGeo(): GeoJSON.FeatureCollection | null  // null if file absent/unparsable — NEVER throws
export function getClientManifest(): Record<string, string | null>  // .data/client-manifest.json
export function clientAsset(name: string): string          // manifest lookup, throws on miss (except 'sectoare.geojson' → may be null-guarded by caller)
```

### lib/strip.ts (pure, client-safe, unit-tested)

```ts
export type StripSegment = { x: number; width: number; cause: CauseClass };
export function daysInYear(year: number): 365 | 366;
export function runsToSegments(runs: Run[], year: number): StripSegment[];
// paints in order unclassified → programat → avarie (avarie wins overlaps),
// clips start+len to daysInYear, returns non-overlapping segments sorted by x (x = startDoy - 1)
```

### lib/format.ts (pure, client-safe)

```ts
export function fmtInt(n: number): string                  // Intl.NumberFormat('ro-RO')
export function fmtDec(n: number, digits?: number): string // "2,1"
export function fmtZile(n: number): string                 // "1 zi" / "22 de zile" / "3 zile" (RO plural: 2-19 "zile", >=20 "de zile")
export function fmtDateRo(iso: string): string             // "16 octombrie 2025"
export function fmtDateTimeRo(iso: string): string         // "16 oct. 2025, 23:00"
export function fmtRatio(value: number, median: number): string | null // "de 2,1 ori" ; null if median === 0
export function yearLabel(y: number, meta: Meta): string   // "2026 (până la 11 iunie 2026)" for partial years
```

### lib/seo.ts (Group A creates; signatures frozen)

```ts
export function siteUrl(path: string): string
export function webSiteJsonLd(): object            // WebSite + SearchAction target `${site}/cauta?q={search_term_string}`
export function breadcrumbJsonLd(items: { name: string; href: string }[]): object
export function datasetJsonLd(meta: Meta): object  // used only on /metodologie
export function JsonLd({ data }: { data: object }): JSX.Element  // <script type="application/ld+json">
```

### lib/search.ts (Group C owns; signature agreed now)

```ts
export interface SearchEntry { t: 'pt' | 'st'; n: string; s: string; sec: number | null; d: number }
export interface PreparedEntry extends SearchEntry { nf: string }     // folded name
export function fold(s: string): string  // s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase() — handles ș/ț/ă/â/î
export function prepareIndex(entries: SearchEntry[]): PreparedEntry[]
export function scoreEntry(qf: string, nf: string): 0 | 1 | 2 | 3     // 3 full prefix, 2 word-boundary prefix, 1 substring, 0 none
export function search(prepared: PreparedEntry[], query: string, limit = 8): PreparedEntry[]  // score desc, tie → d desc; empty query → []
export function entryHref(e: SearchEntry): string  // pt → /punct-termic/{s}, st → /strada/{s}
```

## 4. Route tree (exact files, data, render/hydrate split)

| File | Params source | Artifacts read | Server renders | Hydrates |
|---|---|---|---|---|
| `app/page.tsx` | — | meta, citySummary, distribution(lcy), pt+strazi rankings(lcy) top-10, sectoare(lcy) | StatHero median sentence, MonthBars(monthly_pt_days), top-10 PT table (plain server table, NOT RankingTable), top-10 streets, sector mini-table + SectorSilhouetteMap, TrendBars(median per year) | SearchBox (hero variant) |
| `app/clasament/page.tsx` | — | 3 rankings(lcy) top-5 each | hub: three preview blocks + links to the three yearless clasament pages + year list | none |
| `app/clasament/[unitate]/page.tsx` | `['puncte-termice','strazi','sectoare']` | same as year page with `an = lastCompleteYear()` | delegates to shared `components/clasament/ClasamentPage.tsx` server component | RankingTable |
| `app/clasament/[unitate]/[an]/page.tsx` | unitate × `getYears()` (18 pages) | `rankings/{unit}-{an}.json`, distribution(an), meta | h1, context line (median, pts_hit), RankingTable; partial-year banner; year switcher links | RankingTable |
| `app/punct-termic/[slug]/page.tsx` | `[...getPtAll().keys()]` (~1050) | getPt, distributions per year, citySummary, getPtAll (nearest names) | h1+lead, StatRow (days / avarii / programate / deficiențe / est_hours / longest), per-year `<section>`: OutageStrip + EpisodeTable + CompareModule; streets served list; nearest-5 PT links; Breadcrumbs | none |
| `app/strada/[slug]/page.tsx` | `[...getStradaAll().keys()]` (~1240) | getStrada, getPtAll (serving PTs + their year days), distribution(lcy) | h1+lead, **caveat line**, per-year OutageStrip, per-PT breakdown table (each serving PT: name link, sector, days in year), CompareModule, neighbors links, Breadcrumbs | none |
| `app/sector/[id]/page.tsx` | `['1'..'6']` | sectoare rankings ALL years (trend), pt ranking(lcy) filtered by sector, sectoare.geojson | StatHero (median/mean lcy, "indicativ" footnote), SectorSilhouetteMap highlight, TrendBars (sector median per year), top-20 worst PTs table, link to clasament | none |
| `app/harta/page.tsx` + `app/harta/harta-client.tsx` | — | meta.years, manifest (geojson URLs), pt ranking(lcy) row 0 (maxDays) | shell h1 + attribution + noscript fallback link to /clasament | MapView via `next/dynamic(() => import('./harta-client'), { ssr: false })` |
| `app/metodologie/page.tsx` | — | meta (coverage table), citySummary, universe_size | full prose (section heads below), per-year coverage table (snapshots/missing_days/gap_hours_max), Dataset JSON-LD, attribution incl. ODbL for sectoare.geojson, anchors: `#surse #episoade #ce-numaram #avarii-vs-programate #strazi #limitari #verificari #citare #changelog` | none |
| `app/despre/page.tsx` | — | meta | short prose, contact, link to repo + portfolio | none |
| `app/cauta/page.tsx` | — | — | h1 + SearchBox(autoFocus, readsQueryParam) — exists to back the SearchAction target; `robots: { index: false }` | SearchBox |
| `app/og/[slug]/route.tsx` | **dynamic** | `import stats from '@/.data/og/stats.json'` (build-time inlined) + fs-read fonts from `assets/og/` | `ImageResponse` 1200×630: paper bg, accent bar in avarie red, serif bold days number, name, "zile fără apă caldă în {year}", "faraapacalda.ro" footer; 404 JSON if slug missing | n/a |
| `app/sitemap.ts` | — | meta, getPtAll, getStradaAll | ~2,330 URLs: `/`, clasament hub + 3 yearless + 18 year pages, 1050 PT, 1240 străzi, 6 sectoare, harta, metodologie, despre. `lastModified: meta.generated_at` | n/a |
| `app/robots.ts` | — | — | allow `/`, disallow `/og/` and `/cauta`, sitemap URL | n/a |
| `app/not-found.tsx` | — | — | "Pagina nu există." + SearchBox | SearchBox |

Canonical rules: `/clasament/[unitate]/[an]` where `an === lastCompleteYear()` sets `alternates.canonical` to `/clasament/[unitate]` (yearless); all other pages canonical to self.

## 5. Components (exact props)

Owned per group as listed in §9. All server unless marked client.

```ts
// components/SiteNav.tsx (server) — no props; links Acasă/Clasamente/Hartă/Metodologie/Despre + <SearchBox variant="nav" indexUrl={...} />
// components/SourceFooter.tsx (server) — no props; reads getMeta(): data_through, generated_at, source line, methodology link
// components/StatHero.tsx — { value: string; label: React.ReactNode; footnote?: React.ReactNode }
// components/StatRow.tsx — { stats: { value: string; label: string; footnoteHref?: string }[] }
// components/MethodologyFootnote.tsx — { anchor: string; children: React.ReactNode } → small-print + link /metodologie#anchor
// components/Breadcrumbs.tsx — { items: { name: string; href: string }[] } → nav + BreadcrumbList JSON-LD via lib/seo
// components/DeltaBadge.tsx — { delta: number | null; suffix?: string } → "—" | "+12 ▲" (red, worse) | "−9 ▼" (calm)
// components/OutageStrip.tsx — { year: number; runs: Run[]; ariaLabel: string; dataThroughDoy?: number; showMonthLabels?: boolean }
//   inline SVG, viewBox `0 0 ${daysInYear(year)} 14`, track rect in --color-ok, one rect per StripSegment,
//   days after dataThroughDoy in a lighter "no data" shade; month labels: ian feb mar apr mai iun iul aug sep oct noi dec
// components/MonthBars.tsx — { values: number[]; year: number; ariaLabel: string }  // 12 bars, monthly_pt_days
// components/TrendBars.tsx — { series: { label: string; value: number; partial?: boolean; href?: string }[]; unitLabel: string }
//   partial bars outlined/hatched + "*" footnote
// components/CompareModule.tsx — { value: number; percentiles: Distribution['percentiles']; median: number; year: number; entityLabel: string }
//   SVG dot strip 0..p99, ticks p10/p25/p50/p75/p90, dot at value, line via fmtRatio (omitted when median 0)
// components/EpisodeTable.tsx — { episodesByYear: { year: number; episodes: Episode[] }[]; defaultOpenYear: number }
//   <details open={year===defaultOpenYear}> per year; cols: Început (≈ prefix when uncertain) | Sfârșit ("în curs" badge when ongoing) |
//   Cauză (color badge) | Cauza raportată (cause_raw) | Restabilire estimată (remediere_last) — zero JS
// components/SectorSilhouetteMap.tsx — { values: Record<number, number>; highlight?: number; ariaLabel: string }
//   returns null when getSectoareGeo() is null; equirectangular projection fitted to viewBox 0 0 400 320,
//   <a href="/sector/N"> wrapped paths, fill = 5-step gray→#C2410C ramp over values

// CLIENT components:
// components/SearchBox.tsx ('use client') — { variant: 'hero' | 'nav'; indexUrl: string; autoFocus?: boolean; readsQueryParam?: boolean }
//   fetch(indexUrl) on first focus, module-level cache; uses lib/search; combobox/listbox a11y, arrow+enter nav, top 8,
//   result row: name + badge ("PT"|street type) + "Sector N" + "{d} zile în {an}". readsQueryParam → useSearchParams inside <Suspense>.
// components/RankingTable.tsx ('use client') — {
//   rows: RankingRowView[]; unit: 'pt' | 'strada' | 'sector'; year: number; maxDays: number;
//   totalCount: number; restUrl?: string;   // strazi: rows = top 100, restUrl = hashed /data/rankings/strazi-{y}.json, fetch+slice(100) on "Arată toate"
//   enableCauzaFilter?: boolean }            // reads ?cauza=avarii|programate via useSearchParams (in Suspense), re-sorts by that column
// interface RankingRowView { rank: number; slug: string | null; name: string; href: string; sectorLabel: string;
//   days: number; days_avarie: number; days_programat: number; episodes: number; longest_days: number; delta_prev: number | null }
//   sortable headers with aria-sort; inline two-tone data-bar (width % of maxDays, avarie+programat stacked);
//   tbody chunked into <tbody style={{contentVisibility:'auto', containIntrinsicSize:'auto 2400px'}}> groups of 50
// components/MapView.tsx ('use client', only imported from harta-client.tsx) — {
//   years: number[]; defaultYear: number; geojsonUrls: Record<string, string>; maxDays: number }
//   maplibre-gl Map, style 'https://tiles.openfreemap.org/styles/liberty', center [26.10, 44.43] zoom 11;
//   one geojson source + circle layer: radius interpolate [0..maxDays]→[3..14], color interpolate gray→#C2410C;
//   year buttons → source.setData(geojsonUrls[y]); click → popup name + "{days} zile" + <a /punct-termic/{slug}>;
//   AttributionControl (OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors); map.remove() on unmount;
//   imports 'maplibre-gl/dist/maplibre-gl.css'
```

## 6. Design system — `app/globals.css` (owned by A, frozen at foundation)

```css
@import "tailwindcss";
@theme {
  --color-paper: #FAF8F5;
  --color-ink: #1C1917;
  --color-ink-soft: #57534E;
  --color-hairline: #E7E2DA;
  --color-avarie: #C2410C;
  --color-programat: #3B5BA9;
  --color-ok: #E5E1D8;          /* strip track / zero state */
  --color-nodata: #F1EEE8;
  --color-heat-1: #E7E2DA; --color-heat-2: #E8C4AD;
  --color-heat-3: #DE9468; --color-heat-4: #CF6A33; --color-heat-5: #C2410C;
  --font-sans: var(--font-sans-next), system-ui, sans-serif;
  --font-display: var(--font-serif-next), Georgia, serif;
}
/* utilities */
.tnum { font-variant-numeric: tabular-nums; }
.hairline-b { border-bottom: 1px solid var(--color-hairline); }
.display-num { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.01em; }
```

Rules: no shadows, no cards, no rounded boxes; hairline `border-hairline` rules between sections and table rows; display numbers in Source Serif 4 bold; all tables `font-sans tnum`; links underlined on hover only; max content width `max-w-4xl` (clasament `max-w-5xl`).

## 7. Romanian copy block (canonical strings — paste verbatim, `{x}` are interpolations)

```
hero.median        = "Jumătate din punctele termice din București au avut cel puțin {N} zile cu întreruperi de apă caldă în {an}."
hero.sub           = "Date reconstruite din anunțurile publice Termoenergetica, decembrie 2021 – {data_through}. Acoperă zonele deservite de sistemul centralizat de termoficare."
search.placeholder = "Caută strada sau punctul termic…"
search.empty       = "Niciun rezultat pentru „{q}". Verifică ortografia — căutarea funcționează și fără diacritice."
strada.caveat      = "Termoenergetica raportează întreruperile la nivel de punct termic, nu de stradă. Zilele afișate pentru această stradă sunt reuniunea zilelor punctelor termice care o deservesc — defalcarea pe puncte termice este mai jos."
pt.lead            = "{Name} (Sector {N}) a avut {days} zile cu întreruperi de apă caldă în {an}: {days_avarie} din avarii și {days_programat} din lucrări programate."
pt.zero            = "Fără întreruperi înregistrate în {an}."
counting.footnote  = "O „zi cu întrerupere" = o zi calendaristică atinsă de cel puțin un episod de oprire a apei calde (avarie sau lucrare programată). Deficiențele (presiune sau temperatură scăzută) se numără separat și nu intră în indicatorul principal."
deficienta.label   = "zile cu deficiențe (presiune/temperatură) — numărate separat"
partial.label      = "{an} (până la {data})"
partial.banner     = "An incomplet: date până la {data}. Comparațiile cu alți ani se fac doar pe perioade echivalente."
episode.ongoing    = "în curs"
episode.uncertain  = "≈ interval estimat — sursa a avut o pauză de colectare în timpul episodului."
compare.ratio      = "de {ratio} ori mediana orașului ({median_zile})"
sector.indicativ   = "Medii pe toate punctele termice din sector, inclusiv cele fără întreruperi — valori indicative."
delta.none         = "—"
nav                = "Acasă | Clasamente | Hartă | Metodologie | Despre"
home.h.pt          = "Cele mai afectate puncte termice"
home.h.strazi      = "Cele mai afectate străzi"
home.h.sectoare    = "Pe sectoare"
home.h.trend       = "Evoluție pe ani"
clasament.h1.pt    = "Clasamentul punctelor termice — {an}"
clasament.h1.strazi= "Clasamentul străzilor — {an}"
clasament.h1.sect  = "Sectoare — {an}"
clasament.context  = "{pts_hit} din {universe} puncte termice au avut cel puțin o zi cu întreruperi în {an}; mediana: {median} zile."
table.cols         = "Loc | Punct termic / Stradă / Sector | Sector | Zile fără apă caldă | din care avarii | din care programate | Episoade | Cel mai lung episod | față de {an_prev}"
table.showAll      = "Arată toate cele {N} străzi"
strada.breakdown.h = "Punctele termice care deservesc strada"
pt.streets.h       = "Străzi deservite"
pt.nearest.h       = "Puncte termice apropiate"
strada.neighbors.h = "Străzi învecinate (același punct termic)"
harta.h1           = "Harta punctelor termice"
harta.note         = "Culoarea și mărimea punctelor = zile fără apă caldă în {an}. Hartă: OpenFreeMap · © OpenMapTiles · © contribuitorii OpenStreetMap."
metodologie.heads  = "Surse de date | Cum reconstruim episoadele | Ce numărăm | Avarii vs lucrări programate | De ce punctul termic, nu strada | Limitări | Verificări încrucișate (PMB, ANRE, Wayback) | Cum citați aceste date | Istoric modificări"
citare             = "Fără Apă Caldă (faraapacalda.ro), pe baza anunțurilor publice Termoenergetica (cmteb.ro), decembrie 2021 – {an}."
footer.line        = "Date: anunțuri publice Termoenergetica (cmteb.ro), arhivate și reconstruite independent. Ultima actualizare: {data_through}. Surse și atribuire: vezi metodologia."
notfound           = "Pagina nu există. Caută strada sau punctul termic:"
estore             = "≈ {n} ore estimate"
```

## 8. SEO

- Street title: `Apă caldă pe {Name}, Sector {N} | zile cu întreruperi {firstYear}–{lastYear}` (multi-sector: "Sectoarele 2 și 3"). Description with real numbers: `"{Name} a avut {days} zile cu întreruperi de apă caldă în {an}, din care {days_avarie} din avarii. Istoric complet {firstYear}–{lastYear}, pe punct termic."`
- PT title: `{Name} — punct termic, Sector {N} | {days} zile fără apă caldă în {an}`.
- Clasament year pages: `Clasamentul punctelor termice după zile fără apă caldă — {an}`.
- JSON-LD: WebSite+SearchAction in layout; BreadcrumbList in Breadcrumbs (home → sector → PT; home → strada); Dataset only on /metodologie (temporalCoverage `2021-12/{data_through}`, distribution → the GitHub release bundle URL, isBasedOn cmteb.ro).
- `openGraph.images: [siteUrl('/og/' + slug)]` on PT + street pages; static default OG (`app/opengraph-image.png`, designed once) for everything else.
- Internal mesh (the ≤3-clicks rule): PT page links nearest-5 + its streets + sector hub; street links serving PTs + 8 neighbors + sector hubs; sector links top-20 PTs + clasament; home links all hubs.

## 9. Ordered task list, 3-agent split, shared-file rules

### Foundation (Group A, strictly serial, everything else blocks on it)

1. **A1** Scaffold: `package.json`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `.gitignore`, `assets/og/*.ttf`, install deps.
2. **A2** `scripts/fetch-data.mjs`; run once against the real bundle (`DATA_BUNDLE_PATH`) and commit nothing from `.data/`.
3. **A3** `app/globals.css` (tokens above), `app/layout.tsx` (fonts, nav, footer, WebSite JSON-LD), `components/SiteNav.tsx`, `components/SourceFooter.tsx`, **stub** `components/SearchBox.tsx` (static input, real props interface, no logic).
4. **A4** `lib/data.ts`, `lib/format.ts`, `lib/strip.ts`, `lib/seo.ts`, `vitest.config.ts`, `test/fixtures/data/` (tiny hand-written bundle, 2 PTs / 2 streets / 2 years, ARTIFACTS shapes), `test/data.test.ts`, `test/strip.test.ts`, `test/format.test.ts`.
5. **A5** Shared server components: `StatHero`, `StatRow`, `MethodologyFootnote`, `Breadcrumbs`, `DeltaBadge`, `OutageStrip`, `MonthBars`, `TrendBars`. `playwright.config.ts` (webServer: build+start with `SKIP_DATA_FETCH=1` after an explicit fetch step).

**→ FOUNDATION MILESTONE: commit + tag. B and C start in parallel from here. After this point globals.css, layout.tsx, next.config.ts, package.json, lib/data|format|strip|seo.ts are FROZEN — B/C may not edit them. New helpers go in NEW lib files owned by their group.**

### Parallel phase

**Group A (continues):**
- A6 `app/page.tsx` (home), `app/not-found.tsx`, `e2e/home.spec.ts`.

**Group B — clasament + sector + harta:**
- B1 `components/RankingTable.tsx` (+ `lib/rankings.ts` if helpers needed — B-owned file).
- B2 `components/clasament/ClasamentPage.tsx` (shared server renderer) + `app/clasament/page.tsx` + `app/clasament/[unitate]/page.tsx` + `app/clasament/[unitate]/[an]/page.tsx` (canonical rules, partial banner, `?cauza=` filter).
- B3 `components/SectorSilhouetteMap.tsx` + `app/sector/[id]/page.tsx`.
- B4 `app/harta/page.tsx` + `app/harta/harta-client.tsx` + `components/MapView.tsx`.
- B5 `e2e/clasament-harta.spec.ts`.

**Group C — detail pages + search + prose + SEO:**
- C1 `lib/search.ts` + replace stub `components/SearchBox.tsx` (C owns the file from here) + `test/search.test.ts` + `app/cauta/page.tsx`.
- C2 `components/EpisodeTable.tsx`, `components/CompareModule.tsx`, `app/punct-termic/[slug]/page.tsx`.
- C3 `app/strada/[slug]/page.tsx`.
- C4 `app/metodologie/page.tsx` (counting rules wording must match pipeline docs verbatim), `app/despre/page.tsx`.
- C5 `app/sitemap.ts`, `app/robots.ts`, `app/og/[slug]/route.tsx`, `app/opengraph-image.png`, per-route metadata audit (C may add `lib/seo-meta.ts` for title builders — C-owned).
- C6 `e2e/detail-seo.spec.ts`.

### Integration (Group A)
- A7 Merge B then C; `npm run test`; `npm run build` — assert build output: every page `●` (SSG), only `/og/[slug]` dynamic; route-level first-load JS < 95KB; `npm run e2e`. Fix conflicts (A is the only group allowed to touch frozen files during integration).

### Shared-file ownership matrix

| File | Owner | B/C policy |
|---|---|---|
| `app/globals.css`, `app/layout.tsx`, `next.config.ts`, `package.json`, `postcss.config.mjs`, `tsconfig.json` | A | read-only after foundation; token/dep additions only via A |
| `lib/data.ts`, `lib/format.ts`, `lib/strip.ts`, `lib/seo.ts` | A | read-only; new helpers → new group-owned lib files |
| `components/SearchBox.tsx` | A stub → C | C replaces wholesale; A/B import only |
| `components/RankingTable.tsx`, `MapView`, `SectorSilhouetteMap`, `clasament/*` | B | C never imports/edits |
| `components/EpisodeTable.tsx`, `CompareModule`, `app/sitemap.ts`, `app/robots.ts`, `app/og/**` | C | B never edits |
| `e2e/*` | one spec file per group, no shared spec | `playwright.config.ts` owned by A |
| maplibre-gl dep | pre-installed by A1 | nobody runs `npm install` after foundation |

## 10. Tests (concrete list)

**Vitest** (run against `test/fixtures/data` via `TERMO_DATA_DIR`):
1. `data.test.ts` — meta years ascending; `lastCompleteYear`; pt ranking sorted days desc; `getPtAll()` returns Map keyed by slug with parsed runs/episodes; ndjson tolerates trailing newline; corrupt line throws with file+line; missing distribution file throws with path; `getSectoareGeo()` returns null when file absent (no throw); `clientAsset` throws on unknown key.
2. `strip.test.ts` — `[114,142,'programat']` → `{x:113,width:142}`; run overflowing year end clipped; leap year 366 (2024); avarie overlap wins over programat; empty runs → []; 1-day run width 1.
3. `format.test.ts` — `fmtDec(2.1)` = "2,1"; `fmtZile(1)`="1 zi", `fmtZile(3)`="3 zile", `fmtZile(22)`="22 de zile"; `fmtRatio(44,22)`="de 2,0 ori", `fmtRatio(5,0)`=null; `yearLabel` partial vs complete.
4. `search.test.ts` — `fold("Șoseaua Olteniței")`="soseaua oltenitei"; prefix(3) > word-boundary(2) > substring(1); tie broken by `d` desc; query "oltenitei" finds entry named "Șoseaua Olteniței"; empty/whitespace query → []; limit respected; `entryHref` for both types.

**Playwright** (`e2e/`, against real bundle build; known slugs resolved in a setup helper that reads `.data/rankings/pt-{lcy}.json[0]` and `strazi-{lcy}.json[0]`):
1. home: hero contains "Jumătate din punctele termice" + a digit; nav search input present; no `fetch` to /data on load (route interception assert).
2. `/clasament/puncte-termice/{lcy}`: >100 `tbody tr`; row1 days ≥ row2 days; clicking "din care avarii" header re-sorts (aria-sort flips).
3. `/clasament/puncte-termice` (yearless): h1 contains `{lcy}`, `link[rel=canonical]` is the yearless URL.
4. `/clasament/strazi/{lcy}`: exactly 100 rows SSR; "Arată toate" click → row count grows past 100.
5. `/punct-termic/{topSlug}`: page shows the ranking row's `days` number and an `svg` OutageStrip; breadcrumb JSON-LD script present.
6. `/strada/{topStreetSlug}`: caveat text "la nivel de punct termic" present; per-PT breakdown table has ≥1 linked PT.
7. `/sector/4`: median stat + TrendBars svg.
8. `/harta`: maplibre container div mounts (don't assert tiles); year buttons present.
9. `/metodologie`: "Cum reconstruim episoadele" heading + `script[type="application/ld+json"]` containing `"Dataset"`.
10. `/og/{topSlug}`: 200, content-type image/png; `/og/nu-exista-xyz`: 404.
11. `/sitemap.xml`: 200, contains `/strada/` and `/punct-termic/` URLs.
12. `/punct-termic/slug-inexistent`: 404 page with search box.

## 11. Edge cases (implementers must handle, several are test-visible)

- **PT/street missing a year** in `years` (entity existed only some years): detail page renders the year section with `pt.zero` copy + empty strip + CompareModule(value 0); never crash on `years[String(y)] === undefined`.
- **Partial years** (2021, 2026): `partial.label` everywhere a year is named; TrendBars hatched; `delta_prev` already null from pipeline → DeltaBadge "—"; current-year OutageStrip gets `dataThroughDoy` computed from `meta.data_through` and grays the remainder.
- **Overlapping runs** (same day avarie + programat): strip shows avarie; `days_avarie + days_programat` may exceed `days` — never display a computed sum, always use `days` for the headline and label the splits "din care".
- **`days_deficienta`** never added to anything; render with `deficienta.label`.
- **median 0** in CompareModule → omit ratio line (fmtRatio null).
- **Streets spanning sectors**: `sectorLabel` = "2–3"; ranking rows use `sectors[]` joined.
- **`remediere_last` / `end` null**; `ongoing` → "în curs" badge; `uncertain` → "≈" + footnote.
- **`sectoare.geojson` absent** → SectorSilhouetteMap returns null; home/sector pages must read fine without it (warn at fetch-data time only).
- **og/stats.json miss** → 404 from OG route; pages only emit `openGraph.images` when the slug exists in `getOgStats()` — actually always emit; the route 404s harmlessly for stragglers.
- **Search index entries with `d: 0`** still listed; `sec` null (multi-sector streets) → omit "Sector N" chip.
- **Slugs are ASCII** by contract — no encoding needed in hrefs/sitemap.
- **Coverage keys are strings** in `meta.coverage`; index with `String(year)`.
- **ndjson.gz**: gunzipSync, split `\n`, skip empty lines, per-line JSON.parse wrapped with line-number error.
- **Vercel**: project root = termo-site; `prebuild` does the single bundle HTTP call; nightly deploy hook from termo-data triggers rebuild; OG route needs `outputFileTracingIncludes` (already in next.config) or fonts/stats go missing in the lambda.