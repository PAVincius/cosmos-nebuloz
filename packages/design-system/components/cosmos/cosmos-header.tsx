"use client";

import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

type Tone = "accent" | "green" | "red" | "amber" | "blue" | "purple";

// Radial gradient origins mirror kpi-card — header crops to its height via overflow:hidden
const gradientLight: Record<Tone, string> = {
  accent: "radial-gradient(180% 440% at -5% -10%, rgba(94,106,210,.11) 0%, transparent 52%)",
  green:  "radial-gradient(180% 440% at -5% -10%, rgba(22,163,74,.10)  0%, transparent 52%)",
  red:    "radial-gradient(180% 440% at 108% -5%, rgba(225,29,72,.14)  0%, transparent 52%)",
  amber:  "radial-gradient(180% 440% at -5% -10%, rgba(217,119,6,.12)  0%, transparent 52%)",
  blue:   "radial-gradient(180% 440% at -5% -10%, rgba(37,99,235,.11)  0%, transparent 52%)",
  purple: "radial-gradient(180% 440% at -5% -10%, rgba(124,58,237,.11) 0%, transparent 52%)",
};

const gradientDark: Record<Tone, string> = {
  accent: "radial-gradient(180% 440% at -5% -10%, rgba(124,135,255,.20) 0%, transparent 52%)",
  green:  "radial-gradient(180% 440% at -5% -10%, rgba(52,211,153,.16)  0%, transparent 52%)",
  red:    "radial-gradient(180% 440% at 108% -5%, rgba(244,63,94,.26)   0%, transparent 52%)",
  amber:  "radial-gradient(180% 440% at -5% -10%, rgba(245,158,11,.18)  0%, transparent 52%)",
  blue:   "radial-gradient(180% 440% at -5% -10%, rgba(96,165,250,.18)  0%, transparent 52%)",
  purple: "radial-gradient(180% 440% at -5% -10%, rgba(167,139,250,.18) 0%, transparent 52%)",
};

const toneVar = (t: Tone) => (t === "accent" ? "var(--accent-c)" : `var(--${t})`);
const toneRgbVar = (t: Tone) => (t === "accent" ? "var(--accent-rgb)" : `var(--${t}-rgb)`);
const toneSoftVar = (t: Tone) => (t === "accent" ? "var(--accent-soft)" : `var(--${t}-soft)`);

export type CosmosHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /** Right-side slot: close button, actions, badge, etc. */
  action?: ReactNode;
  /** Bottom hairline separator between header and content */
  bordered?: boolean;
  className?: string;
};

export function CosmosHeader({
  title,
  description,
  tone = "accent",
  icon,
  action,
  bordered = true,
  className,
}: CosmosHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        bordered && "border-b border-hairline",
        className
      )}
      style={
        {
          "--tone": toneVar(tone),
          "--tone-rgb": toneRgbVar(tone),
        } as React.CSSProperties
      }
    >
      {/* ── Gradient bleed — light */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{ background: gradientLight[tone] }}
      />
      {/* ── Gradient bleed — dark */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ background: gradientDark[tone] }}
      />
      {/* ── Top accent bar */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(var(--tone-rgb), .52) 40%, transparent)",
        }}
      />

      {/* ── Content row */}
      <div className="relative flex items-start gap-3 px-6 pt-5 pb-4">
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold text-[15px] leading-snug"
            style={{ color: "var(--ink)" }}
          >
            {title}
          </div>
          {description && (
            <div
              className="mt-[3px] text-[13px] leading-snug"
              style={{ color: "var(--ink-muted)" }}
            >
              {description}
            </div>
          )}
        </div>

        {icon && (
          <span
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border text-[16px]"
            style={{
              borderColor: `rgba(var(--tone-rgb), .22)`,
              background: toneSoftVar(tone),
              color: "var(--tone)",
            }}
          >
            {icon}
          </span>
        )}

        {action}
      </div>
    </div>
  );
}
