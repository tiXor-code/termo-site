import type { Metadata } from 'next';
import Link from 'next/link';
import BlockFinder, { type BlockFinderPt } from '@/components/BlockFinder';
import Breadcrumbs from '@/components/Breadcrumbs';
import CompareModule from '@/components/CompareModule';
import EpisodeTable from '@/components/EpisodeTable';
import OutageStrip from '@/components/OutageStrip';
import RenterTip from '@/components/RenterTip';
import VerdictBand from '@/components/VerdictBand';
import {
  getDistribution,
  getMeta,
  getPtAll,
  getStrada,
  getStradaAll,
  getYearSummary,
  isPartialYear,
  lastCompleteYear,
  type PtEntity,
  type StreetYear,
} from '@/lib/data';
import { fmtInt, fmtZile, yearLabel } from '@/lib/format';
import { siteUrl } from '@/lib/seo';
import { gradeFor } from '@/lib/verdict';
import { sectorsPhrase, streetDescription, streetTitle } from '@/lib/seo-meta';

export const dynamic = 'error';
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return [...getStradaAll().keys()].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const street = getStrada(slug);
  if (!street) return {};
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const firstYear = meta.years[0];
  const lastYear = meta.years[meta.years.length - 1];
  // OSM-only streets (no real outage data) carry an estimated PT - noindex
  // them so we don't flood the index with thin/estimated pages; still findable
  // via on-site search.
  const noData = Object.keys(street.years).length === 0;
  return {
    title: streetTitle(street, firstYear, lastYear),
    description: streetDescription(street, lcy, firstYear, lastYear),
    alternates: { canonical: `/strada/${slug}` },
    openGraph: { images: [siteUrl(`/og/${slug}`)] },
    ...(noData ? { robots: { index: false, follow: true } } : {}),
  };
}

const EMPTY_YEAR: StreetYear = { days: 0, days_avarie: 0, days_programat: 0, runs: [] };

function dataThroughDoy(dataThrough: string, year: number): number | undefined {
  if (Number(dataThrough.slice(0, 4)) !== year) return undefined;
  const [y, m, d] = dataThrough.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

/** A serving PT's history (year-by-year OutageStrips), reusing the existing strip. */
function PtHistory({
  pt,
  street,
  yearsDesc,
  dataThrough,
}: {
  pt: PtEntity;
  street: string;
  yearsDesc: number[];
  dataThrough: string;
}) {
  // Detailed episode log (cause, start, end, duration) for this block's PT.
  // Inline we show the CURRENT year (what a renter cares about right now) and
  // link to the PT page for the full multi-year log - rendering every year for
  // every serving PT would bloat mega-streets (26 PTs) into multi-MB pages.
  const curYear = yearsDesc[0];
  const curEpisodes = pt.years[String(curYear)]?.episodes ?? [];
  const episodeYears = curEpisodes.length > 0 ? [{ year: curYear, episodes: curEpisodes }] : [];
  const defaultOpenYear = curYear;
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-bold">
        Istoric — {pt.name} (blocul tău)
      </h2>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--color-avarie)' }} />
          Avarii (defecțiuni)
        </span>
        <span>
          <i style={{ background: 'var(--color-programat)' }} />
          Lucrări programate
        </span>
        <span>
          <i style={{ background: 'var(--color-ok)' }} />A avut apă caldă
        </span>
      </div>
      {yearsDesc.map((year, i) => {
        const yd = pt.years[String(year)];
        const days = yd?.days ?? 0;
        return (
          <div key={year} className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-bold tnum">{year}</span>
              <span className="tnum text-sm text-ink-soft">
                {days > 0 ? fmtZile(days) : 'fără întreruperi'}
              </span>
            </div>
            <div className="mt-2">
              <OutageStrip
                year={year}
                runs={yd?.runs ?? []}
                ariaLabel={`Calendarul întreruperilor la ${pt.name} (${street}) în ${year}`}
                dataThroughDoy={dataThroughDoy(dataThrough, year)}
                showMonthLabels={i === 0}
              />
            </div>
          </div>
        );
      })}
      {episodeYears.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-display text-lg font-bold">
            Ce s-a întâmplat, episod cu episod
          </h3>
          <EpisodeTable episodesByYear={episodeYears} defaultOpenYear={defaultOpenYear} />
        </div>
      )}
      <p className="mt-4">
        <Link href={`/punct-termic/${pt.slug}`} className="more">
          Vezi toate episoadele (toți anii) pentru {pt.name} →
        </Link>
      </p>
    </section>
  );
}

