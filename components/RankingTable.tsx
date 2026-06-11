'use client';

// Sortable ranking table (Group B). Server pages pass pre-mapped view rows;
// the streets table SSRs the top 100 and fetches the rest on demand from the
// hashed /data/rankings/strazi-{y}.json republication.

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StreetRankingRow } from '@/lib/data';
import { fmtDec, fmtInt } from '@/lib/format';
import { streetRowToView, type RankingRowView } from '@/lib/rankings';
import DeltaBadge from '@/components/DeltaBadge';

export interface RankingTableProps {
  rows: RankingRowView[];
  unit: 'pt' | 'strada' | 'sector';
  year: number;
  maxDays: number;
  totalCount: number;
  restUrl?: string;
  enableCauzaFilter?: boolean;
}

type SortKey = 'days' | 'days_avarie' | 'days_programat' | 'episodes' | 'longest_days';

const NUM_COLS: { key: SortKey; label: (year: number) => string; sectorLabel?: string }[] = [
  { key: 'days', label: () => 'Zile fără apă caldă', sectorLabel: 'Zile fără apă caldă (mediană)' },
  { key: 'days_avarie', label: () => 'din care avarii', sectorLabel: 'avarii (medie)' },
  { key: 'days_programat', label: () => 'din care programate', sectorLabel: 'programate (medie)' },
  { key: 'episodes', label: () => 'Episoade' },
  { key: 'longest_days', label: () => 'Cel mai lung episod' },
];

function fmtCell(v: number): string {
  return Number.isInteger(v) ? fmtInt(v) : fmtDec(v);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function DataBar({ row, maxDays }: { row: RankingRowView; maxDays: number }) {
  const totalPct = maxDays > 0 ? Math.min(100, (row.days / maxDays) * 100) : 0;
  const split = row.days_avarie + row.days_programat;
  if (split === 0) {
    // All days unclassified — paint the strip's unclassified shade, not avarie.
    return (
      <span aria-hidden="true" className="mt-1 flex h-1 w-full max-w-32">
        <span style={{ width: `${totalPct}%`, background: 'var(--color-ink-soft)' }} />
      </span>
    );
  }
  const avariePct = (row.days_avarie / split) * totalPct;
  return (
    <span aria-hidden="true" className="mt-1 flex h-1 w-full max-w-32">
      <span style={{ width: `${avariePct}%`, background: 'var(--color-avarie)' }} />
      <span
        style={{ width: `${Math.max(0, totalPct - avariePct)}%`, background: 'var(--color-programat)' }}
      />
    </span>
  );
}

function RankingTableInner({
  rows: initialRows,
  unit,
  year,
  maxDays,
  totalCount,
  restUrl,
  initialSort,
}: Omit<RankingTableProps, 'enableCauzaFilter'> & { initialSort: SortKey }) {
  const [rows, setRows] = useState(initialRows);
  const [sortKey, setSortKey] = useState<SortKey>(initialSort);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [loadingRest, setLoadingRest] = useState(false);
  const [restError, setRestError] = useState(false);

  const showSector = unit !== 'sector';
  const showLongest = unit !== 'sector';
  const showDelta = unit !== 'sector';
  const cols = NUM_COLS.filter(
    (c) => c.key !== 'longest_days' || showLongest,
  );

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) =>
      sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey],
    );
    return copy;
  }, [rows, sortKey, sortDir]);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  async function showAll() {
    if (!restUrl || loadingRest) return;
    setLoadingRest(true);
    setRestError(false);
    try {
      const res = await fetch(restUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const full = (await res.json()) as StreetRankingRow[];
      setRows(full.map((r, i) => streetRowToView(r, i + 1)));
    } catch {
      setRestError(true);
    } finally {
      setLoadingRest(false);
    }
  }

  const entityHead = unit === 'pt' ? 'Punct termic' : unit === 'strada' ? 'Stradă' : 'Sector';

  return (
    <div>
      <table className="w-full border-collapse text-sm tnum">
        <thead>
          <tr className="hairline-b text-left text-xs text-ink-soft">
            <th scope="col" className="py-2 pr-3 font-normal">
              Loc
            </th>
            <th scope="col" className="py-2 pr-3 font-normal">
              {entityHead}
            </th>
            {showSector && (
              <th scope="col" className="py-2 pr-3 font-normal">
                Sector
              </th>
            )}
            {cols.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="py-2 pr-3 text-right font-normal"
                aria-sort={
                  sortKey === c.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className="cursor-pointer hover:underline"
                >
                  {(unit === 'sector' && c.sectorLabel) || c.label(year)}
                  {sortKey === c.key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                </button>
              </th>
            ))}
            {showDelta && (
              <th scope="col" className="py-2 text-right font-normal">
                față de {year - 1}
              </th>
            )}
          </tr>
        </thead>
        {chunk(sorted, 50).map((group, gi) => (
          <tbody
            key={gi}
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 2400px' }}
          >
            {group.map((row) => (
              <tr key={row.slug ?? row.name} className="hairline-b align-baseline">
                {/* Canonical rank (by days desc) — stable under client-side re-sorts. */}
                <td className="py-2 pr-3 text-ink-soft">{fmtInt(row.rank)}</td>
                <td className="py-2 pr-3 font-sans">
                  <a href={row.href} className="hover:underline">
                    {row.name}
                  </a>
                  <DataBar row={row} maxDays={maxDays} />
                </td>
                {showSector && <td className="py-2 pr-3">{row.sectorLabel}</td>}
                {cols.map((c) => (
                  <td key={c.key} className="py-2 pr-3 text-right">
                    {fmtCell(row[c.key])}
                  </td>
                ))}
                {showDelta && (
                  <td className="py-2 text-right">
                    <DeltaBadge delta={row.delta_prev} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      {restUrl && rows.length < totalCount && (
        <p className="mt-4">
          <button
            type="button"
            onClick={showAll}
            disabled={loadingRest}
            className="cursor-pointer underline disabled:opacity-50"
          >
            {loadingRest ? 'Se încarcă…' : `Arată toate cele ${fmtInt(totalCount)} străzi`}
          </button>
          {restError && (
            <span className="ml-3 text-sm text-avarie">Nu s-a putut încărca lista completă.</span>
          )}
        </p>
      )}
    </div>
  );
}

function RankingTableWithFilter(props: Omit<RankingTableProps, 'enableCauzaFilter'>) {
  const params = useSearchParams();
  const cauza = params.get('cauza');
  const initialSort: SortKey =
    cauza === 'avarii' ? 'days_avarie' : cauza === 'programate' ? 'days_programat' : 'days';
  return <RankingTableInner {...props} initialSort={initialSort} />;
}

export default function RankingTable({ enableCauzaFilter, ...props }: RankingTableProps) {
  if (enableCauzaFilter) {
    return (
      <Suspense fallback={<RankingTableInner {...props} initialSort="days" />}>
        <RankingTableWithFilter {...props} />
      </Suspense>
    );
  }
  return <RankingTableInner {...props} initialSort="days" />;
}
