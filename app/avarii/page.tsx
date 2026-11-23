import type { Metadata } from 'next';
import Link from '@/components/Link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getMeta, lastCompleteYear } from '@/lib/data';
import { fmtDateRo, fmtDateTimeRo, fmtInt } from '@/lib/format';
import { getSectorLive, type OngoingGroup, type SectorLive } from '@/lib/sector-live';
import { faqJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'error';

const SECTOR_IDS = [1, 2, 3, 4, 5, 6];

/** Names shown inline per announcement before the rest folds into <details>. */
const PTS_SHOWN = 6;

/** "o întrerupere" / "3 întreruperi" / "21 de întreruperi" (mirrors /sector/[id]). */
function fmtIntreruperi(n: number): string {
  if (n === 1) return 'o întrerupere';
  if (n >= 20) return `${fmtInt(n)} de întreruperi`;
  return `${n} întreruperi`;
}

/** "un punct termic" / "3 puncte termice" / "56 de puncte termice" (mirrors /sector/[id]). */
function fmtPuncteTermice(n: number): string {
  if (n === 1) return 'un punct termic';
  const lastTwo = Math.abs(Math.trunc(n)) % 100;
  if (n !== 0 && (lastTwo === 0 || lastTwo >= 20)) return `${fmtInt(n)} de puncte termice`;
  return `${n} puncte termice`;
}

interface CityGroup extends OngoingGroup {
  sector: number;
}

interface CityLive {
  perSector: { sector: number; live: SectorLive }[];
  /** All ongoing announcement groups city-wide, avarie first, newest start first. */
  groups: CityGroup[];
  ongoingTotal: number;
  avarii: number;
  programate: number;
}

/** City-wide roll-up of the per-sector live views (same nightly bundle). */
function getCityLive(avarieYear: number): CityLive {
  const perSector = SECTOR_IDS.map((sector) => ({ sector, live: getSectorLive(sector, avarieYear) }));
  const groups: CityGroup[] = perSector.flatMap(({ sector, live }) =>
    live.groups.map((g) => ({ ...g, sector })),
  );
  groups.sort((a, b) => {
    const aAvarie = a.cause_class === 'avarie' ? 0 : 1;
    const bAvarie = b.cause_class === 'avarie' ? 0 : 1;
    if (aAvarie !== bAvarie) return aAvarie - bAvarie;
    return b.start.localeCompare(a.start);
  });
  const all = perSector.flatMap(({ live }) => live.ongoing);
  return {
    perSector,
    groups,
    ongoingTotal: all.length,
    avarii: all.filter((o) => o.cause_class === 'avarie').length,
    programate: all.filter((o) => o.cause_class === 'programat').length,
  };
}

/** First sentence of the page and of FAQ #1 — city status at data_through. */
function statusSentence(city: CityLive, dataThrough: string): string {
  const date = fmtDateRo(dataThrough);
  if (city.ongoingTotal === 0) {
    return `La ${date} nu era anunțată nicio întrerupere de apă caldă în curs în București.`;
  }
  const n = city.ongoingTotal;
  const verb = n === 1 ? 'era anunțată' : 'erau anunțate';
  let detail = '';
  if (n === 1) {
    detail =
      city.avarii === 1
        ? ' (avarie)'
        : city.programate === 1
          ? ' (oprire programată)'
          : ' (cauză neprecizată în anunț)';
  } else if (city.avarii === n) {
    detail = ', toate din avarii';
  } else if (city.avarii === 0) {
    detail =
      city.programate === n ? ', toate opriri programate' : ', niciuna anunțată ca avarie';
  } else {
    detail = `, dintre care ${city.avarii} din avarii`;
  }
  return `La ${date}, în București ${verb} ${fmtIntreruperi(n)} de apă caldă în curs${detail}.`;
}

/**
 * Only the restoration term Termoenergetica announced (remediere_last), marked
 * as an operator estimate — never a forecast of our own (mirrors /sector/[id]).
 */
function restoreSentence(city: CityLive, dataThrough: string): string {
  const date = fmtDateRo(dataThrough);
  if (city.ongoingTotal === 0) {
    return `La ${date} Termoenergetica nu anunța nicio întrerupere de apă caldă în curs în București, deci nici vreun termen de restabilire.`;
  }
  const terms = city.groups
    .map((g) => g.remediere_last)
    .filter((t): t is string => t !== null)
    .sort();
  if (terms.length === 0) {
    return `Doar Termoenergetica anunță când revine apa caldă, iar la ${date} anunțurile pentru întreruperile în curs nu precizau un termen de restabilire.`;
  }
  const first = terms[0];
  const last = terms[terms.length - 1];
  const when =
    first === last
      ? fmtDateTimeRo(last)
      : `între ${fmtDateTimeRo(first)} și ${fmtDateTimeRo(last)}, în funcție de anunț`;
  return `Doar Termoenergetica anunță când revine apa caldă: pentru întreruperile în curs la ${date}, termenul de restabilire anunțat era ${when}. E o estimare a operatorului, nu o garanție.`;
}

/** Short status for the meta description (same cause wording as statusSentence). */
function metaStatus(city: CityLive): string {
  const n = city.ongoingTotal;
  if (n === 0) return 'nicio întrerupere anunțată în curs';
  if (n === 1) {
    if (city.avarii === 1) return 'o avarie în curs';
    return city.programate === 1
      ? 'o oprire programată în curs'
      : 'o întrerupere în curs, cauză neprecizată în anunț';
  }
  if (city.avarii === n) return `${fmtIntreruperi(n)} în curs, toate din avarii`;
  if (city.avarii === 0) {
    return city.programate === n
      ? `${fmtIntreruperi(n)} în curs, toate opriri programate`
      : `${fmtIntreruperi(n)} în curs, niciuna anunțată ca avarie`;
  }
  return `${fmtIntreruperi(n)} în curs, dintre care ${city.avarii} din avarii`;
}

// Title + layout suffix "| Fără Apă Caldă" = 56 chars. Leads with the searcher's
// own wording ("termoenergetica avarii"); the dated description keeps the
// nightly-snapshot framing, so the snippet never implies real-time data.
export function generateMetadata(): Metadata {
  const meta = getMeta();
  const city = getCityLive(lastCompleteYear());
  const date = fmtDateRo(meta.data_through);
  const lead = `Avariile Termoenergetica din București: la ${date}, ${metaStatus(city)}`;
  const candidates =
    city.ongoingTotal > 0
      ? [
          `${lead}, pe sectoare, cu termenul de restabilire anunțat de Termoenergetica.`,
          `${lead}, pe sectoare. Sursa: anunțurile Termoenergetica.`,
          `${lead}.`,
        ]
      : [
          `${lead}. Anunțurile pe sectoare, arhivate în fiecare noapte de pe cmteb.ro.`,
          `${lead}. Sursa: anunțurile Termoenergetica.`,
          `${lead}.`,
        ];
  const description =
    candidates.find((c) => [...c].length <= 160) ?? candidates[candidates.length - 1];
  return {
    title: 'Avarii Termoenergetica azi în București',
    description,
    alternates: { canonical: '/avarii' },
  };
}

export default function AvariiPage() {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const city = getCityLive(lcy);

  const status = statusSentence(city, meta.data_through);
  const restore = restoreSentence(city, meta.data_through);
  const ptsAffected = city.groups.reduce((a, g) => a + g.pts.length, 0);

  // FAQ answers are plain strings so the FAQPage JSON-LD matches the visible
  // text exactly; links live outside the answers (same rule as /sector/[id]).
  // Contact numbers repeat the guide sourced from cmteb.ro/contact.php.
  const faq: { question: string; answer: string }[] = [
    {
      question: 'Câte avarii de apă caldă sunt acum în București?',
      answer:
        `${status} Situația de pe această pagină vine din anunțurile publice Termoenergetica, ` +
        `arhivate o dată pe noapte, deci o avarie apărută azi poate intra pe listă abia la ` +
        `următoarea actualizare. Pentru situația din acest moment, sursa rămâne Termoenergetica.`,
    },
    {
      question: 'Când revine apa caldă după o avarie?',
      answer:
        `${restore} Termenul fiecărui anunț apare în tabelul de pe această pagină, la ` +
        `„Termen anunțat de Termoenergetica”, și pe pagina fiecărui punct termic afectat.`,
    },
    {
      question: 'Unde anunță Termoenergetica avariile?',
      answer:
        `Termoenergetica publică avariile și opririle pe pagina de funcționare a sistemului de ` +
        `termoficare de pe cmteb.ro, pe sectoare: punctele termice afectate, cauza și termenul ` +
        `estimat de restabilire. Compania are și aplicația de mobil TERMOALERT, cu notificări ` +
        `pentru zona ta, și numărul 031.9442 cu mesaje preînregistrate pe sectoare, non-stop. ` +
        `Fără Apă Caldă arhivează aceste anunțuri în fiecare noapte și le arată aici, grupate pe anunț.`,
    },
    {
      question: 'Pe cine sun pentru o avarie la apă caldă sau la căldură?',
      answer:
        `Pentru sesizări și reclamații, Termoenergetica indică linia gratuită TELVERDE ` +
        `0800.820.002 și câte un dispecerat non-stop pentru fiecare sector. Numerele, adresele ` +
        `secțiilor și ce să ai pregătit când suni sunt în ghidul de contact de pe acest site, ` +
        `preluat de pe pagina oficială de contact a companiei. Fără Apă Caldă este un proiect ` +
        `independent și nu preia sesizări.`,
    },
    {
      question: 'Termoenergetica și RADET sunt aceeași companie?',
      answer:
        `Compania Municipală Termoenergetica București a preluat în 2019 activitatea RADET, ` +
        `fostul operator al termoficării din București. Ea operează rețeaua și punctele termice ` +
        `și publică anunțurile de avarii și opriri; multă lume caută încă „avarii RADET”, dar ` +
        `anunțurile oficiale sunt pe site-ul Termoenergetica, cmteb.ro.`,
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Acasă', href: '/' },
          { name: 'Avarii azi', href: '/avarii' },
        ]}
      />
      {/* "azi" is a topic label; the dated line below says how fresh the data is
          (same convention as /sector/[id]). */}
      <h1 className="mt-6 font-display text-3xl font-bold">
        Avarii Termoenergetica azi în București
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Ultima actualizare:{' '}
        <time dateTime={meta.data_through}>{fmtDateRo(meta.data_through)}</time>, din anunțurile
        publice Termoenergetica. Proiect independent, neafiliat cu Termoenergetica sau PMB.
      </p>

      {/* Answer-first: city status + announced restore term (only when something
          is ongoing) + where the rest of the page goes. */}
      <p className="mt-4 max-w-2xl leading-relaxed">
        {status}
        {city.ongoingTotal > 0 ? ` ${restore}` : ''} Mai jos: fiecare anunț în curs, situația pe
        sectoare și unde suni sau verifici la sursă.
      </p>

      <section className="mt-10">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">
          Ce avarii și opriri sunt anunțate acum?
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed">
          Anunțurile de mai jos sunt cele publicate de Termoenergetica (compania care a preluat în
          2019 activitatea RADET) pentru toate sectoarele. Fără Apă Caldă doar le arhivează și le
          grupează; anunțul original e pe{' '}
          <a
            href="https://www.cmteb.ro/functionare_sistem_termoficare.php"
            className="underline"
            rel="nofollow"
          >
            pagina de funcționare a termoficării
          </a>
          .
        </p>
        {city.ongoingTotal > 0 ? (
          <>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed">
              La {fmtDateRo(meta.data_through)}: {fmtIntreruperi(city.ongoingTotal)} în curs, la{' '}
              {fmtPuncteTermice(ptsAffected)}, grupate pe{' '}
              {city.groups.length === 1
                ? 'un singur anunț'
                : `${city.groups.length} anunțuri`}{' '}
              Termoenergetica. Avariile sunt primele.
            </p>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full border-collapse text-sm tnum">
                <thead>
                  <tr className="hairline-b text-left text-xs text-ink-soft">
                    <th scope="col" className="py-2 pr-3 font-normal">Sector</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Cauză</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Început</th>
                    <th scope="col" className="py-2 pr-3 font-normal">Termen anunțat de Termoenergetica</th>
                    <th scope="col" className="py-2 font-normal">Puncte termice afectate</th>
                  </tr>
                </thead>
                <tbody>
                  {city.groups.map((g) => {
                    const shown = g.pts.slice(0, PTS_SHOWN);
                    const rest = g.pts.slice(PTS_SHOWN);
                    return (
                      <tr
                        key={`${g.sector}|${g.cause_class}|${g.start}|${g.remediere_last ?? ''}`}
                        className="hairline-b align-baseline"
                      >
                        <td className="py-2 pr-3 whitespace-nowrap font-sans">
                          <Link href={`/sector/${g.sector}`} className="hover:underline">
                            Sector {g.sector}
                          </Link>
                        </td>
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
          </>
        ) : (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed">
            Nicio întrerupere în curs anunțată la {fmtDateRo(meta.data_through)}. Dacă blocul tău
            nu are apă caldă,{' '}
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
          Actualizat o dată pe noapte din anunțurile publice Termoenergetica. O avarie apărută azi
          poate intra pe listă abia la următoarea actualizare.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">
          Cum stau sectoarele acum?
        </h2>
        <table className="mt-3 w-full max-w-2xl border-collapse text-sm tnum">
          <thead>
            <tr className="hairline-b text-left text-xs text-ink-soft">
              <th scope="col" className="py-2 pr-3 font-normal">Sector</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">În curs</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">din care avarii</th>
              <th scope="col" className="py-2 text-right font-normal">PT cu întreruperi, ultimele 30 de zile</th>
            </tr>
          </thead>
          <tbody>
            {city.perSector.map(({ sector, live }) => (
              <tr key={sector} className="hairline-b">
                <td className="py-2 pr-3 font-sans">
                  <Link href={`/sector/${sector}`} className="hover:underline">
                    Sector {sector}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-right">{fmtInt(live.ongoing.length)}</td>
                <td className="py-2 pr-3 text-right">
                  {fmtInt(live.ongoing.filter((o) => o.cause_class === 'avarie').length)}
                </td>
                <td className="py-2 text-right">
                  {fmtInt(live.ptsHit30d)} din {fmtInt(live.ptsTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 max-w-2xl text-sm text-ink-soft">
          Fiecare pagină de sector arată avariile în curs, cele mai afectate zone și istoricul pe
          ani. Pentru o adresă anume,{' '}
          <Link href="/cauta" className="underline">
            caută strada
          </Link>{' '}
          ca să vezi punctul termic care o deservește și istoricul lui complet.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">
          Suni sau verifici la sursă
        </h2>
        <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            <b>Anunțurile oficiale:</b>{' '}
            <a
              href="https://www.cmteb.ro/functionare_sistem_termoficare.php"
              className="underline"
              rel="nofollow"
            >
              funcționare sistem termoficare
            </a>{' '}
            pe cmteb.ro, pe sectoare, plus aplicația TERMOALERT.
          </li>
          <li>
            <b>Sesizări:</b> TELVERDE 0800.820.002 (gratuit) sau dispeceratul non-stop al
            sectorului tău —{' '}
            <Link
              href="/ghid/care-sunt-informatiile-de-contact-pentru-avarii-la-termoenergetica"
              className="underline"
            >
              toate numerele, pe sectoare
            </Link>
            .
          </li>
          <li>
            <b>Mesaje preînregistrate</b> despre funcționarea sistemului, pe sectoare: 031.9442
            (tarif normal, non-stop).
          </li>
          <li>
            <b>Istoricul zonei tale:</b>{' '}
            <Link href="/" className="underline">
              caută strada
            </Link>{' '}
            și vezi câte zile pe an a stat fără apă caldă, din decembrie 2021 până azi.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="hairline-b pb-2 font-display text-xl font-bold">Întrebări frecvente</h2>
        <div className="mt-3 max-w-2xl space-y-6">
          {faq.map((item) => (
            <div key={item.question}>
              <h3 className="font-display text-lg font-bold">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <JsonLd data={faqJsonLd(faq)} />
    </main>
  );
}