export default async function StradaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const street = getStrada(slug);
  if (!street) throw new Error(`unknown street slug at build time: ${slug}`);
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const lcyPartial = isPartialYear(lcy);
  const cityMedian = getYearSummary(lcy).median_pt_days;
  const ptAll = getPtAll();

  const yearsDesc = [...meta.years].sort((a, b) => b - a);
  const lcyData = street.years[String(lcy)] ?? EMPTY_YEAR;
  const distribution = getDistribution(lcy);

  // Resolve serving PTs in the street's listed order; days = the renter-facing
  // last-complete-year number for that PT (NOT the street-wide union).
  const servingPts = street.pts
    .map((ptSlug) => ptAll.get(ptSlug))
    .filter((pt): pt is PtEntity => pt !== undefined)
    .map((pt) => {
      const days = pt.years[String(lcy)]?.days ?? 0;
      return { pt, days, ...gradeFor(days) };
    });

  // Deploy-order safety: the bundle's `blocks` field may be absent on an older
  // release. Treat undefined as [] and only keep blocks whose PT actually
  // serves this street (resolves to a rendered panel).
  const servingSet = new Set(servingPts.map((s) => s.pt.slug));
  const blocks = (street.blocks ?? []).filter((b) => servingSet.has(b.pt));

  const head = (
    <>
      <Breadcrumbs
        items={[
          { name: 'Acasă', href: '/' },
          { name: 'Străzi', href: '/clasament/strazi' },
          { name: street.name, href: `/strada/${slug}` },
        ]}
      />
      <h1 className="mt-6 font-display text-3xl font-bold">{street.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">{sectorsPhrase(street.sectors)} · București</p>
    </>
  );

  // The street-wide union disclosure — demoted to a collapsible "evidence"
  // block, never the headline. Holds the existing per-year strips + compare.
  const unionDisclosure = (
    <details className="mt-10 border-t border-hairline pt-6">
      <summary className="cursor-pointer font-display text-lg font-bold">
        Cumulat pe toată strada ({fmtZile(lcyData.days)}) și de ce e înșelător
      </summary>
      <div className="mt-4">
        <p className="max-w-2xl border-l-2 border-hairline pl-3 text-sm text-ink-soft">
          Termoenergetica raportează întreruperile la nivel de punct termic, nu de stradă. Cele{' '}
          {fmtZile(lcyData.days)} de mai sus sunt reuniunea zilelor tuturor punctelor termice care
          deservesc strada — niciun apartament nu le-a trăit pe toate. Numărul real pentru blocul
          tău este cel de la punctul termic care îl deservește, ales mai sus.
        </p>

        {yearsDesc.map((year, i) => {
          const data = street.years[String(year)] ?? EMPTY_YEAR;
          return (
            <section key={year} className="mt-6">
              <h3 className="flex items-baseline gap-x-3 text-sm">
                <span className="font-display text-lg font-bold">{yearLabel(year, meta)}</span>
                <span className="tnum text-ink-soft">
                  {data.days > 0 ? fmtZile(data.days) : 'fără întreruperi'}
                </span>
              </h3>
              <div className="mt-2">
                <OutageStrip
                  year={year}
                  runs={data.runs}
                  ariaLabel={`Calendarul întreruperilor pe ${street.name} în ${year}`}
                  dataThroughDoy={dataThroughDoy(meta.data_through, year)}
                  showMonthLabels={i === 0}
                />
              </div>
            </section>
          );
        })}

        <section className="mt-8">
          <h3 className="font-display text-lg font-bold">Față de oraș — {yearLabel(lcy, meta)}</h3>
          <div className="mt-4">
            <CompareModule
              value={lcyData.days}
              percentiles={distribution.percentiles}
              median={distribution.percentiles.p50}
              year={lcy}
              entityLabel={street.name}
            />
          </div>
        </section>

        {servingPts.length > 0 && (
          <section className="mt-8">
            <h3 className="font-display text-lg font-bold">
              Punctele termice care deservesc strada
            </h3>
            <table className="mt-3 w-full max-w-xl border-collapse text-sm tnum">
              <thead>
                <tr className="hairline-b text-left text-xs text-ink-soft">
                  <th scope="col" className="py-2 pr-3 font-normal">Punct termic</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Sector</th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Zile fără apă caldă în {lcy}
                  </th>
                </tr>
              </thead>
              <tbody>
                {servingPts.map((s) => (
                  <tr key={s.pt.slug} className="hairline-b">
                    <td className="py-2 pr-3 font-sans">
                      <Link href={`/punct-termic/${s.pt.slug}`} className="hover:underline">
                        {s.pt.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{s.pt.sector}</td>
                    <td className="py-2 text-right">{fmtInt(s.days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </details>
  );

  const neighborsSection = street.neighbors.length > 0 && (
    <section className="mt-12 border-t border-hairline pt-6">
      <h2 className="font-display text-xl font-bold">
        Străzi învecinate (același punct termic)
      </h2>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {street.neighbors.map((neighborSlug) => {
          const neighbor = getStradaAll().get(neighborSlug);
          if (!neighbor) return null;
          return (
            <li key={neighborSlug}>
              <Link href={`/strada/${neighborSlug}`} className="hover:underline">
                {neighbor.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );

  // -------------------------------------------------------------------------
  // Case 0 — OSM street CMTEB never named, but we inferred a serving PT:
  // show that PT's real history, clearly framed as a proximity ESTIMATE.
  // -------------------------------------------------------------------------
  const inferredPt = street.inferred_pt ? ptAll.get(street.inferred_pt) : undefined;
  if (servingPts.length === 0 && inferredPt) {
    const iDays = inferredPt.years[String(lcy)]?.days ?? 0;
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {head}
        <p className="mt-5 border border-hairline bg-paper-2 p-4 text-sm leading-snug">
          <b>{street.name}</b> nu apare direct în anunțurile Termoenergetica. Zona e deservită{' '}
          <b>probabil</b> de punctul termic{' '}
          <Link href={`/punct-termic/${inferredPt.slug}`} className="underline">
            {inferredPt.name}
          </Link>{' '}
          (estimare după proximitate{street.inferred_km ? `, ~${street.inferred_km} km` : ''}).
          Cifrele de mai jos sunt ale acelui punct termic.
        </p>
        <VerdictBand
          days={iDays}
          year={lcy}
          name={`PT ${inferredPt.name}`}
          scope="block"
          cityMedian={cityMedian}
          partial={lcyPartial}
        />
        <RenterTip grade={gradeFor(iDays).key} />
        <PtHistory
          pt={inferredPt}
          street={street.name}
          yearsDesc={yearsDesc}
          dataThrough={meta.data_through}
        />
        <p className="mt-6 text-sm">
          <Link href={`/punct-termic/${inferredPt.slug}`} className="more">
            Vezi punctul termic {inferredPt.name} →
          </Link>
        </p>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Case 1 — no serving PT and no inference: street not in CMTEB's data.
  // -------------------------------------------------------------------------
  if (servingPts.length === 0) {
    const noData = Object.keys(street.years).length === 0;
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {head}
        <p className="mt-3 max-w-2xl text-lg leading-snug">
          {noData
            ? `${street.name} nu apare în anunțurile publice Termoenergetica. Vezi harta sau punctele termice din zonă.`
            : lcyData.days > 0
              ? `${street.name} a avut ${fmtZile(lcyData.days)} cu întreruperi de apă caldă în ${lcy}.`
              : `Fără întreruperi înregistrate în ${lcy}.`}
        </p>
        {!noData && unionDisclosure}
        {neighborsSection}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Case 2 — single serving PT (or no blocks): render the verdict directly,
  // no finder. The street IS one zone.
  // -------------------------------------------------------------------------
  if (servingPts.length === 1 || blocks.length === 0) {
    const repr = pickRepresentative(servingPts);
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {head}
        <VerdictBand
          days={repr.days}
          year={lcy}
          name={`PT ${repr.pt.name}`}
          scope="block"
          cityMedian={cityMedian}
          partial={lcyPartial}
        />
        <RenterTip grade={repr.key} />
        <PtHistory
          pt={repr.pt}
          street={street.name}
          yearsDesc={yearsDesc}
          dataThrough={meta.data_through}
        />
        {servingPts.length > 1 && (
          <ServingPtList servingPts={servingPts} lcy={lcy} />
        )}
        {unionDisclosure}
        {neighborsSection}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Case 3 — multiple serving PTs + non-empty blocks: block finder.
  // -------------------------------------------------------------------------
  const repr = pickRepresentative(servingPts);
  const daysList = servingPts.map((s) => s.days);
  const spreadMin = Math.min(...daysList);
  const spreadMax = Math.max(...daysList);

  const finderPts: BlockFinderPt[] = servingPts.map((s) => ({
    ptSlug: s.pt.slug,
    name: `PT ${s.pt.name}`,
    days: s.days,
    grade: s.key,
    panel: (
      <>
        <VerdictBand
          days={s.days}
          year={lcy}
          name={`PT ${s.pt.name}`}
          scope="block"
          cityMedian={cityMedian}
          partial={lcyPartial}
        />
        <RenterTip grade={s.key} />
        <PtHistory
          pt={s.pt}
          street={street.name}
          yearsDesc={yearsDesc}
          dataThrough={meta.data_through}
        />
      </>
    ),
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {head}

      {spreadMin !== spreadMax && (
        <p className="range mt-4">
          Pe toată strada, în {lcy}, situația a variat între <b>{fmtInt(spreadMin)}</b> și{' '}
          <b>{fmtZile(spreadMax)}</b> fără apă caldă, în funcție de zonă.
        </p>
      )}

      <BlockFinder blocks={blocks} pts={finderPts} defaultPt={repr.pt.slug} />

      {unionDisclosure}
      {neighborsSection}
    </main>
  );
}

/** A serving PT row, narrowed to what the finder/list need. */
type ServingPt = ReturnType<typeof gradeFor> & { pt: PtEntity; days: number };

/** Pick a representative mid PT (median by days; lower-mid on ties). */
function pickRepresentative(servingPts: ServingPt[]): ServingPt {
  const sorted = [...servingPts].sort((a, b) => a.days - b.days);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** Static (non-finder) serving-PT list, used on the single-PT-with-extras path. */
function ServingPtList({ servingPts, lcy }: { servingPts: ServingPt[]; lcy: number }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold">Toate zonele de pe această stradă</h2>
      <p className="mt-1 mb-3 text-sm text-ink-soft">
        Zile fără apă caldă pe punct termic în {lcy}.
      </p>
      <div className="pts">
        {servingPts.map((s) => (
          <Link
            key={s.pt.slug}
            href={`/punct-termic/${s.pt.slug}`}
            className="r"
          >
            <span className="n">
              <span className="v-dot" data-v={s.key} /> PT {s.pt.name}
            </span>
            <span className="v tnum">{s.days}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
