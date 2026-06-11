import { createElement } from 'react';
import type { JSX } from 'react';
import type { Meta } from '@/lib/data';

const SITE_NAME = 'Fără Apă Caldă';
const BUNDLE_URL =
  'https://github.com/tiXor-code/termo-data/releases/download/data-latest/bundle.tar.gz';

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://faraapacalda.ro').replace(/\/+$/, '');
}

export function siteUrl(path: string): string {
  if (path === '') return siteBase();
  return siteBase() + (path.startsWith('/') ? path : `/${path}`);
}

export function webSiteJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl('/'),
    inLanguage: 'ro',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteBase()}/cauta?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; href: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: siteUrl(item.href),
    })),
  };
}

/** Dataset JSON-LD — used only on /metodologie. */
export function datasetJsonLd(meta: Meta): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${SITE_NAME} — zile cu întreruperi de apă caldă în București`,
    description:
      'Zile cu întreruperi de apă caldă pe punct termic, stradă și sector în București, ' +
      'reconstruite din anunțurile publice Termoenergetica.',
    url: siteUrl('/metodologie'),
    inLanguage: 'ro',
    temporalCoverage: `2021-12/${meta.data_through}`,
    spatialCoverage: 'București, România',
    dateModified: meta.generated_at,
    isBasedOn: 'https://www.cmteb.ro',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'application/gzip',
      contentUrl: BUNDLE_URL,
    },
  };
}

export function JsonLd({ data }: { data: object }): JSX.Element {
  return createElement('script', {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  });
}
