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

/**
 * FAQPage JSON-LD. The `a` strings MUST be the exact text rendered on the page —
 * Google treats a mismatch between markup and visible answer as a violation, and
 * we have no business shipping an answer the reader cannot see.
 */
export function faqPageJsonLd(items: { q: string; a: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'ro',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
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

/**
 * JSON.stringify leaves `<` alone, so a scraped name containing `</script>`
 * (or `<!--`) would terminate the inline script and let third-party data run as
 * markup — SEC042, and the JSON-LD payloads carry thermal-point and street names
 * straight from Termoenergetica's announcements. `<` is valid JSON, parses
 * back to `<`, and cannot close a tag. `>` goes with it so a `]]>` in an XHTML
 * parse cannot end a CDATA section either. Exported for the regression test.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

export function JsonLd({ data }: { data: object }): JSX.Element {
  return createElement('script', {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: serializeJsonLd(data) },
  });
}
