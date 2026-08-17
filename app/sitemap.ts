import type { MetadataRoute } from 'next';
import { getMeta, getPtAll, getStradaAll, lastCompleteYear } from '@/lib/data';
import { siteUrl } from '@/lib/seo';
import { lastRunDate, rankingLastmod } from '@/lib/sitemap-lastmod';

export default function sitemap(): MetadataRoute.Sitemap {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const dataThrough = meta.data_through;
  const urls: MetadataRoute.Sitemap = [];

  // lastmod is per-URL and reflects the last substantive change of THAT page
  // (see lib/sitemap-lastmod.ts). Never stamp every URL with today's date.
  const add = (path: string, lastModified?: string) =>
    urls.push(lastModified ? { url: siteUrl(path), lastModified } : { url: siteUrl(path) });

  add('/', dataThrough);
  add('/clasament', dataThrough);
  for (const unitate of ['puncte-termice', 'strazi', 'sectoare']) {
    // /clasament/{unitate} shows the last complete year — frozen on its last day.
    add(`/clasament/${unitate}`, rankingLastmod(lcy, dataThrough));
    for (const y of meta.years) {
      // /clasament/{unitate}/{lcy} canonicalizes to the yearless URL — keep
      // only canonical URLs in the sitemap.
      if (y === lcy) continue;
      add(`/clasament/${unitate}/${y}`, rankingLastmod(y, dataThrough));
    }
  }
  for (const [slug, pt] of getPtAll()) {
    add(`/punct-termic/${slug}`, lastRunDate(pt.years, dataThrough) ?? undefined);
  }
  // Only streets with real outage data; OSM-only/estimate streets are noindex.
  for (const [slug, st] of getStradaAll()) {
    if (Object.keys(st.years).length > 0) {
      add(`/strada/${slug}`, lastRunDate(st.years, dataThrough) ?? undefined);
    }
  }
  for (let s = 1; s <= 6; s++) add(`/sector/${s}`, dataThrough);
  add('/harta', dataThrough);
  add('/metodologie', dataThrough);
  add('/despre', dataThrough);

  return urls;
}
