import type { Metadata } from 'next';
import Link from 'next/link';
import MethodologyFootnote from '@/components/MethodologyFootnote';
import MonthBars from '@/components/MonthBars';
import SearchBox from '@/components/SearchBox';
import SectorSilhouetteMap from '@/components/SectorSilhouetteMap';
import TrendBars from '@/components/TrendBars';
import {
  clientAsset,
  getCitySummary,
  getMeta,
  getPtRanking,
  getSectoareRanking,
  getStraziRanking,
  getYearSummary,
  lastCompleteYear,
} from '@/lib/data';
import { fmtDateRo, fmtDec, fmtInt } from '@/lib/format';

export const dynamic = 'error';

export const metadata: Metadata = {
  description:
    'Câte zile pe an stă Bucureștiul fără apă caldă: clasamente pe puncte termice, străzi și sectoare, reconstruite din anunțurile publice Termoenergetica.',
  alternates: { canonical: '/' },
};

// Example streets shown as hero chips — real slugs verified present in the bundle.
const HERO_CHIPS: { slug: string; name: string }[] = [
  { slug: 'sos-pantelimon', name: 'Șoseaua Pantelimon' },
  { slug: 'drm-taberei', name: 'Drumul Taberei' },
  { slug: 'cal-vitan', name: 'Calea Vitan' },
  { slug: 'bld-lacul-tei', name: 'Bulevardul Tei' },
];

export default function HomePage() {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const summary = getYearSummary(lcy);
  const topPt = getPtRanking(lcy).slice(0, 10);
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

      {/* ===== Cum stă Bucureștiul ===== */}
      <section className="section border-t border-hairline py-12">
        <h2 className="font-display text-2xl font-bold">Cum stă Bucureștiul</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Datele se actualizează singure în fiecare noapte. Ultima actualizare:{' '}
          {fmtDateRo(meta.data_through)}.
        </p>

        <div className="cards mt-7">
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

        <h2 className="mt-9 mb-3.5 font-display text-xl font-bold">
          Cele mai afectate străzi în {lcy}
        </h2>
        <ul className="teaser">
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
        <div className="mt-4">
          <MonthBars
            values={summary.monthly_pt_days}
            year={lcy}
            ariaLabel={`Zile cumulate cu întreruperi pe lună în ${lcy}`}
          />
        </div>
      </section>

      <div className="mt-12 grid gap-x-12 gap-y-12 md:grid-cols-2">
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

      <div className="mt-12 grid gap-x-12 gap-y-12 md:grid-cols-2">
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
        <div className="mt-4">
          <TrendBars series={trend} unitLabel="mediana zilelor fără apă caldă pe punct termic" />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/harta" className="underline">
            Vezi harta punctelor termice
          </Link>
        </p>
      </section>
    </main>
  );
}
