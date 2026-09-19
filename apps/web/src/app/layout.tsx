import type { Metadata, Viewport } from 'next';
import { GOOGLE_FONTS_HREF, cssVariables, fonts } from '@zal/tokens';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Zal — book the hall, skip the phone calls',
    template: '%s · Zal',
  },
  description:
    'Compare real photos, prices and open dates for wedding halls, restaurants and event spaces across Armenia — then hold your date in minutes.',
  applicationName: 'Zal',
  // Venue pages are how people find Zal, so they are server-rendered and
  // indexable rather than hidden behind a client-side fetch.
  openGraph: {
    type: 'website',
    siteName: 'Zal',
    title: 'Zal — book the hall, skip the phone calls',
    description: 'Wedding halls, restaurants and event spaces across Armenia.',
  },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#FBF6EF',
  width: 'device-width',
  initialScale: 1,
  // Not `maximum-scale: 1`: pinching to read a price is a reasonable thing to
  // want, and blocking it fails WCAG 1.4.4 for no benefit.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hy">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
        <style
          // The palette comes from @zal/tokens so web and mobile cannot drift.
          dangerouslySetInnerHTML={{
            __html: `${cssVariables()}
:root {
  --zal-font-display: ${fonts.display};
  --zal-font-body: ${fonts.body};
}`,
          }}
        />
      </head>
      <body>
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        <Providers>
          <div id="main">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
