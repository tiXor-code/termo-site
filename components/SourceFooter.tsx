import Link from '@/components/Link';
import { getMeta } from '@/lib/data';
import { fmtDateRo, fmtDateTimeRo } from '@/lib/format';

export default function SourceFooter() {
  const meta = getMeta();
  return (
    <footer className="mt-16 border-t border-hairline">
      <div className="mx-auto max-w-5xl space-y-1 px-4 pt-8 pb-24 sm:pb-8 text-sm text-ink-soft">
        <p>
          Date: anunțuri publice Termoenergetica (cmteb.ro), arhivate și reconstruite
          independent. Ultima actualizare: {fmtDateRo(meta.data_through)}. Surse și
          atribuire: vezi{' '}
          <Link href="/metodologie" className="underline">
            metodologia
          </Link>
          .
        </p>
        <p>
          Datele se actualizează o dată pe noapte. O avarie rezolvată recent poate apărea încă
          activă („în curs") până la următoarea actualizare.
        </p>
        <p className="text-xs">Set de date generat la {fmtDateTimeRo(meta.generated_at)}.</p>
        <p className="inline-flex items-center gap-2 pt-2 text-xs">
          Realizat de
          <a
            href="https://ministerucreativ.ro/"
            target="_blank"
            rel="noopener nofollow"
            className="group inline-flex rounded"
          >
            <img
              src="/brand/ministeru-creativ.svg"
              width={134}
              height={16}
              alt="Ministeru' Creativ"
              loading="lazy"
              decoding="async"
              className="block h-4 w-auto opacity-80 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </a>
        </p>
      </div>
    </footer>
  );
}
