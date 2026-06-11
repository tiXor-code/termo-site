import { useId } from 'react';
import { fmtDec, fmtInt } from '@/lib/format';

const SLOT = 56;
const BAR = 36;
const CHART_H = 130;
const VALUE_H = 16;
const LABEL_H = 18;

function fmtValue(v: number): string {
  return Number.isInteger(v) ? fmtInt(v) : fmtDec(v);
}

/**
 * Hand-rolled SVG bar trend (one bar per year). Partial years render as
 * hatched outlines with a "*" suffix and a shared footnote.
 */
export default function TrendBars({
  series,
  unitLabel,
}: {
  series: { label: string; value: number; partial?: boolean; href?: string }[];
  unitLabel: string;
}) {
  const hatchId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const max = Math.max(...series.map((s) => s.value), 1);
  const width = SLOT * series.length;
  const height = VALUE_H + CHART_H + LABEL_H;
  const hasPartial = series.some((s) => s.partial);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full max-w-xl"
        role="img"
        aria-label={`${unitLabel} — ${series
          .map((s) => `${s.label}${s.partial ? '*' : ''}: ${fmtValue(s.value)}`)
          .join(', ')}`}
      >
        <defs>
          <pattern
            id={hatchId}
            width={5}
            height={5}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={5} stroke="var(--color-heat-4)" strokeWidth={2} />
          </pattern>
        </defs>
        {series.map((s, i) => {
          const h = Math.max(1, Math.round((s.value / max) * CHART_H));
          const x = i * SLOT + (SLOT - BAR) / 2;
          const y = VALUE_H + CHART_H - h;
          const bar = (
            <g>
              <title>{`${s.label}${s.partial ? '*' : ''}: ${fmtValue(s.value)} ${unitLabel}`}</title>
              {s.partial ? (
                <>
                  <rect x={x} y={y} width={BAR} height={h} fill={`url(#${hatchId})`} />
                  <rect
                    x={x + 0.5}
                    y={y + 0.5}
                    width={BAR - 1}
                    height={h - 1}
                    fill="none"
                    stroke="var(--color-heat-4)"
                    strokeWidth={1}
                  />
                </>
              ) : (
                <rect x={x} y={y} width={BAR} height={h} fill="var(--color-heat-4)" />
              )}
              <text
                x={i * SLOT + SLOT / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-ink)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtValue(s.value)}
              </text>
              <text
                x={i * SLOT + SLOT / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-ink-soft)"
              >
                {s.label}
                {s.partial ? '*' : ''}
              </text>
            </g>
          );
          return s.href ? (
            <a key={s.label} href={s.href}>
              {bar}
            </a>
          ) : (
            <g key={s.label}>{bar}</g>
          );
        })}
        <line
          x1={0}
          y1={VALUE_H + CHART_H + 0.5}
          x2={width}
          y2={VALUE_H + CHART_H + 0.5}
          stroke="var(--color-hairline)"
          strokeWidth={1}
        />
      </svg>
      <figcaption className="mt-1 text-xs text-ink-soft">
        {unitLabel}
        {hasPartial ? ' · * an incomplet' : ''}
      </figcaption>
    </figure>
  );
}
