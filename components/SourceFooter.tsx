import Link from 'next/link';
import { getMeta } from '@/lib/data';
import { fmtDateRo, fmtDateTimeRo } from '@/lib/format';

export default function SourceFooter() {
  const meta = getMeta();
  return (
    <footer className="mt-16 border-t border-hairline">
      <div className="mx-auto max-w-5xl space-y-1 px-4 py-8 text-sm text-ink-soft">
        <p>
          Date: anunțuri publice Termoenergetica (cmteb.ro), arhivate și reconstruite
          independent. Ultima actualizare: {fmtDateRo(meta.data_through)}. Surse și
          atribuire: vezi{' '}
          <Link href="/metodologie" className="underline">
            metodologia
          </Link>
          .
        </p>
        <p className="text-xs">Set de date generat la {fmtDateTimeRo(meta.generated_at)}.</p>
      </div>
    </footer>
  );
}
