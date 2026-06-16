'use client';

// Client-only address pinpoint. The street page is pure SSG; this reads the
// `?nr=N` query param and, using the street's pre-resolved `addr` map (passed as
// a prop), surfaces the serving PT that covers that house number - one of the
// street's own serving PTs, picked by proximity. A labeled ESTIMATE. Renders
// nothing without `?nr` or a match, so the page is byte-identical by default.

import { Suspense, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { fold } from '@/lib/search';

export interface AddressBandProps {
  streetName: string;
  /** house_number -> [pt_index into `pts`, estimate_km|null]; -1 = inferred_pt. */
  addr: Record<string, [number, number | null]>;
  pts: string[];
  inferredPt: string | null;
  /** Pre-rendered (server) verdict panels keyed by PT slug. */
  panelsByPt: Record<string, ReactNode>;
  ptName: Record<string, string>;
}

interface Hit {
  slug: string;
  km: number | null;
  interpolated: boolean;
}

function slugFor(idx: number, pts: string[], inferredPt: string | null): string | null {
  return idx === -1 ? inferredPt : (pts[idx] ?? null);
}

/** Exact number, else the nearest known house number (same parity preferred). */
function resolve(
  addr: AddressBandProps['addr'],
  nr: string,
  pts: string[],
  inferredPt: string | null,
): Hit | null {
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

function AddressBandInner(props: AddressBandProps) {
  const params = useSearchParams();
  const nr = fold((params.get('nr') ?? '').trim());
  if (!nr) return null;

  const hit = resolve(props.addr, nr, props.pts, props.inferredPt);
  if (!hit) return null;
  const panel = props.panelsByPt[hit.slug];
  const name = props.ptName[hit.slug];
  if (!panel || !name) return null;

  const kmNote = !hit.interpolated && hit.km != null ? `, ~${hit.km} km` : '';
  return (
    <section className="mt-5">
      <p className="border border-hairline bg-paper-2 p-4 text-sm leading-snug">
        <b>
          Adresa: {props.streetName} {nr}
        </b>{' '}
        — zona e deservită <b>probabil</b> de <b>PT {name}</b> (estimare după proximitate
        {kmNote}). Cifrele de mai jos sunt ale acelui punct termic.
        {hit.interpolated
          ? ' Numărul exact nu apare în hartă; am folosit cea mai apropiată adresă cunoscută.'
          : ''}
      </p>
      <div className="mt-4">{panel}</div>
      <p className="mt-4 text-sm text-ink-soft">Nu e adresa ta? Alege blocul mai jos.</p>
    </section>
  );
}

export default function AddressBand(props: AddressBandProps) {
  return (
    <Suspense fallback={null}>
      <AddressBandInner {...props} />
    </Suspense>
  );
}
