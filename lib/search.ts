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

export function entryHref(e: SearchEntry): string {
  return e.t === 'pt' ? `/punct-termic/${e.s}` : `/strada/${e.s}`;
}
