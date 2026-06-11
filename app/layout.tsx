import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import SiteNav from '@/components/SiteNav';
import SourceFooter from '@/components/SourceFooter';
import { JsonLd, webSiteJsonLd } from '@/lib/seo';

const serif = Source_Serif_4({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-serif-next',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans-next',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://faraapacalda.ro'),
  title: {
    default: 'Fără Apă Caldă — câte zile pe an stă Bucureștiul fără apă caldă',
    template: '%s | Fără Apă Caldă',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${serif.variable} ${inter.variable}`}>
      <body className="bg-paper font-sans text-ink">
        <SiteNav />
        {children}
        <SourceFooter />
        <JsonLd data={webSiteJsonLd()} />
      </body>
    </html>
  );
}
