import { describe, expect, it } from 'vitest';
import { getSectorLive } from '@/lib/sector-live';

// Fixture bundle: data_through 2025-06-10.
// Sector 3 = pt-modul-alfa (ongoing programat since 2024-10-26, avarie
// 2024-07-18T08:00 → 2024-07-22T20:00 = 108h).
// Sector 4 = pt-modul-beta (avarie 2024-01-10T05:30 → 2024-01-17T22:00 =
// 184.5h; avarie 2025-03-11T04:00 → 2025-03-15T21:00 = 113h; nothing ongoing).

describe('lib/sector-live', () => {
  it('collects ongoing episodes with PT identity and street context', () => {
    const live = getSectorLive(3, 2024);
    expect(live.ptsTotal).toBe(1);
    expect(live.ongoing).toHaveLength(1);
    const o = live.ongoing[0];
    expect(o.slug).toBe('pt-modul-alfa');
    expect(o.name).toBe('Modul Alfa');
    expect(o.cause_class).toBe('programat');
    expect(o.start).toBe('2024-10-26T06:00');
    expect(o.remediere_last).toBeNull();
    expect(o.streets).toEqual(['Str Alfa']);
  });

  it('an ongoing episode counts the PT as hit in the last 30 days', () => {
    const live = getSectorLive(3, 2024);
    expect(live.ptsHit30d).toBe(1);
  });

  it('episodes ended before the 30-day window do not count as hit', () => {
    const live = getSectorLive(4, 2024);
    expect(live.ongoing).toHaveLength(0);
    expect(live.ptsHit30d).toBe(0);
    expect(live.ptsTotal).toBe(1);
  });

  it('computes the median completed-avarie duration for the requested year', () => {
    expect(getSectorLive(3, 2024).medianAvarieHours).toBeCloseTo(108, 5);
    expect(getSectorLive(4, 2024).medianAvarieHours).toBeCloseTo(184.5, 5);
    expect(getSectorLive(4, 2025).medianAvarieHours).toBeCloseTo(113, 5);
  });

  it('returns null median when the year has no completed avarie episodes', () => {
    expect(getSectorLive(3, 2025).medianAvarieHours).toBeNull();
  });

  it('empty sector yields zeros, not throws', () => {
    const live = getSectorLive(1, 2024);
    expect(live.ptsTotal).toBe(0);
    expect(live.ongoing).toEqual([]);
    expect(live.ptsHit30d).toBe(0);
    expect(live.medianAvarieHours).toBeNull();
  });
});
