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
import { fmtDateRo, fmtDec, fmtInt, fmtZile } from '@/lib/format';
import { getSectorLive, type SectorLive } from '@/lib/sector-live';

export const dynamic = 'error';

// Absolute: the layout's `%s | Fără Apă Caldă` template does not apply within
// the same route segment, so the brand suffix is written out here (59 chars).
// Leads with "Apă caldă București" for the city-wide queries ("apa calda",
// "apa calda bucuresti"); the description leads with "azi, pe sectoare"
// because the live-status intent is what the history angle was missing.
// "harta" queries are intentionally left to /harta (Site Brief v4).
export const metadata: Metadata = {
  title: { absolute: 'Apă caldă București: întreruperi pe străzi | Fără Apă Caldă' },
  description:
    'Avarii și opriri de apă caldă azi, pe sectoare, plus istoricul fiecărei străzi din București din 2021, din anunțurile Termoenergetica. Actualizat zilnic.',
  alternates: { canonical: '/' },
};

// Example streets shown as hero chips — real slugs verified present in the bundle.
const HERO_CHIPS: { slug: string; name: string }[] = [
  { slug: 'sos-pantelimon', name: 'Șoseaua Pantelimon' },
  { slug: 'drm-taberei', name: 'Drumul Taberei' },
  { slug: 'cal-vitan', name: 'Calea Vitan' },
  { slug: 'bld-lacul-tei', name: 'Bulevardul Tei' },
];

const SECTOR_IDS = [1, 2, 3, 4, 5, 6];

/** "o întrerupere" / "3 întreruperi" / "21 de întreruperi" — same rule as /sector. */
function fmtIntreruperi(n: number): string {
  if (n === 1) return 'o întrerupere';
  if (n >= 20) return `${fmtInt(n)} de întreruperi`;
  return `${n} întreruperi`;
}

/** "o avarie" / "3 avarii" / "21 de avarii". */
function fmtAvarii(n: number): string {
  if (n === 1) return 'o avarie';
  if (n >= 20) return `${fmtInt(n)} de avarii`;
  return `${n} avarii`;
}

