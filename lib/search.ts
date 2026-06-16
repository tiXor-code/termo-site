// Pure, client-safe search over client/search-index.json (Group C owns this file).

export interface SearchEntry {
  t: 'pt' | 'st';
  n: string;
  s: string;
  sec: number | null;
  d: number;
}

export interface PreparedEntry extends SearchEntry {
  nf: string; // folded name
}

/** A street result may carry a typed house number ("Colentina 64"). */
export interface SearchResult extends PreparedEntry {
  nr?: string | null;
}

/** Diacritic fold + lowercase — handles ș/ț/ă/â/î (and legacy ş/ţ). */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function prepareIndex(entries: SearchEntry[]): PreparedEntry[] {
  return entries.map((e) => ({ ...e, nf: fold(e.n) }));
}

/** 3 = full prefix, 2 = word-boundary prefix, 1 = substring, 0 = no match. */
export function scoreEntry(qf: string, nf: string): 0 | 1 | 2 | 3 {
  if (qf === '' || nf === '') return 0;
  if (nf.startsWith(qf)) return 3;
  const idx = nf.indexOf(qf);
  if (idx === -1) return 0;
  if (/[^\p{L}\p{N}]/u.test(nf[idx - 1] ?? ' ')) return 2;
  return 1;
}

/** Score desc, ties broken by d desc. Empty/whitespace query → []. */
export function search(prepared: PreparedEntry[], query: string, limit = 8): PreparedEntry[] {
  const qf = fold(query.trim());
  if (qf === '') return [];
  const scored: { e: PreparedEntry; score: number }[] = [];
  for (const e of prepared) {
    const score = scoreEntry(qf, e.nf);
    if (score > 0) scored.push({ e, score });
  }
  scored.sort((a, b) => (b.score - a.score) || (b.e.d - a.e.d));
  return scored.slice(0, limit).map((s) => s.e);
}

// A trailing house number after the street: "64", "64a", "64-66", "12 bis".
const HOUSE_NR = /[\s,]+(\d+[a-z]?(?:[-/]\d+[a-z]?)?(?:\s*bis)?)$/u;

/**
 * Split a typed query into a street part and an optional house number.
 * "Colentina 64" -> { streetPart: "colentina", nr: "64" };
 * "Constantin Radulescu Motru 12" -> { ..., nr: "12" };
 * "Pajurei" / "64" -> { streetPart, nr: null }. The street part must contain a
 * letter, so a bare number is not treated as an address.
 */
export function splitHouseNumber(query: string): { streetPart: string; nr: string | null } {
  const f = fold(query.trim());
  const m = HOUSE_NR.exec(f);
  if (m) {
    const streetPart = f.slice(0, m.index).trim();
    if (/\p{L}/u.test(streetPart)) {
      return { streetPart, nr: m[1].replace(/\s+/g, ' ').trim() };
    }
  }
  return { streetPart: f, nr: null };
}

/**
 * Number-aware search. With a house number, match the street part only and tag
 * street results with `nr` (so the UI shows "…, nr. N" and links to ?nr=N).
 * Without one, identical to `search`.
 */
export function searchAddress(prepared: PreparedEntry[], query: string, limit = 8): SearchResult[] {
  const { streetPart, nr } = splitHouseNumber(query);
  if (nr === null) return search(prepared, query, limit);
  return search(prepared, streetPart, limit).map((e) => (e.t === 'st' ? { ...e, nr } : e));
}

export function entryHref(e: SearchEntry & { nr?: string | null }): string {
  if (e.t === 'pt') return `/punct-termic/${e.s}`;
  return e.nr ? `/strada/${e.s}?nr=${encodeURIComponent(e.nr)}` : `/strada/${e.s}`;
}
