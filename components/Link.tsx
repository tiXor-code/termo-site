import NextLink from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';

type NextLinkProps = ComponentPropsWithoutRef<typeof NextLink>;

/**
 * `next/link` with prefetching **off by default**.
 *
 * Measured 2026-09-06 on the live homepage: one visit fired 35 `?_rsc=` prefetch
 * requests, several of them the same URL repeated under different `_rsc` cache-buster
 * tokens, so each one was a guaranteed cache miss. Across the account that made
 * faraapacalda.ro 87% of all Vercel edge requests and blew the Hobby ISR-read and
 * fast-origin-transfer allowances, which pauses the project rather than billing for it.
 *
 * Every route here is a static page from the build, and visitors arrive from search and
 * usually read one page, so speculatively fetching every link in the viewport buys very
 * little and costs the whole quota. In the App Router `prefetch={false}` disables
 * prefetch on viewport entry *and* on hover.
 *
 * Pass `prefetch` explicitly to opt a specific link back in.
 */
export default function Link({ prefetch = false, ...props }: NextLinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}
