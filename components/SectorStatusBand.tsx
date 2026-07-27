// Answer-first status band for a sector hub page: the last known state of the
// sector, then the historical answer to "when does the hot water come back".
// Everything is computed at build time from the nightly bundle (lib/sector-stats).
import Link from 'next/link';
import { fmtCu, fmtDateRo, fmtDateTimeRo, fmtDurata, fmtInt, fmtPct, needsDe } from '@/lib/format';
import type { SectorStats } from '@/lib/sector-stats';

const CAUSE_LABEL: Record<string, string> = {
  avarie: 'avarie',
  programat: 'lucrare programată',
  unclassified: 'cauză neclasificată',
  deficienta: 'deficiență',
};

const CAUSE_CLASS: Record<string, string> = {
  avarie: 'text-avarie',
  programat: 'text-programat',
};

const MAX_LISTED = 5;

export default function SectorStatusBand({ stats }: { stats: SectorStats }) {
  const { sector, ongoing, avarie } = stats;
  const listed = ongoing.slice(0, MAX_LISTED);
  const avarieCount = ongoing.filter((o) => o.causeClass === 'avarie').length;
  const programatCount = ongoing.filter((o) => o.causeClass === 'programat').length;

  return (
    <div className="mt-6 border border-hairline bg-paper-2 p-5">
      <p className="text-xs tracking-wide text-ink-soft uppercase">
        Ultima stare cunoscută · date până la {fmtDateRo(stats.dataThrough)}
      </p>

      {ongoing.length === 0 ? (
        <p className="mt-2 text-lg leading-snug">
          <b>Nicio întrerupere de apă caldă în desfășurare</b> în Sectorul {sector} la ultima
          actualizare a datelor.
        </p>
      ) : (
        <>
          <p className="mt-2 text-lg leading-snug">
            <b className="tnum">{fmtInt(ongoing.length)}</b>{' '}
            {ongoing.length === 1 ? 'punct termic' : needsDe(ongoing.length) ? 'de puncte termice' : 'puncte termice'}{' '}
            din Sectorul {sector} {ongoing.length === 1 ? 'avea' : 'aveau'} apa caldă oprită
            {avarieCount > 0 || programatCount > 0 ? (
              <>
                {' '}
                ({avarieCount > 0 && (
                  <span className="text-avarie">
                    {avarieCount === 1 ? '1 avarie' : fmtCu(avarieCount, 'avarii')}
                  </span>
                )}
                {avarieCount > 0 && programatCount > 0 ? ', ' : ''}
                {programatCount > 0 && (
                  <span className="text-programat">
                    {programatCount === 1
                      ? '1 lucrare programată'
                      : fmtCu(programatCount, 'lucrări programate')}
                  </span>
                )}
                )
              </>
            ) : null}
            .
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {listed.map((o) => (
              <li key={o.ptSlug} className="leading-snug">
                <Link href={`/punct-termic/${o.ptSlug}`} className="underline">
                  {o.ptName}
                </Link>{' '}
                <span className={CAUSE_CLASS[o.causeClass] ?? 'text-ink-soft'}>
                  {CAUSE_LABEL[o.causeClass] ?? o.causeClass}
                </span>{' '}
                <span className="tnum text-ink-soft">
                  din {fmtDateTimeRo(o.start)}
                  {o.announcedEnd
                    ? ` · reluare anunțată până la ${fmtDateTimeRo(o.announcedEnd)}`
                    : ' · fără oră anunțată pentru reluare'}
                </span>
              </li>
            ))}
          </ul>
          {ongoing.length > listed.length && (
            <p className="mt-2 text-sm text-ink-soft">
              și încă {fmtCu(ongoing.length - listed.length, 'puncte termice')} din Sectorul{' '}
              {sector}.
            </p>
          )}
        </>
      )}

      {avarie.n > 0 && (
        <p className="mt-4 border-t border-hairline pt-3 text-sm leading-relaxed">
          <b>Cât se așteaptă, de obicei:</b> avariile din Sectorul {sector} încheiate în{' '}
          {stats.durationWindow[0]}–{stats.durationWindow[stats.durationWindow.length - 1]} s-au
          terminat în mediană după {fmtDurata(avarie.medianHours)},{' '}
          {fmtPct(avarie.shareUnder24hPct)} dintre ele în mai puțin de 24 de ore.{' '}
          {avarie.metDeadlinePct !== null && (
            <>
              În {fmtPct(avarie.metDeadlinePct)} din cazuri întreruperea a dispărut din lista
              oficială până la ora anunțată.{' '}
            </>
          )}
          <Link href="/metodologie#durate-si-termene" className="underline">
            Cum măsurăm.
          </Link>
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink-soft">
        Site-ul se reconstruiește o dată pe noapte din anunțurile publice Termoenergetica. O avarie
        rezolvată sau apărută după {fmtDateRo(stats.dataThrough)} nu se vede încă aici — pentru
        starea la minut, verifică pagina oficială de funcționare.
      </p>
    </div>
  );
}
