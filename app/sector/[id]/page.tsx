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
  getYearSummary,
  lastCompleteYear,
} from '@/lib/data';
import { fmtDateRo, fmtDateTimeRo, fmtDec, fmtInt, fmtZile, yearLabel } from '@/lib/format';
import { getSectorLive, type SectorLive } from '@/lib/sector-live';
import { faqJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'error';
export const dynamicParams = false;

const SECTORS = ['1', '2', '3', '4', '5', '6'];

export function generateStaticParams(): { id: string }[] {
  return SECTORS.map((id) => ({ id }));
}

/** "o întrerupere" / "3 întreruperi" / "21 de întreruperi". */
function fmtIntreruperi(n: number): string {
  if (n === 1) return 'o întrerupere';
  if (n >= 20) return `${fmtInt(n)} de întreruperi`;
  return `${n} întreruperi`;
}

/** Median avarie duration for prose: "sub o oră" / "9 ore" / "2,5 zile". */
function fmtDurata(hours: number): string {
  if (hours < 1) return 'sub o oră';
  if (hours < 48) {
    const h = Math.round(hours);
    if (h === 1) return 'o oră';
    if (h >= 20) return `${fmtInt(h)} de ore`;
    return `${h} ore`;
  }
  return `${fmtDec(hours / 24)} zile`;
}

/** First sentence of the page and of FAQ #1 — current status at data_through. */
function statusSentence(sector: number, live: SectorLive, dataThrough: string): string {
  const date = fmtDateRo(dataThrough);
  if (live.ongoing.length === 0) {
    return `La ${date} nu era anunțată nicio întrerupere de apă caldă în curs în Sectorul ${sector}.`;
  }
  const n = live.ongoing.length;
  const avarii = live.ongoing.filter((o) => o.cause_class === 'avarie').length;
  const verb = n === 1 ? 'era anunțată' : 'erau anunțate';
  let detail = '';
  if (avarii === 0) {
    detail = n === 1 ? ' (oprire programată)' : ', toate opriri programate';
  } else if (avarii === n) {
    detail = n === 1 ? ' (avarie)' : ', toate din avarii';
  } else {
    detail = `, dintre care ${avarii} din avarii`;
  }
  return `La ${date}, în Sectorul ${sector} ${verb} ${fmtIntreruperi(n)} de apă caldă în curs${detail}.`;
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
    title: `Apă caldă în Sectorul ${id} — avarii azi și istoric`,
    description: `Avariile de apă caldă în curs în Sectorul ${id}, actualizate zilnic din anunțurile Termoenergetica, și istoricul complet: mediana de ${row ? fmtZile(row.median_days) : '?'} fără apă caldă în ${lcy}.`,
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

  const live = getSectorLive(sector, lcy);
  const citySummary = getYearSummary(lcy);

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

  const crumbs = [
    { name: 'Acasă', href: '/' },
    { name: 'Sectoare', href: '/clasament/sectoare' },
    { name: `Sector ${sector}`, href: `/sector/${sector}` },
  ];

  const status = statusSentence(sector, live, meta.data_through);
  const top3 = worstPts.slice(0, 3);

  // FAQ answers are plain strings so the FAQPage JSON-LD matches the visible
  // text exactly; links live outside the answers.
  const faq: { question: string; answer: string }[] = [
    {
      question: `De ce nu am apă caldă în Sectorul ${sector}?`,
      answer:
        `${status} Apa caldă vine de la punctul termic care deservește blocul, așa că o avarie ` +
        `locală îți poate opri apa chiar dacă restul sectorului nu e afectat. Caută strada ta pe ` +
        `site ca să vezi punctul termic care o deservește și istoricul lui complet.`,
    },
    {
      question: `Când revine apa caldă după o avarie în Sectorul ${sector}?`,
      answer:
        `Termoenergetica publică pentru fiecare întrerupere un termen estimat de restabilire, ` +
        `afișat pe pagina fiecărui punct termic afectat.` +
        (live.medianAvarieHours !== null
          ? ` În ${lcy}, durata mediană a unui episod de avarie în Sectorul ${sector} a fost de aproximativ ${fmtDurata(live.medianAvarieHours)}.`
          : ''),
    },
    {
      question: `Cât de des rămâne Sectorul ${sector} fără apă caldă?`,
      answer:
        `În ${lcy}, punctul termic median din Sectorul ${sector} a avut ${fmtZile(row.median_days)} ` +
        `fără apă caldă, față de o mediană de ${fmtZile(citySummary.median_pt_days)} pe tot Bucureștiul. ` +
        `Sectorul are ${fmtInt(live.ptsTotal)} puncte termice; în ultimele 30 de zile, ` +
        `${fmtInt(live.ptsHit30d)} dintre ele au avut cel puțin o întrerupere.`,
    },
    ...(top3.length === 3
      ? [
          {
            question: `Care sunt cele mai afectate zone din Sectorul ${sector}?`,
            answer:
              `În ${lcy}, punctele termice cu cele mai multe zile fără apă caldă din Sectorul ${sector} ` +
              `au fost ${top3[0].name} (${fmtZile(top3[0].days)}), ${top3[1].name} ` +
              `(${fmtZile(top3[1].days)}) și ${top3[2].name} (${fmtZile(top3[2].days)}). ` +
              `Clasamentul complet al sectorului e în tabelul de pe această pagină.`,
          },
        ]
      : []),
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 font-display text-3xl font-bold">
        Apă caldă în Sectorul {sector}
      </h1>

      {/* Answer-first: current status + 30-day pulse + historical baseline. */}
      <p className="mt-4 max-w-2xl leading-relaxed">
        {status} În ultimele 30 de zile, {fmtInt(live.ptsHit30d)} din {fmtInt(live.ptsTotal)}{' '}
        puncte termice din sector au avut cel puțin o întrerupere, iar în {lcy} punctul termic
        median din Sectorul {sector} a stat {fmtZile(row.median_days)} fără apă caldă. Mai
        jos: situația de acum, cele mai afectate zone și evoluția pe ani.
      </p>

      <section className="mt-10">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">
          Este oprită apa caldă acum în Sectorul {sector}?
        </h2>
        {live.ongoing.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full border-collapse text-sm tnum">
              <thead>
                <tr className="hairline-b text-left text-xs text-ink-soft">
                  <th scope="col" className="py-2 pr-3 font-normal">Punct termic</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Zona</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Cauză</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Început</th>
                  <th scope="col" className="py-2 font-normal">Restabilire estimată</th>
                </tr>
              </thead>
              <tbody>
                {live.ongoing.map((o) => (
                  <tr key={`${o.slug}|${o.start}`} className="hairline-b align-baseline">
                    <td className="py-2 pr-3 font-sans">
                      <Link href={`/punct-termic/${o.slug}`} className="hover:underline">
                        {o.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-sans">
                      {o.streets.length > 0 ? o.streets.join(', ') : '—'}
                    </td>
                    <td
                      className={`py-2 pr-3 ${o.cause_class === 'avarie' ? 'text-avarie' : o.cause_class === 'programat' ? 'text-programat' : 'text-ink-soft'}`}
                    >
                      {o.cause_class === 'avarie'
                        ? 'avarie'
                        : o.cause_class === 'programat'
                          ? 'programat'
                          : 'neclasificat'}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTimeRo(o.start)}</td>
                    <td className="py-2 whitespace-nowrap">
                      {o.remediere_last !== null ? fmtDateTimeRo(o.remediere_last) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed">
            Nicio întrerupere în curs anunțată pentru Sectorul {sector} la{' '}
            {fmtDateRo(meta.data_through)}. Dacă blocul tău nu are apă caldă,{' '}
            <Link href="/cauta" className="underline">
              caută strada ta
            </Link>{' '}
            ca să vezi punctul termic care o deservește, sau verifică anunțurile oficiale pe{' '}
            <a href="https://www.cmteb.ro" className="underline" rel="nofollow">
              cmteb.ro
            </a>
            .
          </p>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Actualizat o dată pe noapte din anunțurile publice Termoenergetica. O avarie apărută
          azi poate intra pe listă abia la următoarea actualizare.
        </p>
      </section>

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

      <section className="mt-12">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">Întrebări frecvente</h2>
        <div className="mt-4 max-w-2xl space-y-6">
          {faq.map((item) => (
            <div key={item.question}>
              <h3 className="font-display text-lg font-bold">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-hairline pt-4 text-sm text-ink-soft">
        <p>
          Episoade înregistrate în sector în {lcy}: {fmtInt(row.episodes)}. Media zilelor din
          avarii pe punct termic: {fmtDec(row.mean_days_avarie)}; din lucrări programate:{' '}
          {fmtDec(row.mean_days_programat)}.
        </p>
        <p className="mt-3">
          Alte sectoare:{' '}
          {SECTORS.filter((s) => Number(s) !== sector).map((s, i, arr) => (
            <span key={s}>
              <Link href={`/sector/${s}`} className="underline">
                Sector {s}
              </Link>
              {i < arr.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      </section>

      <JsonLd data={faqJsonLd(faq)} />
    </main>
  );
}
