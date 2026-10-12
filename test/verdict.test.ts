import { describe, expect, it } from 'vitest';
import {
  DEFICIENTA_GUARD_DAYS,
  gradeFor,
  LABELS,
  verdictFor,
  type Grade,
} from '@/lib/verdict';

describe('lib/verdict gradeFor (locked scale 0–9 / 10–29 / 30–89 / 90+)', () => {
  it('maps the boundary cases exactly', () => {
    expect(gradeFor(0).key).toBe('green');
    expect(gradeFor(9).key).toBe('green');
    expect(gradeFor(10).key).toBe('amber');
    expect(gradeFor(29).key).toBe('amber');
    expect(gradeFor(30).key).toBe('orange');
    expect(gradeFor(89).key).toBe('orange');
    expect(gradeFor(90).key).toBe('red');
  });

  it('returns the Romanian label paired with the key', () => {
    expect(gradeFor(0)).toEqual({ key: 'green', label: 'Curat' });
    expect(gradeFor(15)).toEqual({ key: 'amber', label: 'Moderat' });
    expect(gradeFor(50)).toEqual({ key: 'orange', label: 'Problematic' });
    expect(gradeFor(200)).toEqual({ key: 'red', label: 'Foarte problematic' });
  });

  it('exposes LABELS for all four grades', () => {
    const grades: Grade[] = ['green', 'amber', 'orange', 'red'];
    expect(grades.every((g) => typeof LABELS[g] === 'string' && LABELS[g].length > 0)).toBe(true);
    expect(LABELS).toEqual({
      green: 'Curat',
      amber: 'Moderat',
      orange: 'Problematic',
      red: 'Foarte problematic',
    });
  });

  it('clamps invalid (negative / non-finite) input to green', () => {
    expect(gradeFor(-5).key).toBe('green');
    expect(gradeFor(Number.NaN).key).toBe('green');
    // Non-finite inputs are not real day counts → safe default of green,
    // never a false "foarte problematic" alarm.
    expect(gradeFor(Number.POSITIVE_INFINITY).key).toBe('green');
  });

  it('grades large but finite day counts as red', () => {
    expect(gradeFor(365).key).toBe('red');
  });
});

describe('lib/verdict verdictFor (deficienta guard)', () => {
  it('matches gradeFor exactly when there is no deficienta', () => {
    expect(verdictFor(9)).toEqual({
      key: 'green', label: 'Curat', baseKey: 'green', demoted: false, daysDeficienta: 0,
    });
    expect(verdictFor(50, 0).key).toBe('orange');
  });

  it('demotes green to amber at the threshold - the real pt-4-8 case', () => {
    const v = verdictFor(9, 51); // pt-4-8, 2025: 9 outage days, 51 deficienta days
    expect(v.key).toBe('amber');
    expect(v.label).toBe('Moderat');
    expect(v.baseKey).toBe('green');
    expect(v.demoted).toBe(true);
    expect(v.daysDeficienta).toBe(51);
  });

  it('the threshold is inclusive, and one day below it does nothing', () => {
    expect(verdictFor(0, DEFICIENTA_GUARD_DAYS).key).toBe('amber');
    expect(verdictFor(0, DEFICIENTA_GUARD_DAYS - 1).key).toBe('green');
    expect(verdictFor(0, DEFICIENTA_GUARD_DAYS - 1).demoted).toBe(false);
  });

  it('never demotes more than one step, and never touches a non-green grade', () => {
    expect(verdictFor(15, 300).key).toBe('amber'); // amber stays amber
    expect(verdictFor(50, 300).key).toBe('orange'); // orange stays orange
    expect(verdictFor(200, 300).key).toBe('red'); // red stays red
    expect(verdictFor(15, 300).demoted).toBe(false);
  });

  it('reports deficienta even when it does not demote, so the copy is always available', () => {
    const v = verdictFor(50, 4);
    expect(v.daysDeficienta).toBe(4);
    expect(v.demoted).toBe(false);
  });

  it('clamps junk deficienta input instead of demoting on it', () => {
    expect(verdictFor(0, Number.NaN).daysDeficienta).toBe(0);
    expect(verdictFor(0, Number.POSITIVE_INFINITY).key).toBe('green');
    expect(verdictFor(0, -12).daysDeficienta).toBe(0);
  });
});
