import { fmtInt } from '@/lib/format';

const MONTH_LABELS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

const SLOT = 40;
const BAR = 28;
const CHART_H = 100;
const LABEL_H = 16;

/** 12 hand-rolled SVG bars for a year's monthly_pt_days. */
export default function MonthBars({
  values,
  year,
  ariaLabel,
}: {
  values: number[];
  year: number;
  ariaLabel: string;
}) {
  const max = Math.max(...values, 1);
  const width = SLOT * 12;
  const height = CHART_H + LABEL_H;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full max-w-2xl"
      role="img"
      aria-label={ariaLabel}
    >
      {values.slice(0, 12).map((v, m) => {
        const h = Math.round((v / max) * (CHART_H - 14));
        const x = m * SLOT + (SLOT - BAR) / 2;
        return (
          <g key={MONTH_LABELS[m]}>
            <title>{`${MONTH_LABELS[m]} ${year}: ${fmtInt(v)}`}</title>
            <rect
              x={x}
              y={CHART_H - h}
              width={BAR}
              height={h}
              fill="var(--color-heat-4)"
            />
            <text
              x={m * SLOT + SLOT / 2}
              y={CHART_H - h - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-ink-soft)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtInt(v)}
            </text>
            <text
              x={m * SLOT + SLOT / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-ink-soft)"
            >
              {MONTH_LABELS[m]}
            </text>
          </g>
        );
      })}
      <line
        x1={0}
        y1={CHART_H + 0.5}
        x2={width}
        y2={CHART_H + 0.5}
        stroke="var(--color-hairline)"
        strokeWidth={1}
      />
    </svg>
  );
}
