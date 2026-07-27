// Sector vs city comparison. Both columns come from rankings/sectoare-{year}.json
// so the definitions match column-for-column: every average is over the sector's
// (or the city's) UNIVERSE of thermal points, zeros included. The city column is
// the PT-weighted aggregate of the six sector rows — see lib/sector-stats.
import { fmtDec, fmtInt, fmtPct } from '@/lib/format';
import type { SectorStats } from '@/lib/sector-stats';

type Row =
  | { kind: 'ratio'; label: string; sector: number; city: number; decimals?: number }
  | { kind: 'share'; label: string; sector: number; city: number };

export default function SectorVsCityTable({ stats }: { stats: SectorStats }) {
  const { row, city } = stats;
  const rows: Row[] = [
    {
      kind: 'ratio',
      label: 'Mediana zilelor fără apă caldă pe punct termic',
      sector: row.median_days,
      city: city.medianDays,
      decimals: 0,
    },
    {
      kind: 'ratio',
      label: 'Media zilelor fără apă caldă pe punct termic',
      sector: row.mean_days,
      city: city.meanDays,
    },
    {
      kind: 'ratio',
      label: 'din care din avarii (medie pe punct termic)',
      sector: row.mean_days_avarie,
      city: city.meanDaysAvarie,
    },
    {
      kind: 'ratio',
      label: 'din care din lucrări programate (medie pe punct termic)',
      sector: row.mean_days_programat,
      city: city.meanDaysProgramat,
    },
    {
      kind: 'share',
      label: 'Episoade de oprire înregistrate',
      sector: row.episodes,
      city: city.episodes,
    },
    { kind: 'share', label: 'Puncte termice', sector: row.pts, city: city.pts },
  ];

  const fmt = (r: Row, v: number) =>
    r.kind === 'share' || r.decimals === 0 ? fmtInt(v) : fmtDec(v);

  return (
    <div className="overflow-x-auto">
      <table className="mt-3 w-full border-collapse text-sm tnum">
        <caption className="sr-only">
          Sectorul {stats.sector} comparat cu media Bucureștiului în {stats.year}
        </caption>
        <thead>
          <tr className="hairline-b text-left text-xs text-ink-soft">
            <th scope="col" className="py-2 pr-3 font-normal">
              Indicator ({stats.year})
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">
              Sector {stats.sector}
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">
              București
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Sector / oraș
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="hairline-b align-baseline">
              <th scope="row" className="py-2 pr-3 text-left font-normal font-sans">
                {r.label}
              </th>
              <td className="py-2 pr-3 text-right">{fmt(r, r.sector)}</td>
              <td className="py-2 pr-3 text-right text-ink-soft">{fmt(r, r.city)}</td>
              <td className="py-2 text-right">
                {r.city === 0
                  ? '—'
                  : r.kind === 'share'
                    ? fmtPct((r.sector / r.city) * 100)
                    : `${fmtDec(r.sector / r.city, 2)}×`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
