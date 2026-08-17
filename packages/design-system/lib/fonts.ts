import { cn } from '@repo/design-system/lib/utils';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import {
  Inter,
  Inter_Tight,
  JetBrains_Mono,
  Manrope,
  Space_Grotesk,
} from 'next/font/google';

// Nebuloz marketing typefaces. These were previously pulled from a Google Fonts
// <link> in apps/web's layout, which the nosecone CSP (`style-src 'self'
// 'unsafe-inline'`) silently blocked — so Inter Tight never actually loaded and
// .display fell back to system-ui. Self-hosting via next/font is same-origin, so
// no CSP change is needed.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-inter-tight',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  // 400/500 added for the .label and .mono HUD styles, which request 500.
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
