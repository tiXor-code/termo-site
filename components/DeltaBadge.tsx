import { fmtInt } from '@/lib/format';

/**
 * Year-over-year delta. Positive = more outage days = worse (avarie red, ▲);
 * negative = calm (▼, U+2212 minus); null (no comparable prior year) = "—".
 */
export default function DeltaBadge({
  delta,
  suffix = '',
}: {
  delta: number | null;
  suffix?: string;
}) {
  if (delta === null) {
    return <span className="tnum text-ink-soft">—</span>;
  }
  if (delta > 0) {
    return (
      <span className="tnum text-avarie">
        +{fmtInt(delta)}
        {suffix} ▲
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="tnum text-ink-soft">
        −{fmtInt(Math.abs(delta))}
        {suffix} ▼
      </span>
    );
  }
  return (
    <span className="tnum text-ink-soft">
      0{suffix}
    </span>
  );
}
