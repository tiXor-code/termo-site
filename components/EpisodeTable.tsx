// Zero-JS episode tables (Group C) — one <details> per year.
import type { Episode } from '@/lib/data';
import { fmtDateTimeRo, fmtInt } from '@/lib/format';

const CAUSE_LABEL: Record<string, string> = {
  avarie: 'avarie',
  programat: 'programat',
  unclassified: 'neclasificat',
};

const CAUSE_CLASS: Record<string, string> = {
  avarie: 'text-avarie',
  programat: 'text-programat',
  unclassified: 'text-ink-soft',
};

export default function EpisodeTable({
  episodesByYear,
  defaultOpenYear,
}: {
  episodesByYear: { year: number; episodes: Episode[] }[];
  defaultOpenYear: number;
}) {
  return (
    <div className="space-y-2">
      {episodesByYear.map(({ year, episodes }) => {
        const hasUncertain = episodes.some((e) => e.uncertain);
        return (
          <details key={year} open={year === defaultOpenYear}>
            <summary className="cursor-pointer text-sm">
              Episoade {year} <span className="tnum text-ink-soft">({fmtInt(episodes.length)})</span>
            </summary>
            {episodes.length === 0 ? (
              <p className="py-2 text-sm text-ink-soft">Niciun episod înregistrat.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="mt-2 w-full border-collapse text-sm tnum">
                  <thead>
                    <tr className="hairline-b text-left text-xs font-normal text-ink-soft">
                      <th scope="col" className="py-1.5 pr-3 font-normal">Început</th>
                      <th scope="col" className="py-1.5 pr-3 font-normal">Sfârșit</th>
                      <th scope="col" className="py-1.5 pr-3 font-normal">Cauză</th>
                      <th scope="col" className="py-1.5 pr-3 font-normal">Cauza raportată</th>
                      <th scope="col" className="py-1.5 font-normal">Restabilire estimată</th>
                    </tr>
                  </thead>
                  <tbody>
                    {episodes.map((e, i) => (
                      <tr key={i} className="hairline-b align-baseline">
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {e.uncertain ? '≈ ' : ''}
                          {fmtDateTimeRo(e.start)}
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {e.ongoing ? (
                            <span className="border border-avarie px-1 text-xs text-avarie">
                              în curs
                            </span>
                          ) : e.end !== null ? (
                            <>
                              {e.uncertain ? '≈ ' : ''}
                              {fmtDateTimeRo(e.end)}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={`py-1.5 pr-3 ${CAUSE_CLASS[e.cause_class]}`}>
                          {CAUSE_LABEL[e.cause_class]}
                        </td>
                        <td className="py-1.5 pr-3 font-sans">{e.cause_raw || '—'}</td>
                        <td className="py-1.5 whitespace-nowrap">
                          {e.remediere_last !== null ? fmtDateTimeRo(e.remediere_last) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hasUncertain && (
              <p className="mt-2 text-xs text-ink-soft">
                ≈ interval estimat — sursa a avut o pauză de colectare în timpul episodului.
              </p>
            )}
          </details>
        );
      })}
    </div>
  );
}
