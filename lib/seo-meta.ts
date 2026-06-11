// Title/description builders for detail pages (Group C owns this file).
import type { PtEntity, StreetEntity } from '@/lib/data';
import { fmtInt } from '@/lib/format';

/** "Sector 4" / "Sectoarele 2 și 3" / "Sectoarele 2, 3 și 4". */
export function sectorsPhrase(sectors: number[]): string {
  if (sectors.length === 0) return 'București';
  if (sectors.length === 1) return `Sector ${sectors[0]}`;
  const last = sectors[sectors.length - 1];
  return `Sectoarele ${sectors.slice(0, -1).join(', ')} și ${last}`;
}

export function ptTitle(pt: PtEntity, an: number): string {
  const days = pt.years[String(an)]?.days ?? 0;
  return `${pt.name} — punct termic, Sector ${pt.sector} | ${fmtInt(days)} zile fără apă caldă în ${an}`;
}

export function ptDescription(pt: PtEntity, an: number): string {
  const y = pt.years[String(an)];
  if (!y || y.days === 0) {
    return `${pt.name} (Sector ${pt.sector}): fără întreruperi de apă caldă înregistrate în ${an}. Istoric complet pe ani, episoade și comparație cu orașul.`;
  }
  return `${pt.name} (Sector ${pt.sector}) a avut ${fmtInt(y.days)} zile cu întreruperi de apă caldă în ${an}: ${fmtInt(y.days_avarie)} din avarii și ${fmtInt(y.days_programat)} din lucrări programate.`;
}

export function streetTitle(street: StreetEntity, firstYear: number, lastYear: number): string {
  return `Apă caldă pe ${street.name}, ${sectorsPhrase(street.sectors)} | zile cu întreruperi ${firstYear}–${lastYear}`;
}

export function streetDescription(
  street: StreetEntity,
  an: number,
  firstYear: number,
  lastYear: number,
): string {
  const y = street.years[String(an)];
  if (!y || y.days === 0) {
    return `${street.name}: fără întreruperi de apă caldă înregistrate în ${an}. Istoric complet ${firstYear}–${lastYear}, pe punct termic.`;
  }
  return `${street.name} a avut ${fmtInt(y.days)} zile cu întreruperi de apă caldă în ${an}, din care ${fmtInt(y.days_avarie)} din avarii. Istoric complet ${firstYear}–${lastYear}, pe punct termic.`;
}
