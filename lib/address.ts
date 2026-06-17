// Shared, client-safe resolver: maps a typed house number to the serving PT
// that covers it. Used by BlockFinder (pre-selects the PT) and AddressNote (the
// one-line estimate). A proximity ESTIMATE — see lib/data StreetEntity.addr.

import { fold } from '@/lib/search';

/** house_number -> [pt_index into `pts`, estimate_km|null]; -1 = inferred_pt. */
export type AddrMap = Record<string, [number, number | null]>;

export interface ResolvedAddr {
  slug: string;
  km: number | null;
  interpolated: boolean;
}

function slugFor(idx: number, pts: string[], inferredPt: string | null): string | null {
  return idx === -1 ? inferredPt : (pts[idx] ?? null);
}

/**
 * Resolve a (folded) house number against a street's addr map. Exact key first;
 * otherwise the nearest known numeric house number (same parity preferred),
 * flagged `interpolated`. Returns null when the map is empty or the chosen entry
 * has no resolvable PT.
 */
export function resolveAddr(
  addr: AddrMap,
  rawNr: string,
  pts: string[],
  inferredPt: string | null,
): ResolvedAddr | null {
  const nr = fold(rawNr.trim());
  if (!nr) return null;

  const exact = addr[nr];
  if (exact) {
    const slug = slugFor(exact[0], pts, inferredPt);
    return slug ? { slug, km: exact[1], interpolated: false } : null;
  }

  const target = parseInt(nr, 10);
  if (!Number.isFinite(target)) return null;
  let bestKey: string | null = null;
  let bestScore = Infinity;
  for (const key of Object.keys(addr)) {
    const k = parseInt(key, 10);
    if (!Number.isFinite(k)) continue;
    const score = Math.abs(k - target) * 2 + (k % 2 === target % 2 ? 0 : 1);
    if (score < bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  if (bestKey === null) return null;
  const slug = slugFor(addr[bestKey][0], pts, inferredPt);
  return slug ? { slug, km: null, interpolated: true } : null;
}
