// Single source of truth for the verdict grade scale (locked).
// 0–9 = Curat (green) · 10–29 = Moderat (amber) · 30–89 = Problematic (orange) · 90+ = Foarte problematic (red).
// Pure module — no I/O, no server-only — so it is unit-testable and client-safe.

export type Grade = 'green' | 'amber' | 'orange' | 'red';

/** Uppercase-able Romanian labels keyed by grade. CSS uppercases the pill; copy here is title-case. */
export const LABELS: Record<Grade, string> = {
  green: 'Curat',
  amber: 'Moderat',
  orange: 'Problematic',
  red: 'Foarte problematic',
};

/**
 * Map a count of days-without-hot-water to its verdict grade.
 * Boundaries (locked): 0–9 green · 10–29 amber · 30–89 orange · 90+ red.
 * Negative inputs (shouldn't occur) clamp to green; non-finite inputs default to green.
 */
export function gradeFor(days: number): { key: Grade; label: string } {
  const key: Grade =
    !Number.isFinite(days) || days < 10
      ? 'green'
      : days < 30
        ? 'amber'
        : days < 90
          ? 'orange'
          : 'red';
  return { key, label: LABELS[key] };
}
