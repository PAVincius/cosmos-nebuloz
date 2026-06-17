import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
  display: 'swap'
});

const interTight = Inter_Tight({ 
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: '--font-inter-tight',
  display: 'swap'
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: '--font-jetbrains',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Nebuloz — Inteligência operacional para times que entregam',
  description: 'A camada de inteligência operacional que conecta sistemas, eventos e agentes de IA para entregar clareza e governança em tempo real.',
}

export const viewport: Viewport = {
  themeColor: '#07080c',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="bg-background">
      <body className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable} font-sans antialiased grain`}>
        <div id="progress" className="progress" style={{ transform: 'scaleX(0)', width: '100%' }} />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
