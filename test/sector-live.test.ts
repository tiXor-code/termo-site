import { describe, expect, it } from 'vitest';
import {
  getSectorLive,
  groupOngoing,
  RECENT_ENDED_DAYS,
  recentEndedRow,
  type OngoingRow,
} from '@/lib/sector-live';
import type { Episode } from '@/lib/data';

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
    expect(live.recentEnded).toEqual([]);
  });

  it('fixture episodes all ended long before the recent window', () => {
    // Newest fixture end is 2025-03-15; data_through is 2025-06-10.
    expect(getSectorLive(3, 2024).recentEnded).toEqual([]);
    expect(getSectorLive(4, 2024).recentEnded).toEqual([]);
  });

  it('groups mirror the flat list on the fixture (one announcement, one PT)', () => {
    const live = getSectorLive(3, 2024);
    expect(live.groups).toHaveLength(1);
    expect(live.groups[0]).toEqual({
      cause_class: 'programat',
      start: '2024-10-26T06:00',
      remediere_last: null,
      pts: [{ slug: 'pt-modul-alfa', name: 'Modul Alfa', streets: ['Str Alfa'] }],
    });
    expect(getSectorLive(4, 2024).groups).toEqual([]);
  });
});

describe('lib/sector-live recentEndedRow', () => {
  const pt = { slug: 'pt-x', name: 'X', streets: [{ name: 'Str Unu' }, { name: 'Str Doi' }, { name: 'Str Trei' }] };
  const ep = (over: Partial<Episode>): Episode => ({
    start: '2026-08-28T06:00',
    end: '2026-08-29T18:00',
    ongoing: false,
    uncertain: false,
    cause_class: 'avarie',
    cause_raw: 'Avarie conducta',
    remediere_last: '2026-08-29T18:00',
    ...over,
  });
  // data_through 2026-08-30T00:00 as ms.
  const dataThroughMs = Date.UTC(2026, 7, 30);

  it('builds a row with PT identity, first two streets and the duration in hours', () => {
    const row = recentEndedRow(pt, ep({}), dataThroughMs);
    expect(row).toEqual({
      slug: 'pt-x',
      name: 'X',
      streets: ['Str Unu', 'Str Doi'],
      cause_class: 'avarie',
      start: '2026-08-28T06:00',
      end: '2026-08-29T18:00',
      durationHours: 36,
    });
  });

  it('an end exactly RECENT_ENDED_DAYS before data_through is still recent', () => {
    const end = '2026-08-23T00:00'; // dataThroughMs − 7 days exactly
    const row = recentEndedRow(pt, ep({ start: '2026-08-22T00:00', end }), dataThroughMs);
    expect(RECENT_ENDED_DAYS).toBe(7);
    expect(row?.end).toBe(end);
  });

  it('rejects an end older than the window', () => {
    expect(
      recentEndedRow(pt, ep({ start: '2026-08-20T00:00', end: '2026-08-22T23:59' }), dataThroughMs),
    ).toBeNull();
  });

  it('rejects ongoing episodes and episodes with no end', () => {
    expect(recentEndedRow(pt, ep({ ongoing: true }), dataThroughMs)).toBeNull();
    expect(recentEndedRow(pt, ep({ end: null }), dataThroughMs)).toBeNull();
  });

  it('rejects unparsable timestamps', () => {
    expect(recentEndedRow(pt, ep({ end: 'curand' }), dataThroughMs)).toBeNull();
    expect(recentEndedRow(pt, ep({ start: '?' }), dataThroughMs)).toBeNull();
  });

  it('clamps an inconsistent end-before-start duration to 0', () => {
    const row = recentEndedRow(pt, ep({ start: '2026-08-29T20:00' }), dataThroughMs);
    expect(row?.durationHours).toBe(0);
  });
});

describe('lib/sector-live groupOngoing', () => {
  const row = (over: Partial<OngoingRow>): OngoingRow => ({
    slug: 'pt-x',
    name: 'X',
    streets: [],
    cause_class: 'programat',
    start: '2026-08-16T22:30',
    remediere_last: '2026-08-17T12:00',
    ...over,
  });

  it('collapses rows announced together into one group, in first-seen order', () => {
    // Input already avarie-first / newest-first, as getSectorLive emits it.
    const rows = [
      row({ slug: 'pt-a', name: '3 Placare-T', cause_class: 'avarie', start: '2026-08-16T11:24', remediere_last: '2026-08-17T15:30', streets: ['Str Unu'] }),
      row({ slug: 'pt-b', name: '10 Catelu' }),
      row({ slug: 'pt-c', name: '2 Catelu' }),
      row({ slug: 'pt-d', name: 'U1', start: '2026-08-14T21:03', remediere_last: '2026-08-22T23:00' }),
      row({ slug: 'pt-e', name: '1 Catelu' }),
    ];
    const groups = groupOngoing(rows);
    expect(groups.map((g) => [g.cause_class, g.start, g.remediere_last, g.pts.length])).toEqual([
      ['avarie', '2026-08-16T11:24', '2026-08-17T15:30', 1],
      ['programat', '2026-08-16T22:30', '2026-08-17T12:00', 3],
      ['programat', '2026-08-14T21:03', '2026-08-22T23:00', 1],
    ]);
    // Every input row lands in exactly one group.
    expect(groups.reduce((n, g) => n + g.pts.length, 0)).toBe(rows.length);
    expect(groups[0].pts[0].streets).toEqual(['Str Unu']);
  });

  it('sorts thermal points inside a group by name, numeric-aware', () => {
    const groups = groupOngoing([
      row({ slug: 'pt-b', name: '10 Catelu' }),
      row({ slug: 'pt-c', name: '2 Catelu' }),
      row({ slug: 'pt-e', name: '1 Catelu' }),
    ]);
    expect(groups[0].pts.map((p) => p.name)).toEqual(['1 Catelu', '2 Catelu', '10 Catelu']);
  });

  it('a missing restore estimate is its own key, not merged with a dated one', () => {
    const groups = groupOngoing([
      row({ slug: 'pt-a', name: 'A', remediere_last: null }),
      row({ slug: 'pt-b', name: 'B' }),
      row({ slug: 'pt-c', name: 'C', remediere_last: null }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].remediere_last).toBeNull();
    expect(groups[0].pts.map((p) => p.slug)).toEqual(['pt-a', 'pt-c']);
  });

  it('empty input yields no groups', () => {
    expect(groupOngoing([])).toEqual([]);
  });
});
