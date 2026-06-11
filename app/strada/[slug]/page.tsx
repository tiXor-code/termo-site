import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import CompareModule from '@/components/CompareModule';
import OutageStrip from '@/components/OutageStrip';
import {
  getDistribution,
  getMeta,
  getPtAll,
  getStrada,
  getStradaAll,
  lastCompleteYear,
  type StreetYear,
} from '@/lib/data';
import { fmtInt, fmtZile, yearLabel } from '@/lib/format';
import { siteUrl } from '@/lib/seo';
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
  return {
    title: streetTitle(street, firstYear, lastYear),
    description: streetDescription(street, lcy, firstYear, lastYear),
    alternates: { canonical: `/strada/${slug}` },
    openGraph: { images: [siteUrl(`/og/${slug}`)] },
  };
}

const EMPTY_YEAR: StreetYear = { days: 0, days_avarie: 0, days_programat: 0, runs: [] };

function dataThroughDoy(dataThrough: string, year: number): number | undefined {
  if (Number(dataThrough.slice(0, 4)) !== year) return undefined;
  const [y, m, d] = dataThrough.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

export default async function StradaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const street = getStrada(slug);
  if (!street) throw new Error(`unknown street slug at build time: ${slug}`);
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const ptAll = getPtAll();

  const yearsDesc = [...meta.years].sort((a, b) => b - a);
  const lcyData = street.years[String(lcy)] ?? EMPTY_YEAR;
  const distribution = getDistribution(lcy);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Acasă', href: '/' },
          { name: 'Străzi', href: '/clasament/strazi' },
          { name: street.name, href: `/strada/${slug}` },
        ]}
      />
      <h1 className="mt-6 font-display text-3xl font-bold">{street.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">{sectorsPhrase(street.sectors)}</p>
      <p className="mt-3 max-w-2xl text-lg leading-snug">
        {lcyData.days > 0 ? (
          <>
            {street.name} a avut {fmtInt(lcyData.days)} zile cu întreruperi de apă caldă în {lcy}:{' '}
            {fmtInt(lcyData.days_avarie)} din avarii și {fmtInt(lcyData.days_programat)} din
            lucrări programate.
          </>
        ) : (
          <>Fără întreruperi înregistrate în {lcy}.</>
        )}
      </p>
      <p className="mt-4 max-w-2xl border-l-2 border-hairline pl-3 text-sm text-ink-soft">
        Termoenergetica raportează întreruperile la nivel de punct termic, nu de stradă. Zilele
        afișate pentru această stradă sunt reuniunea zilelor punctelor termice care o deservesc —
        defalcarea pe puncte termice este mai jos.
      </p>

      {yearsDesc.map((year) => {
        const data = street.years[String(year)] ?? EMPTY_YEAR;
        return (
          <section key={year} className="mt-10">
            <h2 className="flex items-baseline gap-x-3 text-sm">
              <span className="font-display text-lg font-bold">{yearLabel(year, meta)}</span>
              <span className="tnum text-ink-soft">
                {data.days > 0 ? fmtZile(data.days) : 'fără întreruperi'}
              </span>
            </h2>
            <div className="mt-2">
              <OutageStrip
                year={year}
                runs={data.runs}
                ariaLabel={`Calendarul întreruperilor pe ${street.name} în ${year}`}
                dataThroughDoy={dataThroughDoy(meta.data_through, year)}
                showMonthLabels={year === yearsDesc[0]}
              />
            </div>
          </section>
        );
      })}

      <section className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-xl font-bold">Față de oraș — {yearLabel(lcy, meta)}</h2>
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

      <section className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-xl font-bold">Punctele termice care deservesc strada</h2>
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
            {street.pts.map((ptSlug) => {
              const pt = ptAll.get(ptSlug);
              if (!pt) return null;
              return (
                <tr key={ptSlug} className="hairline-b">
                  <td className="py-2 pr-3 font-sans">
                    <Link href={`/punct-termic/${ptSlug}`} className="hover:underline">
                      {pt.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{pt.sector}</td>
                  <td className="py-2 text-right">{fmtInt(pt.years[String(lcy)]?.days ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {street.neighbors.length > 0 && (
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
      )}
    </main>
  );
}
