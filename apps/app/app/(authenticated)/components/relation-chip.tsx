"use client";

import { cn } from "@repo/design-system/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calendar, ChevronRight, Link2 } from "lucide-react";
import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Types ──────────────────────────────────────────────────────────────

export type RelationChipTone =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "purple"
  | "accent"
  | "neutral";

export type RelationChipProps = {
  /** Small mono uppercase key, e.g. "ART", "Strategic Theme" */
  eyebrow: string;
  /** Bold primary value, e.g. entity name/id */
  label: string;
  href: string;
  tone?: RelationChipTone;
  icon?: ReactNode;
  className?: string;
};

export type PiRelationItem = {
  id: string;
  label: string;
  href: string;
  tone?: RelationChipTone;
};

export type PiRelationChipProps = {
  pis: PiRelationItem[];
  /** id of the PI shown collapsed/as the accent row in the popover; defaults to pis[0] */
  activeId?: string;
  /** Rendered in the popover header: "Program Increments do {entityName}" */
  entityName?: string;
  className?: string;
};

// ─── Shared bits ────────────────────────────────────────────────────────

const toneFill: Record<RelationChipTone, { bg: string; text: string }> = {
  green: { bg: "rgba(var(--green-rgb),.16)", text: "var(--green-text)" },
  red: { bg: "rgba(var(--red-rgb),.16)", text: "var(--red-text)" },
  amber: { bg: "rgba(var(--amber-rgb),.16)", text: "var(--amber-text)" },
  blue: { bg: "rgba(var(--blue-rgb),.16)", text: "var(--blue-text)" },
  purple: { bg: "rgba(var(--purple-rgb),.16)", text: "var(--purple-text)" },
  accent: { bg: "rgba(var(--accent-rgb),.16)", text: "var(--accent-text)" },
  neutral: { bg: "var(--chip-bg)", text: "var(--ink-faint)" },
};

const toneDot: Record<RelationChipTone, string> = {
  green: "var(--green)",
  red: "var(--red)",
  amber: "var(--amber)",
  blue: "var(--blue)",
  purple: "var(--purple)",
  accent: "var(--accent-c)",
  neutral: "var(--ink-faint)",
};

const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface-2 py-1 pr-2.5 pl-1 text-[11.5px] font-semibold text-ink-muted transition-all duration-150 hover:-translate-y-px hover:border-hairline-strong hover:bg-surface-3 hover:text-ink";

function ChipIcon({ tone, icon }: { tone: RelationChipTone; icon: ReactNode }) {
  const { bg, text } = toneFill[tone];
  const rendered = isValidElement(icon)
    ? cloneElement(icon as ReactElement<{ size?: number; strokeWidth?: number }>, {
        size: 11,
        strokeWidth: 2.2,
      })
    : icon;
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
      style={{ background: bg, color: text }}
    >
      {rendered}
    </span>
  );
}

function ChipLabel({ eyebrow, label }: { eyebrow: string; label: string }) {
  return (
    <span className="flex flex-col items-start leading-tight">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-muted">
        {eyebrow}
      </span>
      {label}
    </span>
  );
}

// ─── RelationChip ───────────────────────────────────────────────────────

/** Pill link that cross-navigates to a related entity (e.g. ART → active PI). */
export function RelationChip({
  eyebrow,
  label,
  href,
  tone = "neutral",
  icon = <Link2 />,
  className,
}: RelationChipProps) {
  return (
    <Link href={href} className={cn(CHIP_CLASS, className)}>
      <ChipIcon tone={tone} icon={icon} />
      <ChipLabel eyebrow={eyebrow} label={label} />
    </Link>
  );
}

// ─── PiRelationChip ─────────────────────────────────────────────────────

/**
 * Relation chip variant for an ART's Program Increments. Renders a plain
 * RelationChip when there is a single PI; when there are several, renders a
 * toggle button that opens a popover listing each PI (dot-coded by tone).
 */
export function PiRelationChip({
  pis,
  activeId,
  entityName,
  className,
}: PiRelationChipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (pis.length === 0) return null;

  if (pis.length === 1) {
    const [pi] = pis;
    return (
      <RelationChip
        eyebrow="PI ativo"
        label={pi.label}
        href={pi.href}
        tone="accent"
        className={className}
      />
    );
  }

  const active = pis.find((pi) => pi.id === activeId) ?? pis[0];

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={CHIP_CLASS}
      >
        <ChipIcon tone="accent" icon={<Calendar />} />
        <ChipLabel
          eyebrow={`PI ativo · ${pis.length} instâncias`}
          label={active.label}
        />
        <ChevronRight
          aria-hidden
          size={11}
          strokeWidth={2.4}
          className="ml-0.5 transition-transform duration-150"
          style={{ transform: open ? "rotate(90deg)" : undefined }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduceMotion ? false : { opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 7 }}
            transition={{ duration: 0.16, ease: [0.2, 0.7, 0.3, 1] }}
            className="absolute left-0 top-[calc(100%+8px)] z-[60] w-[250px] rounded-lg border border-hairline-strong bg-surface-3 p-1.5 shadow-[0_20px_48px_-16px_rgba(0,0,0,.95),0_1px_0_rgba(255,255,255,.07)_inset]"
          >
            <div className="flex items-center gap-1.5 px-2 pt-1 pb-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              <Calendar aria-hidden size={11} />
              {entityName ? `Program Increments do ${entityName}` : "Program Increments"}
            </div>
            {pis.map((pi) => (
              <Link
                key={pi.id}
                href={pi.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors duration-150 hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: toneDot[pi.tone ?? "neutral"] }}
                />
                <span className="font-mono text-[12px] text-ink">{pi.id}</span>
                <span className="ml-auto font-mono text-[9.5px] uppercase text-ink-muted">
                  {pi.label}
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
