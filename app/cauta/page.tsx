import type { Metadata } from 'next';
import SearchBox from '@/components/SearchBox';
import { clientAsset, lastCompleteYear } from '@/lib/data';

export const dynamic = 'error';

export const metadata: Metadata = {
  title: 'Caută',
  robots: { index: false },
  alternates: { canonical: '/cauta' },
};

export default function CautaPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Caută</h1>
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">
        Caută strada sau punctul termic — funcționează și fără diacritice.
      </p>
      <div className="mt-6">
        <SearchBox
          variant="hero"
          indexUrl={clientAsset('search-index.json')}
          autoFocus
          readsQueryParam
          year={lastCompleteYear()}
        />
      </div>
    </main>
  );
}
