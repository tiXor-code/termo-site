import type { Metadata } from 'next';
import Link from '@/components/Link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getGuides } from '@/lib/ghid';
import { fmtDateRo } from '@/lib/format';

export const dynamic = 'error';

export function generateMetadata(): Metadata {
  return {
    title: 'Ghiduri despre apa caldă din București',
    description:
      'Ghiduri practice despre întreruperile de apă caldă din București: ce verifici, ce faci și unde reclami, pe baza datelor publice CMTEB.',
    alternates: { canonical: '/ghid' },
    // An empty section is thin content: keep it out of the index until the first guide exists.
    ...(getGuides().length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default function GhidIndexPage() {
  const guides = getGuides();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs items={[{ name: 'Acasă', href: '/' }, { name: 'Ghiduri', href: '/ghid' }]} />
      <h1 className="mt-4 font-display text-3xl font-bold">Ghiduri</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Răspunsuri practice despre apa caldă din București, scrise pe baza datelor publice pe care le
        adunăm zilnic din anunțurile Termoenergetica (CMTEB).
      </p>
      {guides.length === 0 ? (
        <p className="mt-8 text-ink-soft">Primele ghiduri apar în curând.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {guides.map((g) => (
            <li key={g.slug} className="border-t border-hairline pt-4">
              <Link href={`/ghid/${g.slug}`} className="font-display text-xl font-bold hover:underline">
                {g.title}
              </Link>
              <p className="mt-1 max-w-2xl text-ink-soft">{g.description}</p>
              <p className="mt-1 text-sm text-ink-soft">Actualizat la {fmtDateRo(g.updated)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
