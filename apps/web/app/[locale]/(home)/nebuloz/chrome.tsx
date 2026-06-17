"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <div
      aria-label="Nebuloz — Página inicial"
      className="flex items-center gap-2.5"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        height={size}
        viewBox="0 0 32 32"
        width={size}
      >
        <defs>
          <linearGradient id="nz-logo" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#7c6cff" />
            <stop offset="50%" stopColor="#5b8cff" />
            <stop offset="100%" stopColor="#3cc3ff" />
          </linearGradient>
        </defs>
        <circle
          cx="16"
          cy="16"
          fill="none"
          opacity="0.5"
          r="14"
          stroke="url(#nz-logo)"
          strokeWidth="1.4"
        />
        <path
          d="M9 22V10l14 12V10"
          fill="none"
          stroke="url(#nz-logo)"
          strokeLinecap="square"
          strokeWidth="2.2"
        />
        <circle cx="16" cy="16" fill="url(#nz-logo)" opacity="0.9" r="3" />
      </svg>
      <span className="font-sans font-semibold text-[15px] tracking-tight">
        Nebuloz
      </span>
    </div>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const links = [
    { label: "Platform", href: "#platform" },
    { label: "System", href: "#system" },
    { label: "MetaBrain", href: "#metabrain" },
    { label: "Pricing", href: "#join" },
    { label: "Docs", href: "#platform" },
  ];

  return (
    <>
      <motion.header
        animate={{ y: 0, opacity: 1 }}
        className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${scrolled ? "border-hairline border-b bg-canvas/60 backdrop-blur-xl" : ""}`}
        initial={{ y: -20, opacity: 0 }}
        role="banner"
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
          <a
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-violet)]"
            href="/"
          >
            <Logo />
          </a>

          {/* Desktop nav */}
          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 rounded-full border border-hairline bg-white/[0.025] px-1 py-1 md:flex"
          >
            {links.map((l) => (
              <a
                className="flex min-h-[36px] items-center rounded-full px-3.5 py-2 text-[13px] text-body transition-colors hover:bg-white/[0.05] hover:text-ink"
                href={l.href}
                key={l.label}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              className="hidden min-h-[44px] items-center whitespace-nowrap px-3 text-[13px] text-body transition-colors hover:text-ink md:inline-flex"
              href="#join"
            >
              Sign in
            </a>
            <a
              className="btn-primary !h-[44px] !text-[13px] !px-4 whitespace-nowrap"
              href="#join"
            >
              <span>Start building</span>
            </a>
            {/* Hamburger — mobile only */}
            <button
              aria-controls="mobile-nav"
              aria-expanded={open}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline md:hidden"
              onClick={() => setOpen(!open)}
            >
              <svg
                aria-hidden="true"
                height="14"
                viewBox="0 0 14 14"
                width="14"
              >
                <path
                  d={open ? "M2 2l10 10M12 2L2 12" : "M1 4h12M1 10h12"}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile nav panel */}
      <AnimatePresence>
        {open && (
          <motion.nav
            animate={{ opacity: 1, y: 0 }}
            aria-label="Menu mobile"
            className="fixed top-16 right-0 left-0 z-40 border-hairline border-b bg-canvas/95 backdrop-blur-xl md:hidden"
            exit={{ opacity: 0, y: -8 }}
            id="mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <ul
              className="mx-auto flex max-w-[1320px] flex-col gap-1 px-6 py-4"
              role="list"
            >
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    className="flex min-h-[48px] items-center rounded-xl px-4 text-[15px] text-body transition-colors hover:bg-white/[0.05] hover:text-ink"
                    href={l.href}
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  className="mt-2 flex min-h-[48px] items-center justify-center rounded-xl border border-hairline bg-white/[0.06] font-medium text-[15px] text-ink transition-colors hover:bg-white/[0.10]"
                  href="#join"
                  onClick={() => setOpen(false)}
                >
                  Start building
                </a>
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}

export function Footer() {
  const cols = [
    {
      title: "Platform",
      items: ["Core", "MetaBrain", "Governance", "Connectors", "Changelog"],
    },
    {
      title: "Solutions",
      items: ["Engineering", "Operations", "Security", "Finance", "Compliance"],
    },
    {
      title: "Resources",
      items: [
        "Documentation",
        "Architecture",
        "API reference",
        "Status",
        "Roadmap",
      ],
    },
    {
      title: "Company",
      items: ["Manifesto", "Customers", "Careers", "Security", "Contact"],
    },
  ];
  return (
    <footer
      className="relative border-hairline border-t bg-canvas"
      role="contentinfo"
    >
      <div className="mx-auto max-w-[1320px] px-6 py-20">
        <div className="mb-16 flex flex-col justify-between gap-12 md:flex-row md:items-start">
          <div className="max-w-sm">
            <Logo size={26} />
            <p className="mt-5 text-[14px] text-body leading-relaxed">
              Sovereign AI infrastructure for teams that orchestrate governed
              intelligence at scale.
            </p>
            <div className="label mt-5 flex items-center gap-2 text-[11px] text-muted">
              <span aria-hidden="true" className="dot dot-success" />
              <span>All systems normal · São Paulo · Frankfurt · Oregon</span>
            </div>
          </div>
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-16"
          >
            {cols.map((c) => (
              <div key={c.title}>
                <div className="label mb-4 text-muted">{c.title}</div>
                <ul className="space-y-2.5">
                  {c.items.map((item) => (
                    <li key={item}>
                      <a
                        className="text-[14px] text-body transition-colors hover:text-ink"
                        href="#"
                      >
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Massive wordmark — decorative */}
        <div aria-hidden="true" className="relative select-none">
          <div className="overflow-hidden">
            <div className="display display-tight grad-text text-[clamp(72px,16vw,260px)] leading-[0.85] tracking-[-0.055em] opacity-[0.85]">
              NEBULOZ
            </div>
          </div>
          <div className="mono absolute right-0 bottom-3 text-right text-[11px] text-muted">
            <div>© 2026 Nebuloz Systems</div>
            <div>Build · 2026.05 · sovereign</div>
          </div>
        </div>

        <div className="mono mt-10 flex flex-wrap items-center justify-between gap-4 border-hairline border-t pt-6 text-[12px] text-muted">
          <div className="flex items-center gap-4">
            <span>SOC 2 · ISO 27001 · LGPD · GDPR</span>
          </div>
          <div className="flex items-center gap-4">
            <a className="whitespace-nowrap hover:text-ink" href="#">
              Privacy
            </a>
            <a className="whitespace-nowrap hover:text-ink" href="#">
              Terms
            </a>
            <a className="whitespace-nowrap hover:text-ink" href="#">
              Sub-processors
            </a>
            <a className="whitespace-nowrap hover:text-ink" href="#">
              DPA
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
