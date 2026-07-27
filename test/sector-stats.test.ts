import { describe, expect, it } from 'vitest';
import type { Meta, PtEntity } from '@/lib/data';
import { getMeta, getYearSummary } from '@/lib/data';
import {
  cityAggregate,
  durationWindowYears,
  getSectorStats,
  median,
  monthWindowYears,
  ongoingFor,
  parseNaive,
  percentile,
} from '@/lib/sector-stats';
import { buildSectorFaq, windowLabel } from '@/lib/sector-faq';

// Fixture universe (test/fixtures/data):
//   meta: years [2024, 2025], last_complete_year 2024, partial [2025],
//         data_through 2025-06-10
//   Sector 3 = pt-modul-alfa, Sector 4 = pt-modul-beta. No other sector exists.

describe('lib/sector-stats — numeric helpers', () => {
  it('parseNaive reads a naive local stamp as wall clock, timezone-independent', () => {
    const a = parseNaive('2024-07-18T08:00');
    const b = parseNaive('2024-07-22T20:00');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // 4 days 12 hours = 108 h, regardless of the build machine's timezone.
    expect((b! - a!) / 3_600_000).toBe(108);
  });

  it('parseNaive accepts date-only stamps and rejects junk', () => {
    expect(parseNaive('2024-07-18')).toBe(Date.UTC(2024, 6, 18));
    expect(parseNaive('not a date')).toBeNull();
    expect(parseNaive(null)).toBeNull();
    expect(parseNaive(undefined)).toBeNull();
  });

  it('median averages the two middle values on even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('percentile uses nearest rank', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 0.9)).toBe(9);
    expect(percentile(v, 0.5)).toBe(5);
    expect(percentile(v, 1)).toBe(10);
    expect(percentile([], 0.9)).toBe(0);
  });
});

describe('lib/sector-stats — windows', () => {
  it('duration window takes the last years in the bundle', () => {
    expect(durationWindowYears()).toEqual([2024, 2025]);
  });

  it('month window excludes partial years', () => {
    expect(monthWindowYears()).toEqual([2024]);
  });
});

describe('lib/sector-stats — city aggregate', () => {
  it('reproduces the published city mean from the sector rows', () => {
    const city = cityAggregate(2024);
    const summary = getYearSummary(2024);
    expect(city.pts).toBe(2);
    // Same definition as city/summary.json: PT-weighted over the universe.
    expect(city.meanDays).toBeCloseTo(summary.mean_pt_days, 5);
    expect(city.medianDays).toBe(summary.median_pt_days);
    expect(city.episodes).toBe(summary.episodes);
    // A single day can be both an avarie day and a planned-work day, so the two
    // breakdowns sum to at least the overall mean, never less (ARTIFACTS.md).
    expect(city.meanDaysAvarie + city.meanDaysProgramat).toBeGreaterThanOrEqual(
      city.meanDays - 1e-9,
    );
  });
});

describe('lib/sector-stats — ongoingFor', () => {
  const pt: PtEntity = {
    slug: 'pt-x',
    name: 'PT X',
    sector: 3,
    lat: null,
    lon: null,
    on_map: false,
    blocks_estimate: null,
    streets: [],
    nearest: [],
    years: {
      '2026': {
        days: 3,
        days_avarie: 3,
        days_programat: 0,
        days_deficienta: 0,
        episodes_count: 3,
        longest_days: 3,
        est_hours: 60,
        runs: [],
        episodes: [
          {
            start: '2026-07-01T09:00',
            end: '2026-07-02T09:00',
            ongoing: false,
            uncertain: false,
            cause_class: 'avarie',
            cause_raw: 'închis',
            remediere_last: '2026-07-02T09:00',
          },
          {
            start: '2026-07-05T10:00',
            end: null,
            ongoing: true,
            uncertain: false,
            cause_class: 'avarie',
            cause_raw: 'Remediere avarie circuit primar',
            remediere_last: '2026-07-08T23:00',
          },
          {
            start: '2026-07-09T11:00',
            end: null,
            ongoing: true,
            uncertain: false,
            cause_class: 'programat',
            cause_raw: 'Revizie',
            remediere_last: null,
          },
        ],
      },
    },
  };

  it('returns only open episodes, newest first', () => {
    const out = ongoingFor(pt, 2026);
    expect(out.map((o) => o.start)).toEqual(['2026-07-09T11:00', '2026-07-05T10:00']);
    expect(out[0].announcedEnd).toBeNull();
    expect(out[1].announcedEnd).toBe('2026-07-08T23:00');
    expect(out[0].ptName).toBe('PT X');
  });

  it('never reports a year the bundle does not carry', () => {
    expect(ongoingFor(pt, 2025)).toEqual([]);
  });
});

