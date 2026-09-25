import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from '@/components/Link';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getGuide, getGuides, type Guide } from '@/lib/ghid';
import { fmtDateRo } from '@/lib/format';
import { JsonLd, siteUrl } from '@/lib/seo';

export const dynamic = 'error';
export const dynamicParams = false;

/** Mirrors the `%s | Fără Apă Caldă` template in app/layout.tsx (see lib/seo-meta.ts). */
const TEMPLATE_SUFFIX = ' | Fără Apă Caldă';

export function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  const fits = [...g.title].length + [...TEMPLATE_SUFFIX].length <= 60;
  return {
    title: fits ? g.title : { absolute: g.title },
    description: g.description,
    alternates: { canonical: `/ghid/${g.slug}` },
    openGraph: { type: 'article', title: g.title, description: g.description, url: `/ghid/${g.slug}`, modifiedTime: g.updated },
  };
}

function articleJsonLd(g: Guide): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.description,
    inLanguage: 'ro',
    dateModified: g.updated,
    mainEntityOfPage: siteUrl(`/ghid/${g.slug}`),
    publisher: { '@type': 'Organization', name: 'Fără Apă Caldă', url: siteUrl('/') },
    citation: g.sources.map((s) => s.url),
  };
}

export default async function GhidPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Acasă', href: '/' },
          { name: 'Ghiduri', href: '/ghid' },
          { name: g.title, href: `/ghid/${g.slug}` },
        ]}
      />
      <article className="mt-4">
        <h1 className="font-display text-3xl font-bold">{g.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">Actualizat la {fmtDateRo(g.updated)}</p>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">{g.lead}</p>
        {g.sections.map((s) => (
          <section key={s.heading} className="mt-10 border-t border-hairline pt-6">
            <h2 className="font-display text-2xl font-bold">{s.heading}</h2>
            <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
              {s.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {s.bullets && (
                <ul className="list-disc space-y-1 pl-5">
                  {s.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
        {g.related.length > 0 && (
          <section className="mt-10 border-t border-hairline pt-6">
            <h2 className="font-display text-2xl font-bold">Vezi și</h2>
            <ul className="mt-3 space-y-1">
              {g.related.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="underline">
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="mt-10 border-t border-hairline pt-6">
          <h2 className="font-display text-2xl font-bold">Surse</h2>
          <ol className="mt-3 max-w-2xl list-decimal space-y-1 pl-5 text-sm">
            {g.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noopener noreferrer" className="underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </section>
      </article>
      <JsonLd data={articleJsonLd(g)} />
    </main>
  );
}
