import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import SectorSilhouetteMap from '@/components/SectorSilhouetteMap';
import StatHero from '@/components/StatHero';
import TrendBars from '@/components/TrendBars';
import {
  getMeta,
  getPtRanking,
  getSectoareRanking,
  lastCompleteYear,
} from '@/lib/data';
import { fmtDec, fmtInt, yearLabel } from '@/lib/format';

export const dynamic = 'error';
export const dynamicParams = false;

const SECTORS = ['1', '2', '3', '4', '5', '6'];

export function generateStaticParams(): { id: string }[] {
  return SECTORS.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lcy = lastCompleteYear();
  const row = getSectoareRanking(lcy).find((r) => r.sector === Number(id));
  return {
    title: `Sector ${id} — apă caldă în București | mediana ${row ? fmtInt(row.median_days) : '?'} zile fără apă caldă în ${lcy}`,
    description: `Sectorul ${id} al Bucureștiului: mediana ${row ? fmtInt(row.median_days) : '?'} zile cu întreruperi de apă caldă pe punct termic în ${lcy}, media ${row ? fmtDec(row.mean_days) : '?'} zile. Evoluție pe ani și cele mai afectate puncte termice.`,
    alternates: { canonical: `/sector/${id}` },
  };
}

export default async function SectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sector = Number(id);
  const meta = getMeta();
  const lcy = lastCompleteYear();

  const lcyRanking = getSectoareRanking(lcy);
  const row = lcyRanking.find((r) => r.sector === sector);
  if (!row) throw new Error(`no sector ranking row for sector ${sector}`);

  const values: Record<number, number> = {};
  for (const r of lcyRanking) values[r.sector] = r.median_days;

  const trend = meta.years.map((y) => {
    const yearRow = getSectoareRanking(y).find((r) => r.sector === sector);
    return {
      label: String(y),
      value: yearRow?.median_days ?? 0,
      partial: meta.partial_years.includes(y),
      href: `/clasament/sectoare/${y}`,
    };
  });

  const worstPts = getPtRanking(lcy)
    .filter((r) => r.sector === sector)
    .slice(0, 20);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Acasă', href: '/' },
          { name: 'Sectoare', href: '/clasament/sectoare' },
          { name: `Sector ${sector}`, href: `/sector/${sector}` },
        ]}
      />
      <h1 className="mt-6 font-display text-3xl font-bold">Sector {sector}</h1>

      <StatHero
        value={fmtInt(row.median_days)}
        label={
          <>
            mediana zilelor fără apă caldă pe punct termic în {yearLabel(lcy, meta)} (media:{' '}
            {fmtDec(row.mean_days)} zile, {fmtInt(row.pts)} puncte termice)
          </>
        }
        footnote="Medii pe toate punctele termice din sector, inclusiv cele fără întreruperi — valori indicative."
      />

      <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
        <section>
          <h2 className="hairline-b pb-2 font-display text-xl font-bold">În oraș</h2>
          <div className="mt-4">
            <SectorSilhouetteMap
              values={values}
              highlight={sector}
              ariaLabel={`Harta sectoarelor — mediana zilelor fără apă caldă în ${lcy}, Sectorul ${sector} evidențiat`}
            />
          </div>
        </section>
        <section>
          <h2 className="hairline-b pb-2 font-display text-xl font-bold">Evoluție pe ani</h2>
          <div className="mt-4">
            <TrendBars series={trend} unitLabel="mediana zilelor fără apă caldă pe punct termic" />
          </div>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">
          Cele mai afectate puncte termice — {yearLabel(lcy, meta)}
        </h2>
        <table className="mt-3 w-full border-collapse text-sm tnum">
          <thead>
            <tr className="hairline-b text-left text-xs text-ink-soft">
              <th scope="col" className="py-2 pr-3 font-normal">Loc</th>
              <th scope="col" className="py-2 pr-3 font-normal">Punct termic</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Zile fără apă caldă</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">din care avarii</th>
              <th scope="col" className="py-2 text-right font-normal">din care programate</th>
            </tr>
          </thead>
          <tbody>
            {worstPts.map((r, i) => (
              <tr key={r.slug} className="hairline-b">
                <td className="py-2 pr-3 text-ink-soft">{i + 1}</td>
                <td className="py-2 pr-3 font-sans">
                  <Link href={`/punct-termic/${r.slug}`} className="hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-right">{fmtInt(r.days)}</td>
                <td className="py-2 pr-3 text-right">{fmtInt(r.days_avarie)}</td>
                <td className="py-2 text-right">{fmtInt(r.days_programat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-sm">
          <Link href={`/clasament/puncte-termice/${lcy}`} className="underline">
            Clasamentul complet al punctelor termice — {lcy}
          </Link>
        </p>
      </section>

      <section className="mt-12 border-t border-hairline pt-4 text-sm text-ink-soft">
        <p>
          Episoade înregistrate în sector în {lcy}: {fmtInt(row.episodes)}. Media zilelor din
          avarii pe punct termic: {fmtDec(row.mean_days_avarie)}; din lucrări programate:{' '}
          {fmtDec(row.mean_days_programat)}.
        </p>
      </section>
    </main>
  );
}
