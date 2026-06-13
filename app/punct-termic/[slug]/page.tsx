import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import CompareModule from '@/components/CompareModule';
import EpisodeTable from '@/components/EpisodeTable';
import MethodologyFootnote from '@/components/MethodologyFootnote';
import OutageStrip from '@/components/OutageStrip';
import StatRow from '@/components/StatRow';
import VerdictBand from '@/components/VerdictBand';
import {
  getDistribution,
  getMeta,
  getPt,
  getPtAll,
  getYearSummary,
  lastCompleteYear,
  type PtYear,
} from '@/lib/data';
import { fmtInt, fmtZile, yearLabel } from '@/lib/format';
import { siteUrl } from '@/lib/seo';
import { ptDescription, ptTitle } from '@/lib/seo-meta';

export const dynamic = 'error';
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return [...getPtAll().keys()].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pt = getPt(slug);
  if (!pt) return {};
  const lcy = lastCompleteYear();
  return {
    title: ptTitle(pt, lcy),
    description: ptDescription(pt, lcy),
    alternates: { canonical: `/punct-termic/${slug}` },
    openGraph: { images: [siteUrl(`/og/${slug}`)] },
  };
}

const EMPTY_YEAR: PtYear = {
  days: 0,
  days_avarie: 0,
  days_programat: 0,
  days_deficienta: 0,
  episodes_count: 0,
  longest_days: 0,
  est_hours: 0,
  runs: [],
  episodes: [],
};

/** 1-based day-of-year of meta.data_through, only relevant within its year. */
function dataThroughDoy(dataThrough: string, year: number): number | undefined {
  if (Number(dataThrough.slice(0, 4)) !== year) return undefined;
  const [y, m, d] = dataThrough.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

export default async function PunctTermicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pt = getPt(slug);
  if (!pt) throw new Error(`unknown PT slug at build time: ${slug}`);
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const all = getPtAll();

  const yearsDesc = [...meta.years].sort((a, b) => b - a);
  const lcyData = pt.years[String(lcy)] ?? EMPTY_YEAR;
  const lcySummary = getYearSummary(lcy);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Acasă', href: '/' },
          { name: `Sector ${pt.sector}`, href: `/sector/${pt.sector}` },
          { name: pt.name, href: `/punct-termic/${slug}` },
        ]}
      />

      <VerdictBand
        scope="pt"
        days={lcyData.days}
        year={lcy}
        name={pt.name}
        cityMedian={lcySummary.median_pt_days}
        partial={lcySummary.partial}
      />

      <h1 className="mt-6 font-display text-3xl font-bold">{pt.name}</h1>
      <p className="mt-3 max-w-2xl text-lg leading-snug">
        {lcyData.days > 0 ? (
          <>
            {pt.name} (Sector {pt.sector}) a avut {fmtInt(lcyData.days)} zile cu întreruperi de apă
            caldă în {lcy}: {fmtInt(lcyData.days_avarie)} din avarii și{' '}
            {fmtInt(lcyData.days_programat)} din lucrări programate.
          </>
        ) : (
          <>Fără întreruperi înregistrate în {lcy}.</>
        )}
      </p>

      <div className="mt-8">
        <StatRow
          stats={[
            { value: fmtInt(lcyData.days), label: `zile fără apă caldă în ${lcy}` },
            { value: fmtInt(lcyData.days_avarie), label: 'din care avarii' },
            { value: fmtInt(lcyData.days_programat), label: 'din care programate' },
            {
              value: fmtInt(lcyData.days_deficienta),
              label: 'zile cu deficiențe (presiune/temperatură) — numărate separat',
              footnoteHref: '/metodologie#ce-numaram',
            },
            { value: `≈ ${fmtInt(Math.round(lcyData.est_hours))}`, label: 'ore estimate' },
            { value: fmtInt(lcyData.longest_days), label: 'cel mai lung episod (zile)' },
          ]}
        />
      </div>
      <div className="mt-3">
        <MethodologyFootnote anchor="ce-numaram">
          O „zi cu întrerupere" = o zi calendaristică atinsă de cel puțin un episod de oprire a
          apei calde (avarie sau lucrare programată). Deficiențele (presiune sau temperatură
          scăzută) se numără separat și nu intră în indicatorul principal.
        </MethodologyFootnote>
      </div>

      {yearsDesc.map((year) => {
        const data = pt.years[String(year)] ?? EMPTY_YEAR;
        const distribution = getDistribution(year);
        return (
          <section key={year} className="mt-12 border-t border-hairline pt-6">
            <h2 className="font-display text-2xl font-bold">{yearLabel(year, meta)}</h2>
            {data.days === 0 && (
              <p className="mt-2 text-sm text-ink-soft">Fără întreruperi înregistrate în {year}.</p>
            )}
            {data.days > 0 && (
              <p className="mt-2 text-sm text-ink-soft">
                {fmtZile(data.days)} fără apă caldă · {fmtInt(data.episodes_count)} episoade · cel
                mai lung: {fmtZile(data.longest_days)}
              </p>
            )}
            <div className="mt-4">
              <OutageStrip
                year={year}
                runs={data.runs}
                ariaLabel={`Calendarul întreruperilor ${pt.name} în ${year}`}
                dataThroughDoy={dataThroughDoy(meta.data_through, year)}
                showMonthLabels
              />
            </div>
            <div className="mt-6">
              <CompareModule
                value={data.days}
                percentiles={distribution.percentiles}
                median={distribution.percentiles.p50}
                year={year}
                entityLabel={pt.name}
              />
            </div>
            <div className="mt-6">
              <EpisodeTable
                episodesByYear={[{ year, episodes: data.episodes }]}
                defaultOpenYear={lcy}
              />
            </div>
          </section>
        );
      })}

      {pt.streets.length > 0 && (
        <section className="mt-12 border-t border-hairline pt-6">
          <h2 className="font-display text-xl font-bold">Străzi deservite</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {pt.streets.map((s) => (
              <li key={s.slug}>
                <Link href={`/strada/${s.slug}`} className="hover:underline">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pt.nearest.length > 0 && (
        <section className="mt-10 border-t border-hairline pt-6">
          <h2 className="font-display text-xl font-bold">Puncte termice apropiate</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {pt.nearest.slice(0, 5).map((nearSlug) => {
              const near = all.get(nearSlug);
              if (!near) return null;
              const nearDays = near.years[String(lcy)]?.days ?? 0;
              return (
                <li key={nearSlug} className="flex items-baseline gap-x-2">
                  <Link href={`/punct-termic/${nearSlug}`} className="hover:underline">
                    {near.name}
                  </Link>
                  <span className="tnum text-ink-soft">
                    {fmtZile(nearDays)} în {lcy}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
