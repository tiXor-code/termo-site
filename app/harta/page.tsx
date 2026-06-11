import type { Metadata } from 'next';
import Link from 'next/link';
import { clientAsset, getMeta, getPtRanking, lastCompleteYear } from '@/lib/data';
import HartaClient from './harta-client';

export const dynamic = 'error';

export const metadata: Metadata = {
  title: 'Harta punctelor termice',
  description:
    'Harta punctelor termice din București: culoarea și mărimea punctelor arată zilele fără apă caldă pe an.',
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
      <h1 className="font-display text-3xl font-bold">Harta punctelor termice</h1>
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
