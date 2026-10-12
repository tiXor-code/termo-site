import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const SCANNED = ['app', 'components', 'lib'];

/** The one file allowed to import next/link: the wrapper that sets the default. */
const WRAPPER = path.join('components', 'Link.tsx');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const abs = path.join(ROOT, dir);
  for (const entry of readdirSync(abs)) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) {
      out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(rel);
    }
  }
  return out;
}

describe('Link prefetching stays off by default', () => {
  const files = SCANNED.flatMap(sourceFiles);

  it('finds the source tree it means to scan', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain(WRAPPER);
  });

  // Prefetching every link in the viewport is what made this site 87% of the
  // account's Vercel edge requests and exhausted the Hobby ISR-read allowance
  // (measured 2026-09-06: 35 `?_rsc=` requests for a single homepage visit).
  // Route through components/Link.tsx so the default stays off; a new
  // `import Link from 'next/link'` silently reintroduces the storm.
  it('no component imports next/link directly', () => {
    const offenders = files.filter(
      (f) => f !== WRAPPER && /from\s+['"]next\/link['"]/.test(readFileSync(path.join(ROOT, f), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('the wrapper defaults prefetch to false', () => {
    const src = readFileSync(path.join(ROOT, WRAPPER), 'utf8');
    expect(src).toMatch(/prefetch\s*=\s*false/);
  });
});
