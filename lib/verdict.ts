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

/**
 * Deficiency days per year at or above which an otherwise-green entity stops
 * being called "Curat". 30 is deliberately the SAME boundary the locked scale
 * uses to turn outage days orange: a zone that spent a full month on low
 * pressure or low temperature has not had a clean year, whatever the outage
 * counter says.
 *
 * Publicly documented at /metodologie#deficiente - change both together.
 * Measured on 2025: fires on 11 of 905 PTs, all in Sector 6.
 */
export const DEFICIENTA_GUARD_DAYS = 30;

export interface Verdict {
  key: Grade;
  label: string;
  /** The grade the headline number ALONE produces, before the guard. */
  baseKey: Grade;
  /** True only when the guard moved an otherwise-green verdict up to amber. */
  demoted: boolean;
  /** Deficiency days behind the guard; 0 when absent or not a real count. */
  daysDeficienta: number;
}

/**
 * Verdict for an entity, aware of the pressure/temperature-degraded days the
 * headline metric excludes by design.
 *
 * The guard is one-directional and one-step: it can only move GREEN to AMBER,
 * never amber->orange, never orange->red, never downward. `days` - the headline
 * number - is never modified, and `gradeFor` is not touched, so the locked
 * 0/10/30/90 scale still governs every entity that has real outage days.
 */
export function verdictFor(days: number, daysDeficienta = 0): Verdict {
  const base = gradeFor(days);
  const def =
    Number.isFinite(daysDeficienta) && daysDeficienta > 0 ? Math.floor(daysDeficienta) : 0;
  const demoted = base.key === 'green' && def >= DEFICIENTA_GUARD_DAYS;
  const key: Grade = demoted ? 'amber' : base.key;
  return { key, label: LABELS[key], baseKey: base.key, demoted, daysDeficienta: def };
}
