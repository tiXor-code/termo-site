import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd, faqPageJsonLd, serializeJsonLd } from '@/lib/seo';

describe('lib/seo — JSON-LD serialization', () => {
  it('never emits a raw "<" so scraped names cannot close the script tag', () => {
    // Names come from Termoenergetica's announcements — untrusted third-party
    // text. A bare JSON.stringify would ship "</script>" verbatim (SEC042).
    const out = serializeJsonLd(
      breadcrumbJsonLd([{ name: '</script><img src=x onerror=alert(1)>', href: '/x' }]),
    );
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).toContain('\\u003c/script\\u003e');
    // Still valid JSON that round-trips to the original text.
    const parsed = JSON.parse(out) as { itemListElement: { name: string }[] };
    expect(parsed.itemListElement[0].name).toBe('</script><img src=x onerror=alert(1)>');
  });

  it('faqPageJsonLd carries the answers verbatim', () => {
    const items = [{ q: 'Când?', a: 'Peste 6 ore.' }];
    const ld = faqPageJsonLd(items) as {
      '@type': string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(1);
    expect(ld.mainEntity[0].name).toBe('Când?');
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe('Peste 6 ore.');
  });
});
