import { Analytics } from '@vercel/analytics/next';
import { T } from '@/lib/constants';

export const metadata = {
  title: 'Harvest Moon',
  description: 'NASCAR Fantasy League',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Harvest Moon',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#14110D',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ margin: 0, background: T.shell }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