/** City-wide version of the /sector status sentence, same cause wording. */
function cityStatusSentence(ongoing: number, avarii: number, dataThrough: string): string {
  const date = fmtDateRo(dataThrough);
  if (ongoing === 0) {
    return `La ${date} nu era anunțată nicio întrerupere de apă caldă în curs în București.`;
  }
  const verb = ongoing === 1 ? 'era anunțată' : 'erau anunțate';
  let detail = '';
  if (avarii === ongoing) {
    detail = ongoing === 1 ? ' (avarie)' : ', toate din avarii';
  } else if (avarii === 0) {
    detail = ', niciuna anunțată ca avarie';
  } else {
    detail = `, dintre care ${fmtAvarii(avarii)}`;
  }
  return `La ${date}, în București ${verb} ${fmtIntreruperi(ongoing)} de apă caldă în curs${detail}.`;
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

  // City-wide "azi" view: the same nightly per-sector live data /sector/N
  // renders, aggregated here for the answer-first block below the hero.
  const liveBySector: { sector: number; live: SectorLive }[] = SECTOR_IDS.map((s) => ({
    sector: s,
    live: getSectorLive(s, lcy),
  }));
  const cityOngoing = liveBySector.reduce((a, r) => a + r.live.ongoing.length, 0);
  const cityAvarii = liveBySector.reduce(
    (a, r) => a + r.live.ongoing.filter((o) => o.cause_class === 'avarie').length,
    0,
  );

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

      {/* ===== Este oprită apa caldă azi: city-level dated status =====
          Answer-first for the "azi / acum" half of "apa calda bucuresti":
          the same per-sector live view /sector/N renders, aggregated. The
          prose stays snippet-eligible (a dated status is the one number set
          that should reach the SERP); the table joins the numeric blocks
          under data-nosnippet. */}
      <section className="section border-t border-hairline py-10">
        <h2 className="font-display text-2xl font-bold">
          Este oprită apa caldă în București azi?
        </h2>
        <p className="mt-3 max-w-2xl">
          {cityStatusSentence(cityOngoing, cityAvarii, meta.data_through)} Situația pe
          sectoare e în tabelul de mai jos; pagina fiecărui sector are lista anunțurilor în
          curs, cu termenul de restabilire anunțat de Termoenergetica.
        </p>
        <table className="mt-4 w-full max-w-xl border-collapse text-sm tnum" data-nosnippet="">
          <thead>
            <tr className="hairline-b text-left text-xs text-ink-soft">
              <th scope="col" className="py-1.5 pr-3 font-normal">Sector</th>
              <th scope="col" className="py-1.5 pr-3 font-normal">Întreruperi în curs</th>
              <th scope="col" className="py-1.5 font-normal">
                Puncte termice afectate, ultimele 30 de zile
              </th>
            </tr>
          </thead>
          <tbody>
            {liveBySector.map(({ sector, live }) => {
              const avarii = live.ongoing.filter((o) => o.cause_class === 'avarie').length;
              return (
                <tr key={sector} className="hairline-b">
                  <td className="py-1.5 pr-3 font-sans">
                    <Link href={`/sector/${sector}`} className="hover:underline">
                      Sector {sector}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3">
                    {live.ongoing.length === 0
                      ? '—'
                      : avarii > 0
                        ? `${fmtInt(live.ongoing.length)} (${fmtAvarii(avarii)})`
                        : fmtInt(live.ongoing.length)}
                  </td>
                  <td className="py-1.5">
                    {fmtInt(live.ptsHit30d)} din {fmtInt(live.ptsTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-soft">
          Actualizat o dată pe noapte din anunțurile publice Termoenergetica; ultima
          actualizare: {fmtDateRo(meta.data_through)}. O avarie apărută azi poate intra pe
          listă abia la următoarea actualizare.
        </p>
      </section>

      {/* ===== Apă caldă în București: indexable intro =====
          Deliberately NOT data-nosnippet and deliberately number-free: the
          numeric blocks below stay out of snippets, this prose is the text
          Google and answer engines can quote for city-wide queries. */}
      <section className="section border-t border-hairline py-10">
        <h2 className="font-display text-2xl font-bold">Apă caldă în București: ce găsești aici</h2>
        <p className="mt-3 max-w-2xl">
          Fără Apă Caldă arată câte zile pe an a stat fiecare stradă, punct termic și sector din
          București fără apă caldă. Istoricul e reconstruit din anunțurile publice Termoenergetica,
          arhivate din decembrie 2021, și se actualizează în fiecare noapte. Suntem un proiect
          independent, nu Termoenergetica, CMTEB sau Primăria.
        </p>
        <ul className="mt-4 max-w-2xl list-disc space-y-2 pl-5">
          <li>
            <b>Avarii azi în sectorul tău:</b>{' '}
            {SECTOR_IDS.map((id, i) => (
              <span key={id}>
                {i > 0 ? ', ' : ''}
                <Link href={`/sector/${id}`} className="underline">
                  Sector {id}
                </Link>
              </span>
            ))}
            . Vezi avariile în curs și termenul anunțat de Termoenergetica, marcat ca atare. Pentru
            situația exactă din acest moment, sursa rămâne Termoenergetica.
          </li>
          <li>
            <b>Istoricul unei adrese:</b> caută strada sau punctul termic mai sus, înainte să semnezi
            chiria sau să cumperi.
          </li>
          <li>
            <b>Pe hartă:</b>{' '}
            <Link href="/harta" className="underline">
              harta punctelor termice
            </Link>{' '}
            arată zilele fără apă caldă din fiecare an.
          </li>
          <li>
            <b>Opriri, nu presiune scăzută:</b> cifrele principale numără doar opririle; presiunea
            și temperatura scăzută sunt numărate separat (
            <Link href="/metodologie#deficiente" className="underline">
              metodologie
            </Link>
            ).
          </li>
          <li>
            <b>Pe scurt, pas cu pas:</b>{' '}
            <Link href="/ghid/apa-calda" className="underline">
              ghidul apei calde în București
            </Link>{' '}
            — unde vezi anunțul, când revine apa, cum citești cifrele.
          </li>
        </ul>
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
            {/* No "harta" wording here: /harta is the single page for map queries. */}
            <SectorSilhouetteMap
              values={sectorValues}
              ariaLabel={`Sectoarele Bucureștiului — mediana zilelor fără apă caldă în ${lcy}`}
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
            Harta apei calde pe puncte termice, an cu an →
          </Link>
        </p>
      </section>
    </main>
  );
}
