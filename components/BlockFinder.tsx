'use client';

// Block finder (client). The street is served by several thermal points (PTs);
// the apartment a renter lives in experiences ONE of them, not the street-wide
// union. The renter picks their block from a <select> built from the street's
// `blocks` field (label → PT slug); the matching server-rendered panel
// (VerdictBand + RenterTip + that PT's history) is revealed.
//
// SSG-safety: every PT panel is rendered on the server (so OutageStrip stays a
// server component and the build stays pure SSG) and passed in as `panels`.
// This component holds NO data layer — it only toggles which pre-rendered panel
// is visible and which serving-PT row is highlighted. Color/contrast rules live
// entirely in the server markup + globals.css; nothing here paints text.

import { useMemo, useState, type ReactNode } from 'react';
import type { Grade } from '@/lib/verdict';

export interface BlockFinderPt {
  /** PT slug — the toggle key shared by the select, the panels, and the list. */
  ptSlug: string;
  /** Display name, e.g. "13 Pantelimon". */
  name: string;
  /** Last-complete-year days without hot water for this PT. */
  days: number;
  /** Grade of `days` (precomputed server-side via gradeFor). */
  grade: Grade;
  /** Server-rendered VerdictBand + RenterTip + history for this PT. */
  panel: ReactNode;
}

export interface BlockFinderProps {
  /** Block label → serving PT slug, straight from the bundle's `blocks` field. */
  blocks: { label: string; pt: string }[];
  /** Serving PTs (one row per PT), in display order. */
  pts: BlockFinderPt[];
  /** PT slug selected on first paint (a representative mid PT). */
  defaultPt: string;
}

export default function BlockFinder({ blocks, pts, defaultPt }: BlockFinderProps) {
  // Only keep block options whose PT actually resolves to a rendered panel.
  const ptSlugs = useMemo(() => new Set(pts.map((p) => p.ptSlug)), [pts]);
  const options = useMemo(
    () => blocks.filter((b) => ptSlugs.has(b.pt)),
    [blocks, ptSlugs],
  );

  const fallbackPt = pts[0]?.ptSlug ?? '';
  const initialPt = ptSlugs.has(defaultPt) ? defaultPt : fallbackPt;
  const [activePt, setActivePt] = useState(initialPt);

  // The select is keyed by block-option index (a block label maps to a PT);
  // the empty value means "show the default panel". Selecting a row in the
  // serving-PT list selects that PT directly.
  const selectValue = useMemo(() => {
    const idx = options.findIndex((b) => b.pt === activePt);
    return idx >= 0 ? String(idx) : '';
  }, [options, activePt]);

  const ptCount = pts.length;

  return (
    <>
      <div className="finder">
        <div className="q">Care e blocul tău?</div>
        <p>
          Strada e lungă și e deservită de <b>{ptCount} de puncte termice</b>. Apa caldă diferă
          mult de la un capăt la altul — alege blocul ca să vezi situația reală a apartamentului,
          nu media întregii străzi.
        </p>
        <select
          aria-label="Alege blocul"
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') return;
            const block = options[Number(v)];
            if (block) setActivePt(block.pt);
          }}
        >
          <option value="" disabled>
            Alege blocul sau zona…
          </option>
          {options.map((b, i) => {
            const pt = pts.find((p) => p.ptSlug === b.pt);
            const ptName = pt ? pt.name : b.pt;
            return (
              <option key={`${b.label}-${b.pt}-${i}`} value={String(i)}>
                {`${ptName} — ${b.label}`}
              </option>
            );
          })}
        </select>
      </div>

      {/* One pre-rendered panel per PT; show the active one, hide the rest. */}
      {pts.map((p) => (
        <div key={p.ptSlug} hidden={p.ptSlug !== activePt}>
          {p.panel}
        </div>
      ))}

      {/* Serving-PT list — clickable, drives the finder. */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Toate zonele de pe această stradă</h2>
        <p className="mt-1 mb-3 text-sm text-ink-soft">
          Apasă pe zona ta ca să-i vezi istoricul. Zile fără apă caldă pe punct termic.
        </p>
        <div className="pts">
          {pts.map((p) => (
            <button
              key={p.ptSlug}
              type="button"
              className={`r w-full text-left${p.ptSlug === activePt ? ' sel' : ''}`}
              aria-pressed={p.ptSlug === activePt}
              onClick={() => setActivePt(p.ptSlug)}
            >
              <span className="n">
                <span className="v-dot" data-v={p.grade} /> {p.name}
              </span>
              <span className="v tnum">{p.days}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
