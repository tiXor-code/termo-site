import Link from 'next/link';

import { fmtDateRo, fmtDateTimeRo } from '@/lib/format';
import { restoreQualifier, type OngoingEpisode } from '@/lib/pt-live';

/**
 * "Is my hot water off right now, and when does it come back?" — answered for
 * one thermal point, from the same fields the sector pages already render.
 *
 * The empty state is deliberate. Someone whose water is off and who finds no
 * announcement here needs to be told that plainly, and pointed at the supplier,
 * rather than left to read a silent page as a denial.
 */
export default function OngoingBand({
  ongoing,
  dataThrough,
  sector,
}: {
  ongoing: OngoingEpisode[];
  dataThrough: string;
  /** Sector of the serving PT, for the "see the whole sector" link. */
  sector: number | null;
}) {
  const asOf = fmtDateRo(dataThrough);

  if (ongoing.length === 0) {
    return (
      <p className="mt-4 border border-hairline bg-paper-2 px-4 py-3 text-sm text-ink-soft">
        Nicio întrerupere anunțată în curs la ultima actualizare ({asOf}). Dacă totuși nu ai
        apă caldă acum, anunțul poate fi mai nou decât datele de aici — verifică pe{' '}
        <a
          href="https://cmteb.ro/functionare_sistem_termoficare.php"
          className="underline underline-offset-2"
          rel="noopener nofollow"
        >
          cmteb.ro
        </a>
        .
      </p>
    );
  }

  return (
    <section
      className={`mt-4 border border-hairline border-l-[6px] bg-paper-2 px-4 py-3 ${
        ongoing[0].cause_class === 'avarie' ? 'border-l-v-red' : 'border-l-programat'
      }`}
      aria-label="Întreruperi în curs"
    >
      <h3 className="font-display text-base font-bold">
        {ongoing.length === 1 ? 'Întrerupere în curs' : `${ongoing.length} întreruperi în curs`}
      </h3>
      <ul className="mt-2 space-y-3">
        {ongoing.map((e, i) => {
          // `start` alone is not unique: one PT can carry two announcements
          // that begin at the same timestamp.
          const key = `${e.start}|${e.cause_class}|${i}`;
          const qualifier =
            e.remediere_last !== null ? restoreQualifier(e.remediere_last, dataThrough) : null;
          return (
            <li key={key} className="text-sm">
              <span
                className={
                  // --color-avarie is 4.42:1 on paper-2, just under AA; v-red is 5.70:1.
                  e.cause_class === 'avarie'
                    ? 'text-v-red'
                    : e.cause_class === 'programat'
                      ? 'text-programat'
                      : 'text-ink-soft'
                }
              >
                {e.cause_class === 'avarie'
                  ? 'Avarie'
                  : e.cause_class === 'programat'
                    ? 'Oprire programată'
                    : 'Cauză neprecizată'}
              </span>
              <span className="text-ink-soft"> · din </span>
              <span className="tnum">{fmtDateTimeRo(e.start)}</span>
              <div className="mt-1">
                <span className="text-ink-soft">Restabilire estimată: </span>
                {e.remediere_last !== null ? (
                  <>
                    <strong className="tnum text-base font-bold">
                      {fmtDateTimeRo(e.remediere_last)}
                    </strong>
                    {qualifier !== null ? (
                      // An absolute datetime reads the same tonight or a month out.
                      <span
                        className={
                          qualifier === 'termen depășit' ? 'text-v-red' : 'text-ink-soft'
                        }
                      >
                        {' '}
                        ({qualifier})
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-ink-soft">neanunțată</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        Termen estimat de Termoenergetica, nu o garanție — se poate schimba. Datele sunt de la{' '}
        {asOf}
        {sector !== null ? (
          <>
            {' '}
            · <Link href={`/sector/${sector}`} className="underline underline-offset-2">
              toate întreruperile din Sectorul {sector}
            </Link>
          </>
        ) : null}
        .
      </p>
    </section>
  );
}
