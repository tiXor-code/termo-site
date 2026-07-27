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

/**
 * Does a Romanian numeral need the "de" linker before its noun?
 *
 * The rule keys off the LAST TWO digits, not the magnitude: 1–19 take the bare
 * noun ("115 zile", "o sută cincisprezece zile"), 20–99 and exact hundreds take
 * "de" ("22 de zile", "100 de zile", "1.000 de zile"). Zero is written bare.
 */
export function needsDe(n: number): boolean {
  const abs = Math.abs(Math.round(n));
  if (abs === 0) return false;
  const rest = abs % 100;
  return rest === 0 ? abs >= 100 : rest >= 20;
}

/** "3 zile" / "1 zi" / "22 de zile" / "115 zile" — plural + the "de" linker. */
export function fmtZile(n: number): string {
  if (n === 1) return '1 zi';
  return needsDe(n) ? `${fmtInt(n)} de zile` : `${fmtInt(n)} zile`;
}

/** "4 ore" / "1 oră" / "47 de ore"; sub-hour spans get a words-only fallback. */
export function fmtOre(n: number): string {
  const r = Math.round(n);
  if (r <= 0) return 'mai puțin de o oră';
  if (r === 1) return '1 oră';
  return needsDe(r) ? `${fmtInt(r)} de ore` : `${fmtInt(r)} ore`;
}

/** "4.187 de avarii" / "115 avarii" — a count with the right "de" linker. */
export function fmtCu(n: number, noun: string): string {
  return needsDe(n) ? `${fmtInt(n)} de ${noun}` : `${fmtInt(n)} ${noun}`;
}

/**
 * Hours as a readable span: "6 ore" under two days, "98 de ore (≈ 4,1 zile)"
 * above, so long planned works stay legible.
 */
export function fmtDurata(hours: number): string {
  const label = fmtOre(hours);
  if (hours < 48) return label;
  return `${label} (≈ ${fmtDec(hours / 24)} zile)`;
}

const MONTHS_LONG = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

const MONTHS_SHORT = [
  'ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.',
  'iul.', 'aug.', 'sep.', 'oct.', 'noi.', 'dec.',
];

/** 1-based month → "august". Returns "" for anything out of range. */
export function monthNameRo(month: number): string {
  return MONTHS_LONG[month - 1] ?? '';
}

/** Percentages as whole numbers: 58.7 → "59%". */
export function fmtPct(n: number): string {
  return `${fmtInt(Math.round(n))}%`;
}

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
