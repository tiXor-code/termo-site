import type { Metadata } from 'next';
import Link from '@/components/Link';
import MethodologyFootnote from '@/components/MethodologyFootnote';
import MonthBars from '@/components/MonthBars';
import SearchBox from '@/components/SearchBox';
import SectorSilhouetteMap from '@/components/SectorSilhouetteMap';
import TrendBars from '@/components/TrendBars';
import {
  clientAsset,
  getCitySummary,
  getMeta,
  getPtAll,
  getPtRanking,
  getSectoareRanking,
  getStraziRanking,
  getYearSummary,
  lastCompleteYear,
} from '@/lib/data';
import { deFor, fmtDateRo, fmtDec, fmtInt, fmtZile } from '@/lib/format';
import { getSectorLive } from '@/lib/sector-live';
import { faqJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'error';

export const metadata: Metadata = {
  // The layout's title.template applies only to child segments, so the root
  // page carries the brand suffix itself (59 rendered chars, inside 30-60).
  title: 'Apă caldă București: avarii azi și istoric | Fără Apă Caldă',
  description:
    'Avarii de apă caldă în curs în București, pe sectoare, actualizate zilnic din anunțurile Termoenergetica. Plus istoricul pe străzi, din 2021 până azi.',
  alternates: { canonical: '/' },
};

// Example streets shown as hero chips — real slugs verified present in the bundle.
const HERO_CHIPS: { slug: string; name: string }[] = [
  { slug: 'sos-pantelimon', name: 'Șoseaua Pantelimon' },
  { slug: 'drm-taberei', name: 'Drumul Taberei' },
  { slug: 'cal-vitan', name: 'Calea Vitan' },
  { slug: 'bld-lacul-tei', name: 'Bulevardul Tei' },
];

const SECTORS = [1, 2, 3, 4, 5, 6];

/** "un punct termic" / "3 puncte termice" / "56 de puncte termice". */
function fmtPuncteTermice(n: number): string {
  if (n === 1) return 'un punct termic';
  return `${fmtInt(n)} ${deFor(n)}puncte termice`;
}

/** Per-sector rollup of the ongoing announcements at data_through. */
interface SectorLiveRow {
  sector: number;
  /** Distinct PTs with an ongoing interruption. */
  pts: number;
  /** Of those, distinct PTs whose ongoing interruption is an avarie. */
  ptsAvarie: number;
}

/** First sentence of the live section and of FAQ #1 — citywide status at data_through. */
function cityStatusSentence(rows: SectorLiveRow[], dataThrough: string): string {
  const date = fmtDateRo(dataThrough);
  const total = rows.reduce((a, r) => a + r.pts, 0);
  if (total === 0) {
    return `La ${date} nu era anunțată nicio întrerupere de apă caldă în curs în București.`;
  }
  const avarie = rows.reduce((a, r) => a + r.ptsAvarie, 0);
  let detail = '';
  if (avarie === total) detail = total === 1 ? ', din avarie' : ', toate din avarii';
  else if (avarie === 0) detail = ', niciunul din avarii';
  else detail = `, ${fmtInt(avarie)} dintre ele din avarii`;
  // "cele mai multe în Sectorul X" only when a single sector holds the maximum.
  const max = Math.max(...rows.map((r) => r.pts));
  const atMax = rows.filter((r) => r.pts === max);
  const unde =
    total > 1 && atMax.length === 1 ? `, cele mai multe în Sectorul ${atMax[0].sector}` : '';
  return `La ${date}, ${fmtPuncteTermice(total)} din București ${total === 1 ? 'avea' : 'aveau'} apa caldă oprită prin întreruperi anunțate în curs${detail}${unde}.`;
}

export default function HomePage() {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const summary = getYearSummary(lcy);
  const ptRanking = getPtRanking(lcy);
  const topPt = ptRanking.slice(0, 10);
  const cityHeadlineDays = ptRanking.reduce((a, r) => a + r.days, 0);
  // `days` summed over the ranking already equals the universe total (a PT with
  // zero outage days contributes 0 and is simply absent from the ranking), but
  // DEFICIENTA does not: the zero-outage PTs are dropped from the ranking while
  // still carrying deficiency days - 39 of them in 2025, 273 in 2026. Sum that
  // half over the full universe so the sentence below is literally true.
  const cityDeficientaDays = [...getPtAll().values()].reduce(
    (a, pt) => a + (pt.years[String(lcy)]?.days_deficienta ?? 0),
    0,
  );
  const topStrazi = getStraziRanking(lcy).slice(0, 10);
  const teaserStrazi = topStrazi.slice(0, 5);
  const teaserMax = teaserStrazi.length > 0 ? teaserStrazi[0].days : 0;
  const sectoare = getSectoareRanking(lcy);
  const trend = getCitySummary().map((s) => ({
    label: String(s.year),
    value: s.median_pt_days,
    partial: s.partial,
    href: `/clasament/puncte-termice/${s.year}`,
  }));
  const sectorValues: Record<number, number> = {};
  for (const r of sectoare) sectorValues[r.sector] = r.median_days;

  // Total reconstructed outage episodes across all years (real figure).
  const totalEpisodes = getCitySummary().reduce((acc, s) => acc + s.episodes, 0);
  const sharePct = Math.round(summary.share_universe_hit_pct);

  // Citywide live status: the sector rollups the /sector pages already compute,
  // counted in distinct PTs (an episode row is one PT, deduped by slug).
  const liveRows: SectorLiveRow[] = SECTORS.map((sector) => {
    const live = getSectorLive(sector, lcy);
    return {
      sector,
      pts: new Set(live.ongoing.map((o) => o.slug)).size,
      ptsAvarie: new Set(
        live.ongoing.filter((o) => o.cause_class === 'avarie').map((o) => o.slug),
      ).size,
    };
  });
  const cityStatus = cityStatusSentence(liveRows, meta.data_through);

  // FAQ answers are plain strings so the FAQPage JSON-LD matches the visible
  // text exactly; links live outside the answers.
  const faq: { question: string; answer: string }[] = [
    {
      question: 'De ce nu am apă caldă?',
      answer:
        `Blocurile din București racordate la sistemul centralizat primesc apă caldă de la un ` +
        `punct termic. Când punctul termic e oprit — de o avarie sau de lucrări programate — ` +
        `blocurile pe care le deservește rămân fără apă caldă, chiar dacă străzile vecine nu ` +
        `sunt afectate. ${cityStatus} Caută strada ta pe site ca să vezi punctul termic care o ` +
        `deservește și întreruperile lui în curs.`,
    },
    {
      question: 'Când revine apa caldă după o avarie?',
      answer:
        `Termoenergetica publică pentru fiecare întrerupere un termen estimat de restabilire. ` +
        `Pe acest site, termenul apare în tabelul de întreruperi în curs de pe pagina ` +
        `sectorului și pe pagina fiecărui punct termic afectat. Durata mediană a unei avarii ` +
        `diferă de la un sector la altul; o găsești pe pagina fiecărui sector.`,
    },
    {
      question: 'Cine oprește și repornește apa caldă în București?',
      answer:
        `Apa caldă din sistemul centralizat e furnizată de Compania Municipală Termoenergetica ` +
        `București (CMTEB), care anunță public avariile și opririle programate. Acest site ` +
        `arhivează anunțurile în fiecare noapte, din decembrie 2021, și nu e afiliat cu ` +
        `Termoenergetica; pentru anunțurile din ultimele ore verifică sursa oficială.`,
    },
    {
      question: 'Cât de des rămâne Bucureștiul fără apă caldă?',
      answer:
        `În ${lcy}, punctul termic median din București a stat ${fmtZile(summary.median_pt_days)} ` +
        `fără apă caldă, iar ${sharePct}% din punctele termice au avut cel puțin o întrerupere. ` +
        `Din decembrie 2021 până azi, site-ul a reconstruit ${fmtInt(totalEpisodes)} ` +
        `${deFor(totalEpisodes)}episoade de întreruperi din anunțurile publice.`,
    },
    {
      question: 'Apa e doar călduță sau abia curge — e tot oprire?',
      answer:
        `Nu. Termoenergetica anunță separat opririle de apă caldă și deficiențele — presiune ` +
        `sau temperatură scăzută. Cifrele principale ale site-ului numără doar zilele de ` +
        `oprire; în ${lcy}, pe lângă ${fmtZile(cityHeadlineDays)} de oprire (punct termic × zi), ` +
        `punctele termice din București au adunat ${fmtZile(cityDeficientaDays)} cu presiune ` +
        `sau temperatură scăzută, numărate separat.`,
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4">
      {/* ===== search-first hero ===== */}
      <header className="hero">
        <span className="eyebrow">Înainte să semnezi chiria</span>
        <h1>Câte zile pe an stă strada ta fără apă caldă?</h1>
        <p className="sub">
          Istoricul complet al întreruperilor din București, stradă cu stradă, din 2021 până azi.
        </p>
        <div className="search-shell">
          <SearchBox variant="hero" indexUrl={clientAsset('search-index.json')} year={lcy} />
        </div>
        <div className="chips">
          {HERO_CHIPS.map((c) => (
            <Link key={c.slug} className="chip" href={`/strada/${c.slug}`}>
              {c.name}
            </Link>
          ))}
        </div>
      </header>

      {/* ===== live status — the "acum" intent, answered citywide ===== */}
      <section className="section border-t border-hairline py-12">
        <h2 className="font-display text-2xl font-bold">
          Sunt avarii de apă caldă în București acum?
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed">
          {cityStatus} Situația fiecărui sector, cu termenele estimate de restabilire și
          punctele termice afectate, e pe pagina sectorului.
        </p>
        <table className="mt-4 w-full max-w-md border-collapse text-sm tnum" data-nosnippet="">
          <thead>
            <tr className="hairline-b text-left text-xs text-ink-soft">
              <th scope="col" className="py-1.5 pr-3 font-normal">Sector</th>
              <th scope="col" className="py-1.5 pr-3 text-right font-normal">
                Puncte termice oprite acum
              </th>
              <th scope="col" className="py-1.5 text-right font-normal">din care avarii</th>
            </tr>
          </thead>
          <tbody>
            {liveRows.map((r) => (
              <tr key={r.sector} className="hairline-b">
                <td className="py-1.5 pr-3 font-sans">
                  <Link href={`/sector/${r.sector}`} className="hover:underline">
                    Sector {r.sector}
                  </Link>
                </td>
                <td className="py-1.5 pr-3 text-right">{fmtInt(r.pts)}</td>
                <td className="py-1.5 text-right">{fmtInt(r.ptsAvarie)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 max-w-2xl text-xs text-ink-soft">
          Actualizat o dată pe noapte din anunțurile publice Termoenergetica. O avarie apărută
          azi poate intra pe listă abia la următoarea actualizare — pentru ultimele ore verifică
          și{' '}
          <a href="https://www.cmteb.ro" className="underline" rel="nofollow">
            cmteb.ro
          </a>
          .
        </p>
      </section>

      {/* ===== Cum stă Bucureștiul ===== */}
      <section className="section border-t border-hairline py-12">
        <h2 className="font-display text-2xl font-bold">Cum stă Bucureștiul</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Datele se actualizează singure în fiecare noapte. Ultima actualizare:{' '}
          {fmtDateRo(meta.data_through)}.
        </p>

        {/* data-nosnippet: Google was assembling the SERP snippet from these stat
            fragments instead of the meta description; keep all numeric blocks out. */}
        <div className="cards mt-7" data-nosnippet="">
          <div className="card">
            <div className="big tnum">{fmtInt(summary.median_pt_days)}</div>
            <div className="lab">zile mediane fără apă caldă pe punct termic, în {lcy}</div>
          </div>
          <div className="card">
            <div className="big tnum">{sharePct}%</div>
            <div className="lab">din punctele termice au fost afectate măcar o dată în {lcy}</div>
          </div>
          <div className="card">
            <div className="big tnum">{fmtInt(totalEpisodes)}</div>
            <div className="lab">episoade de întreruperi reconstruite, din decembrie 2021</div>
          </div>
        </div>

        <p className="mt-4 max-w-2xl text-sm text-ink-soft" data-nosnippet="">
          Cifrele de mai sus numără doar zilele de <b>oprire</b> a apei calde. În {lcy},
          punctele termice din București au adunat {fmtZile(cityHeadlineDays)} de oprire
          (punct termic × zi) și, pe lângă ele, încă{' '}
          <b>{fmtZile(cityDeficientaDays)} cu presiune sau temperatură scăzută</b> —
          numărate separat, pentru că nu sunt opriri.{' '}
          <Link href="/metodologie#deficiente" className="underline">
            Cât de mare e ce nu numărăm.
          </Link>
        </p>

        <h2 className="mt-9 mb-3.5 font-display text-xl font-bold">
          Cele mai afectate străzi în {lcy}
        </h2>
        <ul className="teaser" data-nosnippet="">
          {teaserStrazi.map((r, i) => (
            <li key={r.slug}>
              <span className="rank tnum">{i + 1}</span>
              <span className="name">
                <Link href={`/strada/${r.slug}`}>{r.name}</Link>
              </span>
              <span className="bar">
                <span
                  style={{ width: `${teaserMax > 0 ? Math.round((r.days / teaserMax) * 100) : 0}%` }}
                />
              </span>
              <span className="days tnum">
                {fmtInt(r.days)} <small>zile</small>
              </span>
            </li>
          ))}
        </ul>
        <Link className="more" href="/clasament/strazi">
          Vezi clasamentul complet →
        </Link>
      </section>

      {/* ===== existing dashboard (moved below the fold, unchanged) ===== */}
      <section className="mt-10 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Pe luni — {lcy}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Zile cumulate (punct termic × zi) cu întreruperi de apă caldă, pe lună.
        </p>
        <div className="mt-4" data-nosnippet="">
          <MonthBars
            values={summary.monthly_pt_days}
            year={lcy}
            ariaLabel={`Zile cumulate cu întreruperi pe lună în ${lcy}`}
          />
        </div>
      </section>

      <div className="mt-12 grid gap-x-12 gap-y-12 md:grid-cols-2" data-nosnippet="">
        <section>
          <h2 className="hairline-b pb-2 font-display text-2xl font-bold">
            Cele mai afectate puncte termice
          </h2>
          <table className="mt-3 w-full border-collapse text-sm tnum">
            <thead>
              <tr className="hairline-b text-left text-xs text-ink-soft">
                <th scope="col" className="py-1.5 pr-3 font-normal">Punct termic</th>
                <th scope="col" className="py-1.5 pr-3 font-normal">Sector</th>
                <th scope="col" className="py-1.5 text-right font-normal">Zile</th>
              </tr>
            </thead>
            <tbody>
              {topPt.map((r) => (
                <tr key={r.slug} className="hairline-b">
                  <td className="py-1.5 pr-3 font-sans">
                    <Link href={`/punct-termic/${r.slug}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3">{r.sector}</td>
                  <td className="py-1.5 text-right">{fmtInt(r.days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm">
            <Link href="/clasament/puncte-termice" className="underline">
              Clasamentul complet
            </Link>
          </p>
        </section>

        <section>
          <h2 className="hairline-b pb-2 font-display text-2xl font-bold">
            Cele mai afectate străzi
          </h2>
          <table className="mt-3 w-full border-collapse text-sm tnum">
            <thead>
              <tr className="hairline-b text-left text-xs text-ink-soft">
                <th scope="col" className="py-1.5 pr-3 font-normal">Stradă</th>
                <th scope="col" className="py-1.5 pr-3 font-normal">Sector</th>
                <th scope="col" className="py-1.5 text-right font-normal">Zile</th>
              </tr>
            </thead>
            <tbody>
              {topStrazi.map((r) => (
                <tr key={r.slug} className="hairline-b">
                  <td className="py-1.5 pr-3 font-sans">
                    <Link href={`/strada/${r.slug}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3">{r.sectors.join('–')}</td>
                  <td className="py-1.5 text-right">{fmtInt(r.days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm">
            <Link href="/clasament/strazi" className="underline">
              Clasamentul complet
            </Link>
          </p>
        </section>
      </div>

      <div className="mt-12 grid gap-x-12 gap-y-12 md:grid-cols-2" data-nosnippet="">
        <section>
          <h2 className="hairline-b pb-2 font-display text-2xl font-bold">Pe sectoare</h2>
          <table className="mt-3 w-full max-w-xs border-collapse text-sm tnum">
            <thead>
              <tr className="hairline-b text-left text-xs text-ink-soft">
                <th scope="col" className="py-1.5 pr-3 font-normal">Sector</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-normal">Mediană</th>
                <th scope="col" className="py-1.5 text-right font-normal">Medie</th>
              </tr>
            </thead>
            <tbody>
              {sectoare.map((r) => (
                <tr key={r.sector} className="hairline-b">
                  <td className="py-1.5 pr-3 font-sans">
                    <Link href={`/sector/${r.sector}`} className="hover:underline">
                      Sector {r.sector}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-right">{fmtInt(r.median_days)}</td>
                  <td className="py-1.5 text-right">{fmtDec(r.mean_days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3">
            <MethodologyFootnote anchor="ce-numaram">
              Medii pe toate punctele termice din sector, inclusiv cele fără întreruperi — valori
              indicative.
            </MethodologyFootnote>
          </div>
        </section>

        <section>
          <h2 className="hairline-b pb-2 font-display text-2xl font-bold">În oraș</h2>
          <div className="mt-4">
            <SectorSilhouetteMap
              values={sectorValues}
              ariaLabel={`Harta sectoarelor — mediana zilelor fără apă caldă în ${lcy}`}
            />
          </div>
        </section>
      </div>

      <section className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Evoluție pe ani</h2>
        <div className="mt-4" data-nosnippet="">
          <TrendBars series={trend} unitLabel="mediana zilelor fără apă caldă pe punct termic" />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/harta" className="underline">
            Vezi harta punctelor termice
          </Link>
        </p>
      </section>

      <section className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Întrebări frecvente</h2>
        <div className="mt-4 max-w-2xl space-y-6">
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
