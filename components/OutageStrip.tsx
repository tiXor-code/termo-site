import type { Run } from '@/lib/data';
import { daysInYear, runsToSegments } from '@/lib/strip';

const MONTH_LABELS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

const CAUSE_FILL: Record<string, string> = {
  avarie: 'var(--color-avarie)',
  programat: 'var(--color-programat)',
  unclassified: 'var(--color-ink-soft)',
};

/**
 * Deficiency days render as a 4-unit band at the BOTTOM of the 14-unit strip,
 * never a full-height block, so the full-height footprint still equals the
 * headline `days`. A band rather than a 45-degree hatch because the SVG uses
 * preserveAspectRatio="none" at ~3x horizontal scale: a hatch would render at
 * ~17 degrees on desktop and shift with viewport width, while a band is
 * aspect-ratio-immune and needs no <defs>/pattern id.
 */
const DEF_Y = 10;
const DEF_H = 4;

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
  showDeficienta = false,
}: {
  year: number;
  runs: Run[];
  ariaLabel: string;
  dataThroughDoy?: number;
  showMonthLabels?: boolean;
  /** Opt in to painting the 4th cause class as a bottom band. */
  showDeficienta?: boolean;
}) {
  const total = daysInYear(year);
  const segments = runsToSegments(runs, year, { includeDeficienta: showDeficienta });
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
        {segments.map((seg) =>
          seg.cause === 'deficienta' ? (
            <rect
              key={`${seg.x}-deficienta`}
              x={seg.x}
              y={DEF_Y}
              width={seg.width}
              height={DEF_H}
              fill="var(--color-deficienta)"
            />
          ) : (
            <rect
              key={`${seg.x}-${seg.cause}`}
              x={seg.x}
              y={0}
              width={seg.width}
              height={14}
              fill={CAUSE_FILL[seg.cause]}
            />
          ),
        )}
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
