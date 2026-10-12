import type { Metadata } from 'next';
import Link from '@/components/Link';
import { clientAsset, getMeta, getPtRanking, lastCompleteYear } from '@/lib/data';
import { fmtDateRo } from '@/lib/format';
import HartaClient from './harta-client';

export const dynamic = 'error';

// Primary page for "harta apa calda" / "harta apa calda bucuresti" /
// "harta puncte termice bucuresti" (Site Brief v3). The homepage deliberately
// avoids "harta" wording and links here instead.
// Title + layout suffix "| Fără Apă Caldă" = 58 chars.
export const metadata: Metadata = {
  title: 'Harta apă caldă București: puncte termice',
  description:
    'Harta apei calde din București pe puncte termice: câte zile a stat fiecare fără apă caldă, pe ani, din anunțurile publice Termoenergetica. Actualizat zilnic.',
  alternates: { canonical: '/harta' },
};

export default function HartaPage() {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const ranking = getPtRanking(lcy);
  const maxDays = ranking[0]?.days ?? 1;
  // scripts/fetch-data.mjs publishes map geojson only for non-future years
  // (y <= year of data_through) — mirror that filter so the sets never diverge.
  const dataThroughYear = Number(String(meta.data_through).slice(0, 4));
  const mapYears = meta.years.filter((y) => y <= dataThroughYear);
  const geojsonUrls: Record<string, string> = {};
  for (const y of mapYears) {
    geojsonUrls[String(y)] = clientAsset(`map/pt-${y}.geojson`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">
        Harta apei calde din București, pe puncte termice
      </h1>
      <p className="mt-2 max-w-2xl">
        Fiecare punct de pe hartă este un punct termic. Culoarea și mărimea lui arată câte zile a
        stat fără apă caldă în anul ales, reconstruite din anunțurile publice Termoenergetica.
        Presiunea sau temperatura scăzută nu schimbă culoarea: le numărăm separat. Proiect
        independent, nu Termoenergetica. Ultima actualizare: {fmtDateRo(meta.data_through)}.
      </p>
      <p className="mt-2 max-w-2xl text-sm">
        Pentru o adresă anume,{' '}
        <Link href="/" className="underline">
          caută strada
        </Link>
        . Cum citești un punct mare:{' '}
        <Link href="/ghid/harta-apa-calda-bucuresti" className="underline">
          ghidul hărții
        </Link>
        .
      </p>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Culoarea și mărimea punctelor = zile fără apă caldă în {lcy}. Hartă: OpenFreeMap · ©
        OpenMapTiles · © contribuitorii OpenStreetMap.
      </p>
      <noscript>
        <p className="mt-4">
          Harta are nevoie de JavaScript. Vezi în schimb{' '}
          <Link href="/clasament" className="underline">
            clasamentele
          </Link>
          .
        </p>
      </noscript>
      <div className="mt-6">
        <HartaClient
          years={mapYears}
          defaultYear={lcy}
          geojsonUrls={geojsonUrls}
          maxDays={maxDays}
        />
      </div>
    </main>
  );
}
