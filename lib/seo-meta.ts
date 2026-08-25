// Title/description builders for detail pages (Group C owns this file).
import type { PtEntity, StreetEntity } from '@/lib/data';
import { fmtInt } from '@/lib/format';

/**
 * Mirrors the `%s | Fără Apă Caldă` title template in app/layout.tsx. A plain
 * string returned from a builder gets this suffix appended by Next; an
 * `{ absolute }` value opts out of the template entirely.
 */
const TEMPLATE_SUFFIX = ' | Fără Apă Caldă';
const TITLE_MAX = 60;
const DESC_MAX = 160;

export type PageTitle = string | { absolute: string };

/** Length in Unicode codepoints, so ă/î/ș count as one character. */
function len(s: string): number {
  return [...s].length;
}

/**
 * Entity names come from RADET/CMTEB data and run up to 82 chars, so no fixed
 * wording keeps every title in the 30-60 range. Candidates are ordered most to
 * least informative; the first that fits WITH the brand suffix wins, then the
 * first that fits alone (dropping the suffix), then `lastResort`, which the
 * caller guarantees fits by truncating the name itself.
 */
function fitTitle(candidates: string[], lastResort: string): PageTitle {
  for (const c of candidates) if (len(c) + len(TEMPLATE_SUFFIX) <= TITLE_MAX) return c;
  for (const c of candidates) if (len(c) <= TITLE_MAX) return { absolute: c };
  return { absolute: lastResort };
}

/** First candidate within DESC_MAX; the last one must fit by construction. */
function fitDescription(candidates: string[]): string {
  for (const c of candidates) if (len(c) <= DESC_MAX) return c;
  return candidates[candidates.length - 1];
}

/** Cut at a word boundary to at most `max` codepoints, dropping dangling punctuation. */
function cutAtWord(name: string, max: number): string {
  if (len(name) <= max) return name;
  const head = [...name].slice(0, max).join('');
  const cut = head.replace(/\s+\S*$/u, '').replace(/[\s,.\-–—(/]+$/u, '');
  return cut.length > 0 ? cut : head;
}

/** "Sector 4" / "Sectoarele 2 și 3" / "Sectoarele 2, 3 și 4". */
export function sectorsPhrase(sectors: number[]): string {
  if (sectors.length === 0) return 'București';
  if (sectors.length === 1) return `Sector ${sectors[0]}`;
  const last = sectors[sectors.length - 1];
  return `Sectoarele ${sectors.slice(0, -1).join(', ')} și ${last}`;
}

export function ptTitle(pt: PtEntity): PageTitle {
  const sector = ` — Sector ${pt.sector}`;
  const cut = cutAtWord(pt.name, TITLE_MAX - len(sector) - 1);
  return fitTitle(
    [`${pt.name} — punct termic, Sector ${pt.sector}`, `${pt.name}${sector}`, pt.name],
    `${cut}…${sector}`,
  );
}

export function ptDescription(pt: PtEntity, an: number): string {
  const who = `${pt.name} (Sector ${pt.sector})`;
  const y = pt.years[String(an)];
  if (!y || y.days === 0) {
    // A zero-outage PT can still carry deficiency days. Claiming "fără
    // întreruperi" here would contradict the page body, which now reports them
    // — a body/description mismatch Google can see.
    const def = y?.days_deficienta ?? 0;
    if (def > 0) {
      return fitDescription([
        `${who}: fără opriri de apă caldă în ${an}, dar ${fmtInt(def)} zile cu presiune sau temperatură scăzută. Istoric complet pe ani.`,
        `${who}: fără opriri în ${an}, dar ${fmtInt(def)} zile cu presiune sau temperatură scăzută.`,
        `${cutAtWord(pt.name, 80)} (Sector ${pt.sector}): fără opriri în ${an}, ${fmtInt(def)} zile cu deficiențe.`,
      ]);
    }
    return fitDescription([
      `${who}: fără întreruperi de apă caldă înregistrate în ${an}. Istoric complet pe ani, episoade și comparație cu orașul.`,
      `${who}: fără întreruperi de apă caldă înregistrate în ${an}. Istoric complet pe ani.`,
      `${cutAtWord(pt.name, 80)} (Sector ${pt.sector}): fără întreruperi de apă caldă în ${an}.`,
    ]);
  }
  const avut = `a avut ${fmtInt(y.days)} zile cu întreruperi de apă caldă în ${an}`;
  return fitDescription([
    `${who} ${avut}: ${fmtInt(y.days_avarie)} din avarii și ${fmtInt(y.days_programat)} din lucrări programate.`,
    `${who} ${avut}.`,
    `${cutAtWord(pt.name, 80)} (Sector ${pt.sector}) ${avut}.`,
  ]);
}

export function streetTitle(street: StreetEntity): PageTitle {
  return fitTitle(
    [
      `Apă caldă pe ${street.name}, ${sectorsPhrase(street.sectors)}`,
      `Apă caldă pe ${street.name}`,
      street.name,
    ],
    `Apă caldă pe ${cutAtWord(street.name, TITLE_MAX - len('Apă caldă pe ') - 1)}…`,
  );
}

export function streetDescription(
  street: StreetEntity,
  an: number,
  firstYear: number,
  lastYear: number,
): string {
  const istoric = `Istoric complet ${firstYear}–${lastYear}, pe punct termic.`;
  const y = street.years[String(an)];
  if (!y || y.days === 0) {
    return fitDescription([
      `${street.name}: fără întreruperi de apă caldă înregistrate în ${an}. ${istoric}`,
      `${street.name}: fără întreruperi de apă caldă înregistrate în ${an}.`,
    ]);
  }
  const avut = `a avut ${fmtInt(y.days)} zile cu întreruperi de apă caldă în ${an}, din care ${fmtInt(y.days_avarie)} din avarii`;
  return fitDescription([
    `${street.name} ${avut}. ${istoric}`,
    `${street.name} ${avut}.`,
    `${cutAtWord(street.name, 60)} ${avut}.`,
  ]);
}
