// Visible FAQ + the matching FAQPage JSON-LD, from one source of truth.
// Answers render as plain text (open by default — no <details>, so the answer is
// in the first paint and readable without JS), and the exact same strings go
// into the structured data.
import { JsonLd, faqPageJsonLd } from '@/lib/seo';
import type { FaqItem } from '@/lib/sector-faq';

export default function FaqSection({
  items,
  heading,
  id = 'intrebari',
}: {
  items: FaqItem[];
  heading: string;
  id?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section id={id} className="mt-12">
      <h2 className="hairline-b pb-2 font-display text-xl font-bold">{heading}</h2>
      <dl className="mt-4 space-y-6">
        {items.map((item) => (
          <div key={item.q} className="max-w-2xl">
            <dt className="font-display text-lg font-bold">{item.q}</dt>
            <dd className="mt-1 leading-relaxed">{item.a}</dd>
          </div>
        ))}
      </dl>
      <JsonLd data={faqPageJsonLd(items)} />
    </section>
  );
}
