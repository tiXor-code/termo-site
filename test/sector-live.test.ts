import { describe, expect, it } from 'vitest';
import {
  getSectorLive,
  groupOngoing,
  groupRecentCompleted,
  type OngoingRow,
  type RecentRow,
} from '@/lib/sector-live';

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

describe('lib/sector-live groupRecentCompleted', () => {
  // 2025-05-11T00:00 naive-as-UTC, thirty days before the fixture data_through.
  const cutoff = Date.UTC(2025, 4, 11);
  const row = (over: Partial<RecentRow>): RecentRow => ({
    slug: 'pt-x',
    name: 'X',
    streets: [],
    cause_class: 'avarie',
    start: '2025-05-20T08:00',
    end: '2025-05-22T20:00',
    uncertain: false,
    ...over,
  });

  it('keeps episodes ended at or after the cutoff, drops older or unparsable ends', () => {
    const groups = groupRecentCompleted(
      [
        row({ slug: 'pt-old', end: '2025-05-10T23:59', start: '2025-05-08T08:00' }),
        row({ slug: 'pt-edge', start: '2025-05-09T08:00', end: '2025-05-11T00:00' }),
        row({ slug: 'pt-new' }),
        row({ slug: 'pt-bogus', end: 'nedeterminat' }),
      ],
      cutoff,
    );
    expect(groups.flatMap((g) => g.pts.map((p) => p.slug))).toEqual(['pt-new', 'pt-edge']);
  });

  it('orders groups newest end first', () => {
    const groups = groupRecentCompleted(
      [
        row({ slug: 'pt-a', start: '2025-05-12T06:00', end: '2025-05-13T06:00' }),
        row({ slug: 'pt-b', start: '2025-06-01T06:00', end: '2025-06-02T18:00' }),
        row({ slug: 'pt-c', start: '2025-05-20T06:00', end: '2025-05-21T06:00' }),
      ],
      cutoff,
    );
    expect(groups.map((g) => g.end)).toEqual([
      '2025-06-02T18:00',
      '2025-05-21T06:00',
      '2025-05-13T06:00',
    ]);
  });

  it('collapses one announcement into one group and sorts PTs numeric-aware', () => {
    const groups = groupRecentCompleted(
      [
        row({ slug: 'pt-b', name: '10 Catelu' }),
        row({ slug: 'pt-c', name: '2 Catelu' }),
        row({ slug: 'pt-d', name: '1 Catelu', cause_class: 'programat' }),
        row({ slug: 'pt-e', name: '1 Catelu' }),
      ],
      cutoff,
    );
    // Same (cause, start, end) merges; a different cause stays its own group.
    expect(groups).toHaveLength(2);
    const avarie = groups.find((g) => g.cause_class === 'avarie');
    expect(avarie?.pts.map((p) => p.name)).toEqual(['1 Catelu', '2 Catelu', '10 Catelu']);
    expect(groups.find((g) => g.cause_class === 'programat')?.pts).toHaveLength(1);
  });

  it('computes the duration in hours and nulls it when a timestamp is unparsable', () => {
    const groups = groupRecentCompleted(
      [
        row({}), // 2025-05-20T08:00 -> 2025-05-22T20:00 = 60h
        row({ slug: 'pt-bad', start: 'nedeterminat', end: '2025-06-01T06:00' }),
      ],
      cutoff,
    );
    expect(groups.find((g) => g.start === '2025-05-20T08:00')?.durationHours).toBeCloseTo(60, 5);
    expect(groups.find((g) => g.start === 'nedeterminat')?.durationHours).toBeNull();
  });

  it('marks the group uncertain when any member episode is', () => {
    const groups = groupRecentCompleted(
      [row({ slug: 'pt-a' }), row({ slug: 'pt-b', uncertain: true })],
      cutoff,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].uncertain).toBe(true);
  });

  it('empty input yields no groups', () => {
    expect(groupRecentCompleted([], cutoff)).toEqual([]);
  });
});

describe('lib/sector-live recent (fixture)', () => {
  it('episodes ended before the 30-day window never reach recent, ongoing ones neither', () => {
    // Sector 3 has an ongoing episode and an avarie ended 2024-07-22; sector 4
    // has avarii ended 2024-01-17 and 2025-03-15 — all outside the window
    // ending at data_through 2025-06-10.
    expect(getSectorLive(3, 2024).recent).toEqual([]);
    expect(getSectorLive(4, 2025).recent).toEqual([]);
  });
});
