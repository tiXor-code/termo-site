import type { MetadataRoute } from 'next';
import { getMeta, getPtAll, getStradaAll, lastCompleteYear } from '@/lib/data';
import { siteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const lastModified = new Date(meta.generated_at);
  const urls: MetadataRoute.Sitemap = [];

  const add = (path: string) => urls.push({ url: siteUrl(path), lastModified });

  add('/');
  add('/clasament');
  for (const unitate of ['puncte-termice', 'strazi', 'sectoare']) {
    add(`/clasament/${unitate}`);
    for (const y of meta.years) {
      // /clasament/{unitate}/{lcy} canonicalizes to the yearless URL — keep
      // only canonical URLs in the sitemap.
      if (y === lcy) continue;
      add(`/clasament/${unitate}/${y}`);
    }
  }
  for (const slug of getPtAll().keys()) add(`/punct-termic/${slug}`);
  for (const slug of getStradaAll().keys()) add(`/strada/${slug}`);
  for (let s = 1; s <= 6; s++) add(`/sector/${s}`);
  add('/harta');
  add('/metodologie');
  add('/despre');

  return urls;
}
