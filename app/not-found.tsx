import SearchBox from '@/components/SearchBox';
import { clientAsset, lastCompleteYear } from '@/lib/data';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-display text-3xl font-bold">Pagina nu există.</h1>
      <p className="mt-3 text-ink-soft">Caută strada sau punctul termic:</p>
      <div className="mt-6">
        <SearchBox
          variant="hero"
          indexUrl={clientAsset('search-index.json')}
          year={lastCompleteYear()}
        />
      </div>
    </main>
  );
}
