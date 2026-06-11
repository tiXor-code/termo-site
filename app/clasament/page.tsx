import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getMeta,
  getPtRanking,
  getSectoareRanking,
  getStraziRanking,
  lastCompleteYear,
} from '@/lib/data';
import { fmtDec, fmtInt } from '@/lib/format';

export const dynamic = 'error';

export const metadata: Metadata = {
  title: 'Clasamente — puncte termice, străzi și sectoare',
  description:
    'Clasamentele zilelor fără apă caldă din București: puncte termice, străzi și sectoare, pe fiecare an.',
  alternates: { canonical: '/clasament' },
};

export default function ClasamentHubPage() {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const topPt = getPtRanking(lcy).slice(0, 5);
  const topStrazi = getStraziRanking(lcy).slice(0, 5);
  const sectoare = getSectoareRanking(lcy);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Clasamente</h1>
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">
        Zile fără apă caldă în {lcy}, pe puncte termice, străzi și sectoare. Fiecare clasament
        există pentru fiecare an din {meta.years[0]} până în {meta.years[meta.years.length - 1]}.
      </p>

      <div className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-3">
        <section>
          <h2 className="hairline-b pb-2 font-display text-xl font-bold">Puncte termice</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {topPt.map((r, i) => (
              <li key={r.slug} className="flex items-baseline gap-x-2">
                <span className="tnum text-ink-soft">{i + 1}.</span>
                <Link href={`/punct-termic/${r.slug}`} className="min-w-0 flex-1 truncate hover:underline">
                  {r.name}
                </Link>
                <span className="tnum">{fmtInt(r.days)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm">
            <Link href="/clasament/puncte-termice" className="underline">
              Clasamentul complet al punctelor termice
            </Link>
          </p>
        </section>

        <section>
          <h2 className="hairline-b pb-2 font-display text-xl font-bold">Străzi</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {topStrazi.map((r, i) => (
              <li key={r.slug} className="flex items-baseline gap-x-2">
                <span className="tnum text-ink-soft">{i + 1}.</span>
                <Link href={`/strada/${r.slug}`} className="min-w-0 flex-1 truncate hover:underline">
                  {r.name}
                </Link>
                <span className="tnum">{fmtInt(r.days)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm">
            <Link href="/clasament/strazi" className="underline">
              Clasamentul complet al străzilor
            </Link>
          </p>
        </section>

        <section>
          <h2 className="hairline-b pb-2 font-display text-xl font-bold">Sectoare</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {[...sectoare]
              .sort((a, b) => b.median_days - a.median_days)
              .map((r, i) => (
                <li key={r.sector} className="flex items-baseline gap-x-2">
                  <span className="tnum text-ink-soft">{i + 1}.</span>
                  <Link href={`/sector/${r.sector}`} className="min-w-0 flex-1 hover:underline">
                    Sector {r.sector}
                  </Link>
                  <span className="tnum">
                    {fmtInt(r.median_days)} <span className="text-ink-soft">(medie {fmtDec(r.mean_days)})</span>
                  </span>
                </li>
              ))}
          </ol>
          <p className="mt-4 text-sm">
            <Link href="/clasament/sectoare" className="underline">
              Comparația pe sectoare
            </Link>
          </p>
        </section>
      </div>

      <section className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-xl font-bold">Pe ani</h2>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {meta.years.map((y) => (
            <li key={y}>
              <Link href={`/clasament/puncte-termice/${y}`} className="hover:underline">
                {y}
                {meta.partial_years.includes(y) ? '*' : ''}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-soft">* an incomplet</p>
      </section>
    </main>
  );
}
