import Link from "next/link";
import { env } from "@/env";

const LINKS = {
  produto: [
    { label: "PI Planning", href: "/#produto" },
    { label: "Portfolio", href: "/#produto" },
    { label: "AI Insights", href: "/#produto" },
    { label: "Preços", href: "/#precos" },
  ],
  empresa: [
    { label: "Sobre", href: "/contact" },
    { label: "Blog", href: "/blog" },
    ...(env.NEXT_PUBLIC_DOCS_URL
      ? [{ label: "Docs", href: env.NEXT_PUBLIC_DOCS_URL }]
      : []),
  ],
  legal: [
    { label: "Privacidade", href: "/legal/privacy" },
    { label: "Termos", href: "/legal/terms" },
  ],
} as const;

export const Footer = () => (
  <footer
    className="w-full"
    style={{
      background: "var(--cosmos-black)",
      borderTop: "1px solid var(--cosmos-deep)",
    }}
  >
    <div className="mx-auto max-w-7xl px-5 py-16 md:px-20">
      <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
        {/* Brand */}
        <div className="col-span-2 flex flex-col gap-4 md:col-span-1">
          <div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: 18,
                color: "var(--vega)",
                letterSpacing: "-0.01em",
              }}
            >
              Cosmos
            </span>
            <span
              className="ml-2"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--cosmos-gray-60)",
              }}
            >
              by Nebuloz
            </span>
          </div>
          <p
            style={{
              fontFamily: "var(--font-plex)",
              fontSize: 13,
              color: "var(--cosmos-gray-60)",
              lineHeight: 1.6,
              maxWidth: 220,
            }}
          >
            Plataforma de portfolio ágil para empresas que rodam SAFe a sério.
          </p>
          <div className="mt-2 flex gap-3">
            <Link
              className="rounded px-2 py-1 text-xs transition-colors"
              href="https://linkedin.com/company/nebuloz"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--cosmos-gray-60)",
                border: "1px solid var(--cosmos-deep)",
              }}
              target="_blank"
            >
              LinkedIn
            </Link>
            <Link
              className="rounded px-2 py-1 text-xs transition-colors"
              href="https://github.com/nebuloz"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--cosmos-gray-60)",
                border: "1px solid var(--cosmos-deep)",
              }}
              target="_blank"
            >
              GitHub
            </Link>
          </div>
        </div>

        {/* Produto */}
        <div className="flex flex-col gap-3">
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--vega)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Produto
          </p>
          {LINKS.produto.map((l) => (
            <Link
              href={l.href}
              key={l.label}
              style={{
                fontFamily: "var(--font-plex)",
                fontSize: 14,
                color: "var(--cosmos-gray-60)",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Empresa */}
        <div className="flex flex-col gap-3">
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--vega)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Empresa
          </p>
          {LINKS.empresa.map((l) => (
            <Link
              href={l.href}
              key={l.label}
              style={{
                fontFamily: "var(--font-plex)",
                fontSize: 14,
                color: "var(--cosmos-gray-60)",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Legal */}
        <div className="flex flex-col gap-3">
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--vega)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Legal
          </p>
          {LINKS.legal.map((l) => (
            <Link
              href={l.href}
              key={l.label}
              style={{
                fontFamily: "var(--font-plex)",
                fontSize: 14,
                color: "var(--cosmos-gray-60)",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="mt-12 flex flex-col items-center justify-between gap-4 pt-8 md:flex-row"
        style={{ borderTop: "1px solid var(--cosmos-deep)" }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--cosmos-gray-60)",
          }}
        >
          © 2025 Nebuloz Desenvolvimento de Softwares LTDA. Cosmos® é marca
          registrada.
        </p>
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--aurora)" }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--cosmos-gray-60)",
            }}
          >
            Todos os sistemas operacionais
          </span>
        </div>
      </div>
    </div>
  </footer>
);
