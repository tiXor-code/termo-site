import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import FaqSection from '@/components/FaqSection';
import MethodologyFootnote from '@/components/MethodologyFootnote';
import SectorSilhouetteMap from '@/components/SectorSilhouetteMap';
import SectorStatusBand from '@/components/SectorStatusBand';
import SectorVsCityTable from '@/components/SectorVsCityTable';
import StatHero from '@/components/StatHero';
import TrendBars from '@/components/TrendBars';
import { getMeta, getSectoareRanking, lastCompleteYear } from '@/lib/data';
import { fmtDec, fmtInt, fmtZile, yearLabel } from '@/lib/format';
import { buildSectorFaq } from '@/lib/sector-faq';
import { getSectorStats, SECTORS } from '@/lib/sector-stats';
import { sectorDescription, sectorTitle } from '@/lib/seo-meta';

export const dynamic = 'error';
export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return SECTORS.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const stats = getSectorStats(Number(id));
  return {
    title: sectorTitle(stats.sector, stats.row.median_days, stats.year),
    description: sectorDescription(
      stats.sector,
      stats.row.median_days,
      stats.year,
      stats.avarie.n > 0 ? stats.avarie.medianHours : null,
    ),
    alternates: { canonical: `/sector/${id}` },
  };
}

export default async function SectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sector = Number(id);
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const stats = getSectorStats(sector);
  const row = stats.row;
  const faq = buildSectorFaq(stats, meta);

  const lcyRanking = getSectoareRanking(lcy);
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

  const worstPts = stats.topPts;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Acasă', href: '/' },
          { name: 'Sectoare', href: '/clasament/sectoare' },
          { name: `Sector ${sector}`, href: `/sector/${sector}` },
        ]}
      />
      <h1 className="mt-6 font-display text-3xl font-bold">
        Apă caldă în Sectorul {sector}, București
      </h1>

      <SectorStatusBand stats={stats} />

      <p className="mt-6 max-w-2xl text-lg leading-snug">
        În {yearLabel(lcy, meta)}, un punct termic din Sectorul {sector} a stat în mediană{' '}
        {fmtZile(row.median_days)} fără apă caldă — față de {fmtZile(stats.city.medianDays)} mediana
        Bucureștiului, adică locul {stats.rankByMedianDays} din 6 sectoare la numărul de zile
        (locul 1 = cele mai multe). Sectorul are {fmtInt(row.pts)} puncte termice și{' '}
        {fmtInt(row.episodes)} episoade de oprire înregistrate în {lcy}.
      </p>

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
          Sectorul {sector} față de media Bucureștiului — {yearLabel(lcy, meta)}
        </h2>
        <SectorVsCityTable stats={stats} />
        <div className="mt-3">
          <MethodologyFootnote anchor="ce-numaram">
            Coloana „București" este agregatul celor șase sectoare, ponderat după numărul de puncte
            termice — aceleași definiții în ambele coloane. Mediile includ punctele termice fără
            nicio întrerupere.
          </MethodologyFootnote>
        </div>
      </section>

      {stats.topStreets.length > 0 && (
        <section className="mt-12">
          <h2 className="hairline-b pb-2 font-display text-xl font-bold">
            Cele mai afectate străzi din Sectorul {sector} — {yearLabel(lcy, meta)}
          </h2>
          <table className="mt-3 w-full border-collapse text-sm tnum">
            <thead>
              <tr className="hairline-b text-left text-xs text-ink-soft">
                <th scope="col" className="py-2 pr-3 font-normal">Loc</th>
                <th scope="col" className="py-2 pr-3 font-normal">Stradă</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Zile cu întreruperi</th>
                <th scope="col" className="py-2 text-right font-normal">din care avarii</th>
              </tr>
            </thead>
            <tbody>
              {stats.topStreets.map((st, i) => (
                <tr key={st.slug} className="hairline-b">
                  <td className="py-2 pr-3 text-ink-soft">{i + 1}</td>
                  <td className="py-2 pr-3 font-sans">
                    <Link href={`/strada/${st.slug}`} className="hover:underline">
                      {st.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right">{fmtInt(st.days)}</td>
                  <td className="py-2 text-right">{fmtInt(st.daysAvarie)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3">
            <MethodologyFootnote anchor="strazi">
              Zilele unei străzi sunt reuniunea zilelor punctelor termice care o deservesc — nu ce a
              trăit un singur apartament. Deschide strada ta ca să vezi numărul punctului termic
              care îți deservește blocul.
            </MethodologyFootnote>
          </div>
          <p className="mt-4 text-sm">
            <Link href={`/clasament/strazi/${lcy}`} className="underline">
              Clasamentul complet al străzilor — {lcy}
            </Link>
          </p>
        </section>
      )}

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

      <FaqSection items={faq} heading={`Întrebări frecvente — apa caldă în Sectorul ${sector}`} />

      <section className="mt-12 border-t border-hairline pt-4 text-sm text-ink-soft">
        <p>
          Episoade înregistrate în sector în {lcy}: {fmtInt(row.episodes)}. Media zilelor din
          avarii pe punct termic: {fmtDec(row.mean_days_avarie)}; din lucrări programate:{' '}
          {fmtDec(row.mean_days_programat)}.
          {stats.currentYearRow && (
            <>
              {' '}
              În {yearLabel(stats.currentYear, meta)}: mediana{' '}
              {fmtZile(stats.currentYearRow.median_days)} pe punct termic și{' '}
              {fmtInt(stats.currentYearRow.episodes)} episoade de oprire până acum.
            </>
          )}
        </p>
        <p className="mt-3">
          Vezi și{' '}
          {SECTORS.filter((s) => s !== sector).map((s, i, arr) => (
            <span key={s}>
              <Link href={`/sector/${s}`} className="underline">
                apa caldă în Sectorul {s}
              </Link>
              {i < arr.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
      </section>
    </main>
  );
}
