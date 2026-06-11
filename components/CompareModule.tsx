// "How does this entity compare with the city" dot strip (Group C, server).
import type { Distribution } from '@/lib/data';
import { fmtInt, fmtRatio, fmtZile } from '@/lib/format';

const W = 400;
const H = 44;
const PAD_X = 6;
const AXIS_Y = 22;

export default function CompareModule({
  value,
  percentiles,
  median,
  year,
  entityLabel,
}: {
  value: number;
  percentiles: Distribution['percentiles'];
  median: number;
  year: number;
  entityLabel: string;
}) {
  const maxScale = Math.max(percentiles.p99, value, 1);
  const x = (v: number) => PAD_X + (Math.min(v, maxScale) / maxScale) * (W - 2 * PAD_X);
  const ticks: { key: string; v: number }[] = [
    { key: 'p10', v: percentiles.p10 },
    { key: 'p25', v: percentiles.p25 },
    { key: 'p50', v: percentiles.p50 },
    { key: 'p75', v: percentiles.p75 },
    { key: 'p90', v: percentiles.p90 },
  ];
  const ratio = fmtRatio(value, median);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full max-w-md"
        role="img"
        aria-label={`${entityLabel}: ${fmtZile(value)} în ${year}, față de distribuția punctelor termice din oraș (mediana ${fmtInt(median)})`}
      >
        <line
          x1={PAD_X}
          y1={AXIS_Y}
          x2={W - PAD_X}
          y2={AXIS_Y}
          stroke="var(--color-hairline)"
          strokeWidth={2}
        />
        {ticks.map((t) => (
          <g key={t.key}>
            <line
              x1={x(t.v)}
              y1={AXIS_Y - 5}
              x2={x(t.v)}
              y2={AXIS_Y + 5}
              stroke="var(--color-ink-soft)"
              strokeWidth={1}
            />
            <text
              x={x(t.v)}
              y={AXIS_Y + 17}
              textAnchor="middle"
              fontSize={8}
              fill="var(--color-ink-soft)"
            >
              {t.key}
            </text>
          </g>
        ))}
        <circle cx={x(value)} cy={AXIS_Y} r={5} fill="var(--color-avarie)">
          <title>{`${entityLabel}: ${fmtZile(value)}`}</title>
        </circle>
        <text
          x={x(value)}
          y={AXIS_Y - 10}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {fmtInt(value)}
        </text>
      </svg>
      <figcaption className="mt-1 text-xs text-ink-soft">
        {ratio !== null
          ? `${ratio} mediana orașului (${fmtZile(median)}) în ${year}`
          : `Distribuția punctelor termice din oraș în ${year}`}
      </figcaption>
    </figure>
  );
}
