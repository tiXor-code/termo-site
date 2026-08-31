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
import { getSectorLive, RECENT_ENDED_DAYS, type SectorLive } from '@/lib/sector-live';
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

/** "un punct termic" / "3 puncte termice" / "56 de puncte termice". */
function fmtPuncteTermice(n: number): string {
  if (n === 1) return 'un punct termic';
  if (n >= 20) return `${fmtInt(n)} de puncte termice`;
  return `${n} puncte termice`;
}

/** Names shown inline per announcement before the rest folds into <details>. */
const PTS_SHOWN = 6;

/** Rows shown in the recently-ended table before it truncates. */
const RECENT_SHOWN = 8;

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
  const programate = live.ongoing.filter((o) => o.cause_class === 'programat').length;
  const verb = n === 1 ? 'era anunțată' : 'erau anunțate';
  let detail = '';
  if (n === 1) {
    detail =
      avarii === 1
        ? ' (avarie)'
        : programate === 1
          ? ' (oprire programată)'
          : ' (cauză neprecizată în anunț)';
  } else if (avarii === n) {
    detail = ', toate din avarii';
  } else if (avarii === 0) {
    // "unclassified" episodes are not planned works; only say so when they all are.
    detail = programate === n ? ', toate opriri programate' : ', niciuna anunțată ca avarie';
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
    title: `Apă caldă în Sectorul ${id} — avarii acum și istoric`,
    description: `Este oprită apa caldă în Sectorul ${id} acum? Întreruperile în curs azi, actualizate zilnic din anunțurile Termoenergetica, și istoricul complet: mediana de ${row ? fmtZile(row.median_days) : '?'} fără apă caldă în ${lcy} și cele mai afectate zone.`,
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
      question: `Cum aflu dacă e o avarie de apă caldă în Sectorul ${sector} chiar acum?`,
      answer:
        `Această pagină arată întreruperile în curs și pe cele încheiate recent din anunțurile ` +
        `publice Termoenergetica și se actualizează o dată pe noapte, deci o avarie apărută în ` +
        `cursul zilei poate intra pe listă abia la următoarea actualizare. Pentru anunțurile de ` +
        `ultimă oră verifică site-ul oficial cmteb.ro, iar pentru blocul tău caută strada pe ` +
        `acest site ca să vezi pagina punctului termic care o deservește.`,
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
        jos: situația de acum, întreruperile încheiate recent, cele mai afectate zone și
        evoluția pe ani.
      </p>

      <section className="mt-10">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">
          Este oprită apa caldă acum în Sectorul {sector}?
        </h2>
        {live.ongoing.length > 0 ? (
          <>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed">
              La {fmtDateRo(meta.data_through)}: {fmtIntreruperi(live.ongoing.length)} în curs
              {live.groups.length < live.ongoing.length
                ? `, grupate pe ${live.groups.length === 1 ? 'un singur anunț' : `${live.groups.length} anunțuri`} Termoenergetica (aceeași cauză, același început și același termen de restabilire; o oprire care afectează zeci de puncte termice deodată apare pe un singur rând)`
                : ''}
              . Avariile sunt primele.
            </p>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full border-collapse text-sm tnum">
                <thead>
                  <tr className="hairline-b text-left text-xs text-ink-soft">
                    <th scope="col" className="py-2 pr-3 font-normal">Cauză</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Început</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Restabilire estimată</th>
                    <th scope="col" className="py-2 font-normal">Puncte termice afectate</th>
                  </tr>
                </thead>
                <tbody>
                  {live.groups.map((g) => {
                    const shown = g.pts.slice(0, PTS_SHOWN);
                    const rest = g.pts.slice(PTS_SHOWN);
                    return (
                      <tr key={`${g.cause_class}|${g.start}|${g.remediere_last ?? ''}`} className="hairline-b align-baseline">
                        <td
                          className={`py-2 pr-3 whitespace-nowrap ${g.cause_class === 'avarie' ? 'text-avarie' : g.cause_class === 'programat' ? 'text-programat' : 'text-ink-soft'}`}
                        >
                          {g.cause_class === 'avarie'
                            ? 'avarie'
                            : g.cause_class === 'programat'
                              ? 'programat'
                              : 'neclasificat'}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTimeRo(g.start)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {g.remediere_last !== null ? fmtDateTimeRo(g.remediere_last) : '—'}
                        </td>
                        <td className="min-w-[14rem] py-2 font-sans">
                          {g.pts.length === 1 ? (
                            <>
                              <Link href={`/punct-termic/${g.pts[0].slug}`} className="hover:underline">
                                {g.pts[0].name}
                              </Link>
                              {g.pts[0].streets.length > 0 ? (
                                <span className="text-ink-soft"> ({g.pts[0].streets.join(', ')})</span>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span className="text-ink-soft">{fmtPuncteTermice(g.pts.length)}: </span>
                              {shown.map((p, i) => (
                                <span key={p.slug}>
                                  <Link href={`/punct-termic/${p.slug}`} className="hover:underline">
                                    {p.name}
                                  </Link>
                                  {i < shown.length - 1 || rest.length > 0 ? ', ' : ''}
                                </span>
                              ))}
                              {rest.length > 0 ? (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-xs text-ink-soft">
                                    și încă {fmtPuncteTermice(rest.length)} — vezi lista
                                  </summary>
                                  <p className="mt-1 leading-relaxed">
                                    {rest.map((p, i) => (
                                      <span key={p.slug}>
                                        <Link href={`/punct-termic/${p.slug}`} className="hover:underline">
                                          {p.name}
                                        </Link>
                                        {i < rest.length - 1 ? ', ' : ''}
                                      </span>
                                    ))}
                                  </p>
                                </details>
                              ) : null}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed">
              Blocul tău nu apare în listă?{' '}
              <Link href="/cauta" className="underline">
                Caută strada ta
              </Link>{' '}
              ca să vezi punctul termic care o deservește și istoricul lui complet.
            </p>
          </>
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

      <section className="mt-10">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">
          Ce întreruperi s-au încheiat recent în Sectorul {sector}?
        </h2>
        {live.recentEnded.length > 0 ? (
          <>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed">
              În ultimele {RECENT_ENDED_DAYS} zile (până la {fmtDateRo(meta.data_through)}),
              în Sectorul {sector} {live.recentEnded.length === 1 ? 's-a încheiat' : 's-au încheiat'}{' '}
              {fmtIntreruperi(live.recentEnded.length)} de apă caldă. Dacă apa caldă tocmai a
              revenit la tine, episodul blocului tău e probabil unul dintre acestea.
            </p>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full border-collapse text-sm tnum">
                <thead>
                  <tr className="hairline-b text-left text-xs text-ink-soft">
                    <th scope="col" className="py-2 pr-3 font-normal">Punct termic</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Cauză</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Început</th>
                    <th scope="col" className="py-2 pr-3 font-normal">S-a încheiat</th>
                    <th scope="col" className="py-2 font-normal">Durată</th>
                  </tr>
                </thead>
                <tbody>
                  {live.recentEnded.slice(0, RECENT_SHOWN).map((r) => (
                    <tr key={`${r.slug}|${r.start}`} className="hairline-b align-baseline">
                      <td className="min-w-[10rem] py-2 pr-3 font-sans">
                        <Link href={`/punct-termic/${r.slug}`} className="hover:underline">
                          {r.name}
                        </Link>
                        {r.streets.length > 0 ? (
                          <span className="text-ink-soft"> ({r.streets.join(', ')})</span>
                        ) : null}
                      </td>
                      <td
                        className={`py-2 pr-3 whitespace-nowrap ${r.cause_class === 'avarie' ? 'text-avarie' : r.cause_class === 'programat' ? 'text-programat' : 'text-ink-soft'}`}
                      >
                        {r.cause_class === 'avarie'
                          ? 'avarie'
                          : r.cause_class === 'programat'
                            ? 'programat'
                            : 'neclasificat'}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTimeRo(r.start)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTimeRo(r.end)}</td>
                      <td className="py-2 whitespace-nowrap">{fmtDurata(r.durationHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {live.recentEnded.length > RECENT_SHOWN ? (
              <p className="mt-2 text-xs text-ink-soft">
                Cele mai recente {RECENT_SHOWN} din {fmtIntreruperi(live.recentEnded.length)}{' '}
                încheiate în acest interval; restul apar pe paginile punctelor termice.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed">
            Nicio întrerupere de apă caldă încheiată în ultimele {RECENT_ENDED_DAYS} zile în
            Sectorul {sector} (date până la {fmtDateRo(meta.data_through)}).
          </p>
        )}
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
