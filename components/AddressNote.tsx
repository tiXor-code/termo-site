'use client';

// One-line address estimate, for street pages with NO block finder (single-PT,
// or multi-PT with no block data). Reads ?nr=N and names the serving PT that
// covers it — a proximity ESTIMATE. Renders nothing without a number/match, so
// the page is byte-identical by default. (Case 3 streets show this inside the
// BlockFinder instead, which also pre-selects the PT — see BlockFinder.)

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resolveAddr, type AddrMap } from '@/lib/address';
import { fold } from '@/lib/search';

export interface AddressNoteProps {
  streetName: string;
  addr: AddrMap;
  pts: string[];
  inferredPt: string | null;
  ptName: Record<string, string>;
}

function AddressNoteInner(props: AddressNoteProps) {
  const params = useSearchParams();
  const rawNr = params.get('nr') ?? '';
  const res = resolveAddr(props.addr, rawNr, props.pts, props.inferredPt);
  if (!res) return null;
  const name = props.ptName[res.slug];
  if (!name) return null;

  const nr = fold(rawNr).trim();
  const single = props.pts.length <= 1;
  const kmNote = !res.interpolated && res.km != null ? `, ~${res.km} km` : '';
  const interpNote = res.interpolated ? '; numărul exact nu apare în hartă' : '';

  return (
    <p className="mt-5 border border-hairline bg-paper-2 p-4 text-sm leading-snug">
      <b>
        Adresa: {props.streetName} {nr}
      </b>{' '}
      {single ? (
        <>
          — toată strada e deservită de <b>PT {name}</b>. Cifrele de mai jos sunt ale acelui punct
          termic.
        </>
      ) : (
        <>
          — zona e deservită <b>probabil</b> de{' '}
          <Link href={`/punct-termic/${res.slug}`} className="underline">
            PT {name}
          </Link>{' '}
          (estimare după proximitate{kmNote}
          {interpNote}).
        </>
      )}
    </p>
  );
}

export default function AddressNote(props: AddressNoteProps) {
  return (
    <Suspense fallback={null}>
      <AddressNoteInner {...props} />
    </Suspense>
  );
}
