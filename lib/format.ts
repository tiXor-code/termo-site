// Pure, client-safe formatting helpers (Romanian locale).
import type { Meta } from '@/lib/data';

const intFmt = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });

export function fmtInt(n: number): string {
  return intFmt.format(n);
}

export function fmtDec(n: number, digits = 1): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Romanian plural for "zile": 1 → "1 zi", 2–19 → "N zile", >=20 → "N de zile". */
export function fmtZile(n: number): string {
  if (n === 1) return '1 zi';
  if (n >= 20) return `${fmtInt(n)} de zile`;
  return `${fmtInt(n)} zile`;
}

const MONTHS_LONG = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

const MONTHS_SHORT = [
  'ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.',
  'iul.', 'aug.', 'sep.', 'oct.', 'noi.', 'dec.',
];

/** "2025-10-16" / "2025-10-16T23:00" → "16 octombrie 2025". */
export function fmtDateRo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${Number(d)} ${MONTHS_LONG[Number(mo) - 1]} ${y}`;
}

/** "2025-10-16T23:00" → "16 oct. 2025, 23:00". Falls back to date-only when no time part. */
export function fmtDateTimeRo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d, hh, mm] = m;
  const date = `${Number(d)} ${MONTHS_SHORT[Number(mo) - 1]} ${y}`;
  if (hh === undefined) return date;
  return `${date}, ${hh}:${mm}`;
}

/** "de 2,1 ori"; null when median is 0 (ratio undefined). */
export function fmtRatio(value: number, median: number): string | null {
  if (median === 0) return null;
  return `de ${fmtDec(value / median, 1)} ori`;
}

/** "2025" for complete years; "2026 (până la 10 iunie 2026)" for the partial current year. */
export function yearLabel(y: number, meta: Meta): string {
  if (!meta.partial_years.includes(y)) return String(y);
  const dataThroughYear = Number(meta.data_through.slice(0, 4));
  if (y === dataThroughYear) {
    return `${y} (până la ${fmtDateRo(meta.data_through)})`;
  }
  // Partial year at the start of the dataset (e.g. 2021 — data begins in December).
  return `${y} (parțial)`;
}
