import type { Metadata } from 'next';
import Link from 'next/link';
import { getMeta } from '@/lib/data';
import { fmtDateRo } from '@/lib/format';

export const dynamic = 'error';

export const metadata: Metadata = {
  title: 'Despre',
  description:
    'Cine face Fără Apă Caldă și de ce: un proiect independent de date despre întreruperile de apă caldă din București.',
  alternates: { canonical: '/despre' },
};

export default function DesprePage() {
  const meta = getMeta();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Despre</h1>
      <div className="mt-4 max-w-2xl space-y-4 leading-relaxed">
        <p>
          Fără Apă Caldă este un proiect independent care măsoară un lucru simplu și exasperant:
          câte zile pe an stau bucureștenii fără apă caldă. Site-ul reconstruiește istoricul
          întreruperilor din anunțurile publice Termoenergetica, arhivate automat din decembrie
          2021 până la {fmtDateRo(meta.data_through)}, și îl face căutabil pe stradă, punct termic
          și sector.
        </p>
        <p>
          Nu este un site oficial și nu are nicio afiliere cu Termoenergetica sau Primăria
          Municipiului București. Cifrele se pot reproduce integral:{' '}
          <Link href="/metodologie" className="underline">
            metodologia
          </Link>{' '}
          descrie fiecare pas, iar datele și codul de colectare sunt publice pe{' '}
          <a href="https://github.com/tiXor-code/termo-data" className="underline">
            GitHub
          </a>
          .
        </p>
        <p>
          Construit de{' '}
          <a href="https://teodorlutoiu.com" className="underline">
            Teodor-Cristian Luțoiu
          </a>
          . Corecturi, întrebări sau date suplimentare:{' '}
          <a href="mailto:contact@teodorlutoiu.com" className="underline">
            contact@teodorlutoiu.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
