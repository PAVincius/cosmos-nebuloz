import { cn } from '@repo/design-system/lib/utils';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import localFont from 'next/font/local';

// Nebuloz marketing typefaces. These were previously pulled from a Google Fonts
// <link> in apps/web's layout, which the nosecone CSP (`style-src 'self'
// 'unsafe-inline'`) silently blocked — so Inter Tight never actually loaded and
// .display fell back to system-ui. Self-hosting via next/font is same-origin, so
// no CSP change is needed.
//
// The .woff2 files live in ../fonts (variable fonts, latin subset, weight range
// trimmed to what each family loads — see ../fonts/README.md). They replaced
// next/font/google because the Vercel build intermittently failed on it with
// "Module not found: @vercel/turbopack-next/internal/font/google/font".
const inter = localFont({
  src: '../fonts/inter-latin.woff2',
  weight: '400 600',
  variable: '--font-inter',
  display: 'swap',
});

const interTight = localFont({
  src: '../fonts/inter-tight-latin.woff2',
  weight: '500 900',
  variable: '--font-inter-tight',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: '../fonts/jetbrains-mono-latin.woff2',
  // 400/500 added for the .label and .mono HUD styles, which request 500.
  weight: '400 800',
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const manrope = localFont({
  src: '../fonts/manrope-latin.woff2',
  weight: '500 800',
  variable: '--font-manrope',
  display: 'swap',
});

const spaceGrotesk = localFont({
  src: '../fonts/space-grotesk-latin.woff2',
  weight: '400 700',
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const fonts = cn(
  GeistSans.variable,
  GeistMono.variable,
  inter.variable,
  interTight.variable,
  jetbrainsMono.variable,
  manrope.variable,
  spaceGrotesk.variable,
  'touch-manipulation font-sans antialiased'
);
