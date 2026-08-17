import { describe, expect, it } from 'vitest';
import { lastRunDate, rankingLastmod } from '@/lib/sitemap-lastmod';

describe('lib/sitemap-lastmod', () => {
  it('lastRunDate picks the end day of the latest run across years', () => {
    const years = {
      '2024': { runs: [[18, 1, 'avarie'], [33, 1, 'avarie']] as const },
      '2025': { runs: [[22, 1, 'avarie'], [48, 3, 'deficienta']] as const },
    };
    // 2025 DOY 48 + 3 days - 1 = DOY 50 = 2025-02-19
    expect(lastRunDate(years as never, '2026-08-10')).toBe('2025-02-19');
  });

  it('lastRunDate handles a run that starts on day 1 and multi-day lengths', () => {
    const years = { '2023': { runs: [[1, 10, 'programat']] as const } };
    expect(lastRunDate(years as never, '2026-08-10')).toBe('2023-01-10');
  });

  it('lastRunDate is capped at data_through for an ongoing run', () => {
    const years = { '2026': { runs: [[220, 30, 'avarie']] as const } };
    // DOY 249 of 2026 = 2026-09-06 which is past data_through
    expect(lastRunDate(years as never, '2026-08-10')).toBe('2026-08-10');
  });

  it('lastRunDate is null when the entity has no runs', () => {
    expect(lastRunDate({ '2024': { runs: [] } }, '2026-08-10')).toBeNull();
    expect(lastRunDate({}, '2026-08-10')).toBeNull();
  });

  it('rankingLastmod freezes finished years and tracks the running one', () => {
    expect(rankingLastmod(2024, '2026-08-10')).toBe('2024-12-31');
    expect(rankingLastmod(2025, '2026-08-10')).toBe('2025-12-31');
    expect(rankingLastmod(2026, '2026-08-10')).toBe('2026-08-10');
  });
});
