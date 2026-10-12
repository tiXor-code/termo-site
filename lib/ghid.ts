// Guides (/ghid): one JSON file per article in content/ghid, read and validated at build time
// like the data bundle. SGEO (the site's SEO agent) publishes new files here through reviewed
// pull requests; a file that breaks any rule below fails the build, so the preview build refuses
// the merge and a malformed article can never reach production. Text is plain (no HTML, no
// Markdown): React escapes it, and links only come from `related` (internal) and `sources`.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export type GuideSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type GuideSource = { title: string; url: string };
export type GuideLink = { label: string; href: string };
export type Guide = {
  slug: string;
  title: string;
  description: string;
  updated: string;
  lead: string;
  sections: GuideSection[];
  sources: GuideSource[];
  related: GuideLink[];
};

const DIR = path.join(process.cwd(), 'content', 'ghid');
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR = /\b(19|20)\d{2}\b/;

/** Length in Unicode codepoints, so ă/î/ș count as one character. */
const len = (s: string) => [...s].length;

function text(v: unknown, where: string, min: number, max: number): string {
  if (typeof v !== 'string') throw new Error(`${where} must be text`);
  const t = v.trim();
  if (len(t) < min || len(t) > max) throw new Error(`${where} must be ${min}-${max} characters (has ${len(t)})`);
  if (/[<>]/.test(t)) throw new Error(`${where} must not contain < or >`);
  return t;
}

function list<T>(v: unknown, where: string, min: number, max: number, item: (x: unknown, w: string) => T): T[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) throw new Error(`${where} must list ${min}-${max} items`);
  return v.map((x, i) => item(x, `${where}[${i}]`));
}

const obj = (v: unknown, where: string) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where} must be an object`);
  return v as Record<string, unknown>;
};

export function parseGuide(raw: unknown, file: string): Guide {
  const g = obj(raw, file);
  const slug = text(g.slug, `${file}: slug`, 3, 90);
  if (!SLUG.test(slug)) throw new Error(`${file}: slug must be lowercase ascii words joined by dashes`);
  const title = text(g.title, `${file}: title`, 15, 60);
  if (YEAR.test(title)) throw new Error(`${file}: title must not contain a year (it would date the page)`);
  const updated = text(g.updated, `${file}: updated`, 10, 10);
  if (!DATE.test(updated) || Number.isNaN(Date.parse(`${updated}T00:00:00Z`))) throw new Error(`${file}: updated must be YYYY-MM-DD`);
  const guide: Guide = {
    slug,
    title,
    description: text(g.description, `${file}: description`, 70, 160),
    updated,
    lead: text(g.lead, `${file}: lead`, 80, 700),
    sections: list(g.sections, `${file}: sections`, 2, 8, (s, w) => {
      const o = obj(s, w);
      return {
        heading: text(o.heading, `${w}.heading`, 3, 90),
        paragraphs: list(o.paragraphs, `${w}.paragraphs`, 1, 8, (p, pw) => text(p, pw, 20, 1400)),
        ...(o.bullets === undefined ? {} : { bullets: list(o.bullets, `${w}.bullets`, 1, 12, (b, bw) => text(b, bw, 2, 300)) }),
      };
    }),
    sources: list(g.sources, `${file}: sources`, 1, 8, (s, w) => {
      const o = obj(s, w);
      const url = text(o.url, `${w}.url`, 12, 500);
      let u: URL;
      try { u = new URL(url); } catch { throw new Error(`${w}.url is not a URL`); }
      if (u.protocol !== 'https:') throw new Error(`${w}.url must be https`);
      return { title: text(o.title, `${w}.title`, 3, 200), url: u.toString() };
    }),
    related: list(g.related ?? [], `${file}: related`, 0, 6, (r, w) => {
      const o = obj(r, w);
      const href = text(o.href, `${w}.href`, 1, 200);
      if (!href.startsWith('/') || href.startsWith('//') || /[?#\s\\]/.test(href)) throw new Error(`${w}.href must be a site path like /harta`);
      return { label: text(o.label, `${w}.label`, 3, 80), href };
    }),
  };
  const headings = guide.sections.map((s) => s.heading.toLowerCase());
  if (new Set(headings).size !== headings.length) throw new Error(`${file}: section headings must be unique`);
  const words = [guide.lead, ...guide.sections.flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])])].join(' ').split(/\s+/).filter(Boolean).length;
  if (words < 300 || words > 2200) throw new Error(`${file}: body must be 300-2200 words (has ${words})`);
  return guide;
}

let cache: Guide[] | null = null;

/** Every guide, newest first. Throws (failing the build) on any invalid or misnamed file. */
export function getGuides(): Guide[] {
  if (cache) return cache;
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).sort() : [];
  const guides = files.map((f) => {
    const g = parseGuide(JSON.parse(readFileSync(path.join(DIR, f), 'utf8')), `content/ghid/${f}`);
    if (`${g.slug}.json` !== f) throw new Error(`content/ghid/${f}: file name must be the slug (${g.slug}.json)`);
    return g;
  });
  for (const key of ['title', 'description'] as const) {
    const seen = new Set<string>();
    for (const g of guides) {
      const v = g[key].toLowerCase();
      if (seen.has(v)) throw new Error(`content/ghid/${g.slug}.json: ${key} duplicates another guide`);
      seen.add(v);
    }
  }
  cache = guides.sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title, 'ro'));
  return cache;
}

export function getGuide(slug: string): Guide | undefined {
  return getGuides().find((g) => g.slug === slug);
}
