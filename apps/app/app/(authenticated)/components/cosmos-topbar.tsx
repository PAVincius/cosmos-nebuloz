"use client";

import { cn } from "@repo/design-system/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Search } from "lucide-react";
import type { ReactNode } from "react";

/** One entry in the persona switcher pill (e.g. LPM, RTE, PO, SM). */
export interface CosmosPersona {
  /** short key rendered in the pill and passed back on change, e.g. "RTE" */
  key: string;
  /** full role name shown as the button's tooltip, e.g. "Release Train Engineer" */
  full: string;
}

export interface CosmosTopbarProps {
  /** hierarchical breadcrumb labels (workspace -> section -> page); last item is the current page */
  breadcrumb: string[];
  /** key of the currently active persona */
  persona: string;
  /** available personas rendered in the switcher pill, in order */
  personas: CosmosPersona[];
  /** called with a persona key when the user picks a different one */
  onPersonaChange: (persona: string) => void;
  /** optional replacement for the default search trigger button (e.g. the ⌘K search) */
  searchSlot?: ReactNode;
  /** optional replacement for the default avatar (e.g. a real user menu) */
  avatarSlot?: ReactNode;
}

const revealVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.0, 0.0, 0.2, 1] as const },
  },
};

/**
 * Cosmos app topbar: brand mark, breadcrumb trail, persona switcher, search
 * trigger and avatar. Reproduces the prototype's `.topbar` header exactly
 * (56px tall, gradient surface, accent hairline glow at the bottom edge).
 */
export function CosmosTopbar({
  breadcrumb,
  persona,
  personas,
  onPersonaChange,
  searchSlot,
  avatarSlot,
}: CosmosTopbarProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.header
      initial={prefersReducedMotion ? undefined : "hidden"}
      animate={prefersReducedMotion ? undefined : "visible"}
      variants={prefersReducedMotion ? undefined : revealVariants}
      className="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--hairline)] py-0 pr-4 pl-[18px]"
      style={{
        background:
          "linear-gradient(180deg, var(--surface-3) 0%, var(--surface) 70%, var(--surface) 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,.07) inset, 0 14px 30px -16px rgba(0,0,0,.9), 0 2px 0 rgba(0,0,0,.4)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(var(--accent-rgb), .25), transparent)",
        }}
      />

      {/* brand */}
      <div className="flex shrink-0 items-center gap-[9px]">
        <div
          className="grid h-[27px] w-[27px] place-items-center rounded-[7px] text-[13px] font-bold text-white"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            background: "linear-gradient(160deg, var(--accent-c), #5a64d8)",
            boxShadow:
              "0 2px 8px -2px rgba(var(--accent-rgb), .7), 0 1px 0 rgba(255,255,255,.3) inset",
          }}
        >
          C
        </div>
        <span
          className="text-[15px] font-bold tracking-[-0.01em] text-[var(--ink)]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          COSMOS
          <span
            className="ml-[5px] align-super text-[9px] text-[var(--ink-muted)]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            SAFe
          </span>
        </span>
      </div>

      <ChevronRight
        aria-hidden
        size={13}
        strokeWidth={2.4}
        className="mx-0.5 shrink-0 text-[var(--ink-faint)]"
      />

      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0.5 overflow-hidden">
        {breadcrumb.map((label, index) => {
          const isCurrent = index === breadcrumb.length - 1;
          return (
            <span key={`${label}-${index}`} className="flex items-center gap-0.5">
              <span
                className={cn(
                  "cursor-pointer rounded-[8px] px-[9px] py-1 text-[12.5px] whitespace-nowrap transition-colors duration-150",
                  "hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
                  isCurrent
                    ? "font-semibold text-[var(--ink)]"
                    : "font-medium text-[var(--ink-muted)]"
                )}
              >
                {label}
              </span>
              {!isCurrent && (
                <ChevronRight
                  aria-hidden
                  size={13}
                  strokeWidth={2.4}
                  className="shrink-0 text-[var(--ink-faint)]"
                />
              )}
            </span>
          );
        })}
      </nav>

      {/* right cluster */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div
          role="group"
          aria-label="Trocar persona"
          title="Persona — a visão se adapta ao papel"
          className="flex items-center gap-0.5 rounded-[10px] border border-[var(--hairline)] p-[3px]"
          style={{
            background: "var(--canvas)",
            boxShadow: "0 2px 6px -2px rgba(0,0,0,.6) inset",
          }}
        >
          {personas.map((p) => {
            const active = p.key === persona;
            return (
              <button
                key={p.key}
                type="button"
                title={p.full}
                aria-pressed={active}
                onClick={() => onPersonaChange(p.key)}
                className={cn(
                  "flex items-center gap-[5px] rounded-[7px] px-[9px] py-1 text-[11.5px] font-semibold transition-all duration-150",
                  active
                    ? "text-[var(--accent-text)] shadow-[0_1px_0_rgba(255,255,255,.08)_inset,0_4px_10px_-4px_rgba(0,0,0,.7)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                )}
                style={
                  active
                    ? { background: "linear-gradient(180deg, var(--surface-3), var(--surface-2))" }
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="h-[6px] w-[6px] rounded-full"
                  style={{
                    background: "currentColor",
                    opacity: active ? 1 : 0.55,
                    boxShadow: active ? "0 0 6px currentColor" : undefined,
                  }}
                />
                {p.key}
              </button>
            );
          })}
        </div>

        {searchSlot ?? (
          <button
            type="button"
            aria-label="Buscar"
            className="grid h-8 w-8 place-items-center rounded-[8px] border border-[var(--hairline)] bg-[var(--surface-2)] text-[var(--ink-muted)] transition-all duration-150 hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)]"
          >
            <Search size={15} />
          </button>
        )}

        {avatarSlot ?? (
          <div
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: "var(--accent-soft)",
              color: "var(--accent-text)",
              border: "1px solid rgba(var(--accent-rgb), .3)",
            }}
          >
            MA
          </div>
        )}
      </div>
    </motion.header>
  );
}