describe('lib/sector-stats — getSectorStats', () => {
  it('computes sector 3 durations from the fixture episodes', () => {
    const s = getSectorStats(3);
    // One resolved avarie: 2024-07-18T08:00 → 2024-07-22T20:00 = 108 h,
    // announced 2024-07-22T20:00 → met exactly on the hour.
    expect(s.avarie.n).toBe(1);
    expect(s.avarie.medianHours).toBe(108);
    expect(s.avarie.p90Hours).toBe(108);
    expect(s.avarie.shareUnder24hPct).toBe(0);
    expect(s.avarie.withDeadline).toBe(1);
    expect(s.avarie.metDeadlinePct).toBe(100);

    // One resolved planned work: 2024-04-23T07:00 → 2024-05-07T23:00 = 352 h,
    // announced 2024-05-06T23:00 → overran by a day.
    expect(s.programat.n).toBe(1);
    expect(s.programat.medianHours).toBe(352);
    expect(s.programat.metDeadlinePct).toBe(0);
  });

  it('excludes still-open episodes from the duration stats', () => {
    // pt-modul-alfa's third 2024 episode is ongoing with no end; it must not
    // reach the medians (and it is not "now" either — 2024 is not data_through).
    const s = getSectorStats(3);
    expect(s.programat.n).toBe(1);
    expect(s.ongoing).toEqual([]);
  });

  it('counts PT-days per month from the runs, deficienta excluded', () => {
    const s = getSectorStats(3);
    // runs: [114,14,programat] = 23 Apr–6 May 2024 (8 in April, 6 in May),
    //       [200,5,avarie] = 18–22 Jul, [300,2,programat] = 26–27 Oct.
    expect(s.peakMonth).toEqual({ month: 4, ptDays: 8 });
    expect(s.peakMonthProgramat).toEqual({ month: 4, ptDays: 8 });
    expect(s.programatSummerSharePct).toBe(0);
  });

  it('ranks sectors by median days, worst first', () => {
    expect(getSectorStats(3).rankByMedianDays).toBe(1); // median 20
    expect(getSectorStats(4).rankByMedianDays).toBe(2); // median 8
  });

  it('averages several episodes across the whole duration window', () => {
    const s = getSectorStats(4);
    // 2024: 184.5 h, 2025: 113 h — both years are inside the window.
    expect(s.avarie.n).toBe(2);
    expect(s.avarie.medianHours).toBeCloseTo((184.5 + 113) / 2, 5);
    expect(s.avarie.p90Hours).toBe(184.5);
    expect(s.programat.n).toBe(0);
    expect(s.programat.metDeadlinePct).toBeNull();
  });

  it('surfaces streets that touch the sector, including cross-sector ones', () => {
    expect(getSectorStats(3).topStreets.map((t) => t.slug)).toEqual(['str-alfa', 'str-beta']);
    expect(getSectorStats(4).topStreets.map((t) => t.slug)).toEqual(['str-beta']);
  });

  it('lists only the sector own thermal points', () => {
    expect(getSectorStats(3).topPts.map((p) => p.slug)).toEqual(['pt-modul-alfa']);
  });

  it('throws on a sector the bundle has no row for', () => {
    expect(() => getSectorStats(1)).toThrow(/sector 1/);
  });
});

describe('lib/sector-faq', () => {
  const meta: Meta = getMeta();

  it('windowLabel stamps a partial trailing year', () => {
    expect(windowLabel([2024], meta)).toBe('2024');
    expect(windowLabel([2024, 2025], meta)).toBe('2024–2025 (până la 10 iunie 2025)');
    expect(windowLabel([], meta)).toBe('');
  });

  it('answers the striking-distance questions with computed numbers only', () => {
    const faq = buildSectorFaq(getSectorStats(3), meta);
    const first = faq[0];
    expect(first.q).toBe('Când se dă drumul la apa caldă în Sectorul 3?');
    expect(first.a).toContain('10 iunie 2025'); // the data stamp
    expect(first.a).toContain('nu era nicio întrerupere de apă caldă în desfășurare');
    expect(first.a).toContain('108 ore (≈ 4,5 zile)'); // measured median, not a guess

    const questions = faq.map((f) => f.q);
    expect(questions).toContain('Cât durează o avarie de apă caldă în Sectorul 3?');
    expect(questions).toContain('Cât de des se întrerupe apa caldă în Sectorul 3?');
    expect(questions).toContain('Care străzi din Sectorul 3 au fost cele mai afectate?');
    expect(questions).toContain('În ce lună se oprește cel mai des apa caldă în Sectorul 3?');

    // Every answer must be non-trivial prose — an empty branch would ship an
    // empty FAQPage answer, which is worse than no FAQ at all.
    for (const item of faq) {
      expect(item.a.length).toBeGreaterThan(40);
      expect(item.a).not.toContain('undefined');
      expect(item.a).not.toContain('NaN');
    }
  });

  it('drops the planned-works clause when the sector has no planned works', () => {
    const faq = buildSectorFaq(getSectorStats(4), meta);
    const seasonal = faq.find((f) => f.q.startsWith('În ce lună'));
    expect(seasonal).toBeDefined();
    expect(seasonal!.a).toContain('ianuarie');
    expect(seasonal!.a).not.toContain('Vârful lucrărilor programate');
    expect(faq.some((f) => f.q.startsWith('Cât durează o oprire programată'))).toBe(false);
  });
});
