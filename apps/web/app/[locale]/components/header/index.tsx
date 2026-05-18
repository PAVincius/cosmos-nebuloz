"use client";

import { Button } from "@repo/design-system/components/ui/button";
import type { Dictionary } from "@repo/internationalization";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { env } from "@/env";

type HeaderProps = {
  dictionary: Dictionary;
};

const NAV_ITEMS = [
  { label: "Produto", href: "/#produto" },
  { label: "Comparação", href: "/#comparacao" },
  { label: "Preços", href: "/#precos" },
  { label: "Blog", href: "/blog" },
] as const;

export const Header = ({ dictionary: _ }: HeaderProps) => {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(10,14,39,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--cosmos-deep)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-20">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded"
            style={{
              background: "var(--vega-dim)",
              border: "1px solid rgba(0,212,255,0.3)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: 13,
                color: "var(--vega)",
              }}
            >
              C
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              fontSize: 16,
              color: "var(--cosmos-white)",
              letterSpacing: "-0.01em",
            }}
          >
            Cosmos
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md px-3 py-2 transition-colors"
              style={{
                fontFamily: "var(--font-plex)",
                fontSize: 14,
                color: "var(--cosmos-gray-60)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color =
                  "var(--cosmos-white)";
                (e.currentTarget as HTMLAnchorElement).style.background =
                  "var(--cosmos-slate)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color =
                  "var(--cosmos-gray-60)";
                (e.currentTarget as HTMLAnchorElement).style.background =
                  "transparent";
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={`${env.NEXT_PUBLIC_APP_URL}/sign-in`}
            style={{
              fontFamily: "var(--font-plex)",
              fontSize: 14,
              color: "var(--cosmos-gray-60)",
              padding: "8px 16px",
            }}
          >
            Entrar
          </Link>
          <Button
            asChild
            style={{
              background: "var(--vega)",
              color: "var(--cosmos-black)",
              fontFamily: "var(--font-plex)",
              fontWeight: 600,
              fontSize: 14,
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
            }}
          >
            <Link href="/contact">Agendar demo</Link>
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="flex items-center justify-center rounded md:hidden"
          style={{
            color: "var(--cosmos-gray-60)",
            padding: 8,
            background: "transparent",
            border: "none",
          }}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="px-5 pb-5 pt-2 md:hidden"
          style={{ borderTop: "1px solid var(--cosmos-deep)" }}
        >
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-3"
                style={{
                  fontFamily: "var(--font-plex)",
                  fontSize: 16,
                  color: "var(--cosmos-white)",
                  borderBottom: "1px solid var(--cosmos-deep)",
                }}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <Button
                asChild
                style={{
                  background: "var(--vega)",
                  color: "var(--cosmos-black)",
                  fontFamily: "var(--font-plex)",
                  fontWeight: 600,
                  width: "100%",
                }}
              >
                <Link href="/contact">Agendar demo</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
