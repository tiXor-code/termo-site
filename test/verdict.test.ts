import { describe, expect, it } from 'vitest';
import { gradeFor, LABELS, type Grade } from '@/lib/verdict';

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
