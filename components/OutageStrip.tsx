import type { Run } from '@/lib/data';
import { daysInYear, runsToSegments } from '@/lib/strip';

const MONTH_LABELS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

const CAUSE_FILL: Record<string, string> = {
  avarie: 'var(--color-avarie)',
  programat: 'var(--color-programat)',
  unclassified: 'var(--color-ink-soft)',
};

/** 0-based day-of-year for the 1st of each month. */
function monthStartIndexes(year: number): number[] {
  const jan1 = Date.UTC(year, 0, 1);
  return Array.from({ length: 12 }, (_, m) =>
    Math.round((Date.UTC(year, m, 1) - jan1) / 86_400_000),
  );
}

/**
 * Year-at-a-glance outage strip. One unit of viewBox width = one calendar day.
 * Days after `dataThroughDoy` (1-based, inclusive cutoff) render in the
 * "no data" shade — used for the current partial year.
 */
export default function OutageStrip({
  year,
  runs,
  ariaLabel,
  dataThroughDoy,
  showMonthLabels = false,
}: {
  year: number;
  runs: Run[];
  ariaLabel: string;
  dataThroughDoy?: number;
  showMonthLabels?: boolean;
}) {
  const total = daysInYear(year);
  const segments = runsToSegments(runs, year);
  const noDataStart =
    dataThroughDoy !== undefined ? Math.max(0, Math.min(total, dataThroughDoy)) : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${total} 14`}
        preserveAspectRatio="none"
        className="block h-3.5 w-full"
        role="img"
        aria-label={ariaLabel}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={0} width={total} height={14} fill="var(--color-ok)" />
        {segments.map((seg) => (
          <rect
            key={`${seg.x}-${seg.cause}`}
            x={seg.x}
            y={0}
            width={seg.width}
            height={14}
            fill={CAUSE_FILL[seg.cause]}
          />
        ))}
        {noDataStart !== null && noDataStart < total && (
          <rect
            x={noDataStart}
            y={0}
            width={total - noDataStart}
            height={14}
            fill="var(--color-nodata)"
          />
        )}
      </svg>
      {showMonthLabels && (
        <div aria-hidden="true" className="relative mt-1 h-4 text-[10px] text-ink-soft">
          {monthStartIndexes(year).map((doy, m) => (
            <span
              key={MONTH_LABELS[m]}
              className="absolute"
              style={{ left: `${(doy / total) * 100}%` }}
            >
              {MONTH_LABELS[m]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
