"use client";

import { Logo } from "./logo";
import type { FooterCopy } from "./types";

type ReadinessFooterProps = {
  copy: FooterCopy;
  logoLabel: string;
};

export function ReadinessFooter({ copy, logoLabel }: ReadinessFooterProps) {
  return (
    <footer className="relative border-hairline border-t py-14">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <Logo label={logoLabel} />
            <p className="mt-4 max-w-[300px] text-[13px] text-muted leading-[1.6]">
              {copy.tagline}
            </p>
          </div>
          <nav
            aria-label={copy.nav}
            className="flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-body"
          >
            {copy.links.map((link) => (
              <a
                className="inline-flex min-h-11 items-center transition-colors hover:text-ink"
                href={link.href}
                key={link.label}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mono mt-10 flex flex-wrap items-center justify-between gap-4 border-hairline border-t pt-6 text-[11px] text-faint">
          <span>{copy.copyright}</span>
          <span>{copy.products}</span>
        </div>
      </div>
    </footer>
  );
}
