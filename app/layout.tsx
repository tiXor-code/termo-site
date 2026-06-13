import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import FeedbackWidget from '@/components/FeedbackWidget';
import SiteNav from '@/components/SiteNav';
import SourceFooter from '@/components/SourceFooter';
import { JsonLd, webSiteJsonLd } from '@/lib/seo';

const GA_ID = 'G-2QJEM3G11G';
const CLARITY_ID = 'x6bu13kw94';

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
        <FeedbackWidget />
        <JsonLd data={webSiteJsonLd()} />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
        <Script id="clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_ID}");`}
        </Script>
      </body>
    </html>
  );
}
