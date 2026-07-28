import type { MetadataRoute } from 'next';
import { getMeta, getPtAll, getStradaAll, lastCompleteYear } from '@/lib/data';
import { entityLastmod, parseUtcDay, yearLastmod } from '@/lib/lastmod';
import { siteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  // `data_through` (a day), not `generated_at` (a build timestamp): the sitemap
  // must describe when the DATA last moved, not when CI last ran. See
  // lib/lastmod.ts for why every url no longer shares one stamp.
  const dataThrough = parseUtcDay(meta.data_through);
  const urls: MetadataRoute.Sitemap = [];

  const add = (path: string, lastModified?: Date) =>
    urls.push(lastModified ? { url: siteUrl(path), lastModified } : { url: siteUrl(path) });

  // Live hubs: genuinely re-rendered every time the bundle moves.
  add('/', dataThrough);
  add('/clasament', dataThrough);
  for (const unitate of ['puncte-termice', 'strazi', 'sectoare']) {
    add(`/clasament/${unitate}`, dataThrough);
    for (const y of meta.years) {
      // /clasament/{unitate}/{lcy} canonicalizes to the yearless URL — keep
      // only canonical URLs in the sitemap.
      if (y === lcy) continue;
      // A closed year is frozen; only the in-progress year still moves.
      add(`/clasament/${unitate}/${y}`, yearLastmod(y, dataThrough));
    }
  }
  for (const [slug, pt] of getPtAll()) {
    add(`/punct-termic/${slug}`, entityLastmod(pt.years, dataThrough));
  }
  // Only streets with real outage data; OSM-only/estimate streets are noindex.
  for (const [slug, st] of getStradaAll()) {
    if (Object.keys(st.years).length > 0) {
      add(`/strada/${slug}`, entityLastmod(st.years, dataThrough));
    }
  }
  for (let s = 1; s <= 6; s++) add(`/sector/${s}`, dataThrough);
  add('/harta', dataThrough);
  // Editorial pages: no lastmod. They do not change when the data does, and an
  // invented date is exactly the noise this file was written to remove.
  add('/metodologie');
  add('/despre');

  return urls;
}
