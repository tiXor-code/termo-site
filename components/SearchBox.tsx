'use client';

// Real client-side search (Group C, replaces the foundation stub wholesale).
// Fetches the search index on first focus only; module-level cache shares the
// index across all SearchBox instances on a page.

import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  entryHref,
  prepareIndex,
  search,
  type PreparedEntry,
  type SearchEntry,
} from '@/lib/search';
import { fmtZile } from '@/lib/format';

export interface SearchBoxProps {
  variant: 'hero' | 'nav';
  indexUrl: string;
  autoFocus?: boolean;
  readsQueryParam?: boolean;
  /** Last complete year — labels result day counts ("N zile în {an}"). */
  year?: number;
}

const indexCache = new Map<string, Promise<PreparedEntry[]>>();

function loadIndex(indexUrl: string): Promise<PreparedEntry[]> {
  let cached = indexCache.get(indexUrl);
  if (!cached) {
    cached = fetch(indexUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`search index HTTP ${res.status}`);
        return res.json() as Promise<SearchEntry[]>;
      })
      .then(prepareIndex)
      .catch((err) => {
        indexCache.delete(indexUrl); // allow retry on next focus
        throw err;
      });
    indexCache.set(indexUrl, cached);
  }
  return cached;
}

function typeBadge(e: SearchEntry): string {
  if (e.t === 'pt') return 'PT';
  const dash = e.s.indexOf('-');
  return dash > 0 ? e.s.slice(0, dash) : 'stradă';
}

function SearchBoxInner({
  variant,
  indexUrl,
  autoFocus,
  year,
  initialQuery = '',
}: SearchBoxProps & { initialQuery?: string }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [prepared, setPrepared] = useState<PreparedEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const ensureIndex = () => {
    if (prepared !== null) return;
    loadIndex(indexUrl)
      .then(setPrepared)
      .catch(() => {});
  };

  // /cauta?q=... arrives with a query before any focus event.
  useEffect(() => {
    if (initialQuery !== '') {
      ensureIndex();
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onPointerDown(ev: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const results = prepared && query.trim() !== '' ? search(prepared, query, 8) : [];
  const showEmpty =
    open && prepared !== null && query.trim() !== '' && results.length === 0;
  const showList = open && results.length > 0;

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (ev.key === 'Enter') {
      const target = results[active] ?? results[0];
      if (target) {
        ev.preventDefault();
        setOpen(false);
        router.push(entryHref(target));
      }
    } else if (ev.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div ref={rootRef} className={variant === 'hero' ? 'relative w-full max-w-xl' : 'relative w-48'}>
      <input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Caută strada sau punctul termic…"
        aria-label="Caută strada sau punctul termic"
        autoFocus={autoFocus}
        value={query}
        onFocus={() => {
          ensureIndex();
          setOpen(true);
        }}
        onChange={(ev) => {
          setQuery(ev.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={
          variant === 'hero'
            ? 'w-full border-b border-hairline bg-transparent py-2 text-lg outline-none placeholder:text-ink-soft'
            : 'w-full border-b border-hairline bg-transparent py-1 text-sm outline-none placeholder:text-ink-soft'
        }
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Rezultate căutare"
        className={
          showList
            ? 'absolute left-0 right-0 z-10 border border-hairline bg-paper text-sm'
            : 'hidden'
        }
      >
        {results.map((e, i) => (
          <li key={`${e.t}-${e.s}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
            <a
              href={entryHref(e)}
              className={`flex items-baseline gap-x-2 px-3 py-2 ${i === active ? 'bg-ok' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => setOpen(false)}
            >
              <span className="min-w-0 flex-1 truncate">{e.n}</span>
              <span className="text-xs uppercase text-ink-soft">{typeBadge(e)}</span>
              {e.sec !== null && <span className="text-xs text-ink-soft">Sector {e.sec}</span>}
              <span className="tnum text-xs text-ink-soft">
                {fmtZile(e.d)}
                {year !== undefined ? ` în ${year}` : ''}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {showEmpty && (
        <p className="absolute left-0 right-0 z-10 border border-hairline bg-paper px-3 py-2 text-sm text-ink-soft">
          Niciun rezultat pentru „{query.trim()}". Verifică ortografia — căutarea funcționează și
          fără diacritice.
        </p>
      )}
    </div>
  );
}

function SearchBoxWithParam(props: SearchBoxProps) {
  const params = useSearchParams();
  return <SearchBoxInner {...props} initialQuery={params.get('q') ?? ''} />;
}

export default function SearchBox(props: SearchBoxProps) {
  if (props.readsQueryParam) {
    return (
      <Suspense fallback={<SearchBoxInner {...props} readsQueryParam={false} />}>
        <SearchBoxWithParam {...props} />
      </Suspense>
    );
  }
  return <SearchBoxInner {...props} />;
}
