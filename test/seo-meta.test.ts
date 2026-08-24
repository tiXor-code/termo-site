import { describe, expect, it } from 'vitest';
import type { PtEntity, PtYear, StreetEntity } from '@/lib/data';
import { ptDescription, ptTitle, streetDescription, streetTitle } from '@/lib/seo-meta';

const TEMPLATE_SUFFIX = ' | Fără Apă Caldă'; // mirrors app/layout.tsx

/** Rendered <title> length in codepoints, template applied like Next does. */
function renderedLen(title: string | { absolute: string }): number {
  const text = typeof title === 'string' ? title + TEMPLATE_SUFFIX : title.absolute;
  return [...text].length;
}

function pt(name: string, year?: Partial<PtYear>): PtEntity {
  return {
    slug: 'x',
    name,
    sector: 3,
    lat: null,
    lon: null,
    on_map: false,
    blocks_estimate: null,
    streets: [],
    nearest: [],
    years: year
      ? {
          '2025': {
            days: 0,
            days_avarie: 0,
            days_programat: 0,
            days_deficienta: 0,
            episodes_count: 0,
            longest_days: 0,
            est_hours: 0,
            runs: [],
            episodes: [],
            ...year,
          },
        }
      : {},
  };
}

function street(name: string, sectors: number[], year?: { days: number; days_avarie: number }): StreetEntity {
  return {
    slug: 'x',
    name,
    type: 'str',
    sectors,
    pts: [],
    blocks: [],
    neighbors: [],
    years: year ? { '2025': { days: year.days, days_avarie: year.days_avarie, days_programat: 0, runs: [] } } : {},
  } as unknown as StreetEntity;
}

// Real names from the bundle at every rung of the fallback ladder.
const PT_NAMES = [
  'PT B+N', // short: full templated form
  'PT 1 Colentina Socului', // drops "punct termic," first
  'Complex Studentesc LEU - Cămine + Fac.Electrotehnică', // drops the brand suffix
  'Univ. Stiinte Agronom. si Med. Veterinara Buc.- Facultatea de Biotehnologii (CIOS)', // 82 chars: name itself truncated
];
const STREET_NAMES = [
  'Alunului',
  'Lt. Bazar Romulus Niculescu',
  'Pedestrian Access To Como Park Virtutii 56E Entrance',
];

describe('lib/seo-meta title bounds', () => {
  it.each(PT_NAMES)('PT title stays within 30-60 rendered chars: %s', (name) => {
    const n = renderedLen(ptTitle(pt(name)));
    expect(n).toBeGreaterThanOrEqual(30);
    expect(n).toBeLessThanOrEqual(60);
  });

  it('short PT names keep the full templated form', () => {
    expect(ptTitle(pt('PT B+N'))).toBe('PT B+N — punct termic, Sector 3');
  });

  it('overlong PT names truncate at a word boundary and keep the sector', () => {
    const t = ptTitle(pt(PT_NAMES[3]));
    expect(t).toHaveProperty('absolute');
    const abs = (t as { absolute: string }).absolute;
    expect(abs).toMatch(/… — Sector 3$/u);
    expect([...abs].length).toBeLessThanOrEqual(60);
  });

  it.each(STREET_NAMES)('street title stays within 30-60 rendered chars: %s', (name) => {
    const n = renderedLen(streetTitle(street(name, [2, 3])));
    expect(n).toBeGreaterThanOrEqual(30);
    expect(n).toBeLessThanOrEqual(60);
  });

  it('short street names keep sectors and the brand suffix', () => {
    expect(streetTitle(street('Alunului', [2, 3]))).toBe('Apă caldă pe Alunului, Sectoarele 2 și 3');
  });
});

describe('lib/seo-meta description bounds', () => {
  const YEARS: Partial<PtYear>[] = [
    { days: 0 },
    { days: 123, days_avarie: 99, days_programat: 24 },
  ];

  it.each(PT_NAMES)('PT description stays within 70-160 chars: %s', (name) => {
    for (const y of YEARS) {
      const d = ptDescription(pt(name, y), 2025);
      expect([...d].length).toBeGreaterThanOrEqual(70);
      expect([...d].length).toBeLessThanOrEqual(160);
    }
  });

  it.each(STREET_NAMES)('street description stays within 70-160 chars: %s', (name) => {
    for (const y of [undefined, { days: 123, days_avarie: 99 }]) {
      const d = streetDescription(street(name, [2, 3], y), 2025, 2021, 2026);
      expect([...d].length).toBeGreaterThanOrEqual(70);
      expect([...d].length).toBeLessThanOrEqual(160);
    }
  });

  it('long PT names drop the stats tail, keeping the day count', () => {
    const d = ptDescription(pt(PT_NAMES[3], { days: 45, days_avarie: 40, days_programat: 5 }), 2025);
    expect(d).toContain('a avut 45 zile');
    expect(d).not.toContain('din avarii');
  });
});
