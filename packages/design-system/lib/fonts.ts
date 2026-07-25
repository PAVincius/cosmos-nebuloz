import { cn } from '@repo/design-system/lib/utils';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { JetBrains_Mono, Manrope, Space_Grotesk } from 'next/font/google';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
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
  jetbrainsMono.variable,
  manrope.variable,
  spaceGrotesk.variable,
  'touch-manipulation font-sans antialiased'
);
