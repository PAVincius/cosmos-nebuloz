import withBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

/**
 * Origem (esquema + host + porta) do Supabase a partir de uma URL, ou null se a
 * URL não existe, não é válida ou não é http/https.
 *
 * O navegador faz o PUT direto na URL assinada do Storage (artefato de passo do
 * Scaffold, entregável, evidência do Charter). Sem a origem no `connect-src`, o
 * CSP barra a requisição (securitypolicyviolation) e o upload nunca chega ao
 * bucket. Só a origem, nunca o caminho, e só se a env existir: URL inválida não
 * pode derrubar o `headers()` nem entrar no cabeçalho.
 */
export function supabaseOrigin(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    // Só http(s): `new URL("file:///x").origin` é a STRING "null", que iria
    // literal para o cabeçalho.
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

export const config: NextConfig = {
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,

  headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              [
                "connect-src 'self' wss://*.liveblocks.io https://*.liveblocks.io https://*.anthropic.com https://*.googleapis.com https://us.i.posthog.com https://us-assets.i.posthog.com https://api.inngest.com",
                supabaseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL),
              ]
                .filter(Boolean)
                .join(" "),
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
                : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);
