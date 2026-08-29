"use client";

import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";
import { useState } from "react";

type Tone = "accent" | "green" | "red" | "amber" | "blue" | "purple";

const kpiBg: Record<Tone, string> = {
  accent:
    "radial-gradient(130% 130% at 0% 0%, rgba(124,135,255,.13), transparent 46%), linear-gradient(180deg,#0d1222,#090e1a)",
  green:
    "radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.12), transparent 46%), linear-gradient(180deg,#0e1826,#0a111c)",
  red: "radial-gradient(130% 150% at 100% 25%, rgba(244,63,94,.30), transparent 55%), linear-gradient(180deg,#22121a,#160c12)",
  amber:
    "radial-gradient(130% 130% at 0% 0%, rgba(245,158,11,.13), transparent 48%), linear-gradient(180deg,#1a1610,#120f0a)",
  blue: "radial-gradient(130% 130% at 0% 0%, rgba(96,165,250,.13), transparent 46%), linear-gradient(180deg,#0a1422,#060b14)",
  purple:
    "radial-gradient(130% 130% at 0% 0%, rgba(167,139,250,.13), transparent 46%), linear-gradient(180deg,#110d1f,#0c0915)",
};

// Light mode: visible tone tint — enough personality, not overpowering
const kpiBgLight: Record<Tone, string> = {
  accent:
    "radial-gradient(140% 130% at 0% 0%, rgba(94,106,210,.13), transparent 52%)",
  green:
    "radial-gradient(140% 130% at 0% 0%, rgba(22,163,74,.12), transparent 52%)",
  red: "radial-gradient(140% 150% at 100% 25%, rgba(225,29,72,.16), transparent 56%)",
  amber:
    "radial-gradient(140% 130% at 0% 0%, rgba(217,119,6,.14), transparent 52%)",
  blue: "radial-gradient(140% 130% at 0% 0%, rgba(37,99,235,.13), transparent 52%)",
  purple:
    "radial-gradient(140% 130% at 0% 0%, rgba(124,58,237,.13), transparent 52%)",
};

const inkCorner: Record<Tone, string> = {
  accent: "#080c18",
  green: "#0a111c",
  red: "#170c12",
  amber: "#120f0a",
  blue: "#060b18",
  purple: "#0c0915",
};

// --accent is shadcn-reserved (surface-3), so accent tone uses --accent-c
const toneMainVar = (t: Tone) =>
  t === "accent" ? "var(--accent-c)" : `var(--${t})`;

type KpiCardProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  iconPath?: string;
  className?: string;
};

export function KpiCard({
  label,
  value,
  unit,
  delta,
  hint,
  tone = "accent",
  icon,
  iconPath,
  className,
}: KpiCardProps) {
  const [hovered, setHovered] = useState(false);
  const deltaPos = delta?.positive ?? false;

  const shadowRest = "var(--card-shadow)";
  const shadowHover =
    "0 0 0 2px rgba(var(--tone-rgb),.45), 0 8px 40px -4px rgba(var(--tone-rgb),.50), 0 20px 60px -12px rgba(var(--tone-rgb),.25)";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover for visual animation only
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: hover for visual animation only
    <div
      className={cn(
        "group relative flex min-h-[152px] w-full flex-col overflow-hidden",
        "rounded-[18px] border p-[20px_22px]",
        "border-hairline bg-card",
        "dark:bg-transparent",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={
        {
          "--tone": toneMainVar(tone),
          "--tone-rgb": `var(--${tone}-rgb)`,
          "--tone-text": `var(--${tone}-text)`,
          "--ink-corner": inkCorner[tone],
          borderColor: `rgba(var(--${tone}-rgb),.20)`,
          boxShadow: hovered ? shadowHover : shadowRest,
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          transition:
            "transform 480ms cubic-bezier(0.2,0.8,0.3,1), box-shadow 400ms cubic-bezier(0.25,0.46,0.45,0.94), border-color 300ms ease",
        } as React.CSSProperties
      }
    >
      {/* ── z-0  Background gradient — light mode */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-[18px] dark:hidden"
        style={{ background: kpiBgLight[tone] }}
      />

      {/* ── z-0  Background gradient — dark mode */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 hidden rounded-[18px] dark:block"
        style={{ background: kpiBg[tone] }}
      />

      {/* ── z-1  Dot texture — dark mode only (too heavy for light) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] hidden opacity-0 transition-opacity duration-[550ms] ease-out group-hover:opacity-[.45] dark:block"
        style={{
          color: "var(--tone)",
          backgroundImage:
            "radial-gradient(currentColor 1.1px, transparent 1.5px)",
          backgroundSize: "11px 11px",
          WebkitMaskImage:
            "radial-gradient(150% 130% at 100% 100%, #000 0%, transparent 58%)",
          maskImage:
            "radial-gradient(150% 130% at 100% 100%, #000 0%, transparent 58%)",
        }}
      />

      {/* ── z-1  Watermark bleed */}
      {!!iconPath && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-36px] bottom-[-48px] z-[1]"
          style={{ width: 208, height: 208 }}
        >
          {/* Light mode: subtle tone-colored outline */}
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative watermark, aria-hidden on parent */}
          <svg
            aria-hidden
            className="absolute inset-0 opacity-[0.12] transition-opacity duration-[500ms] ease-out group-hover:opacity-[0.22] dark:hidden"
            fill="none"
            height="208"
            strokeWidth="1.15"
            style={{ stroke: "var(--tone)" }}
            viewBox="0 0 24 24"
            width="208"
          >
            <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Dark mode: engrave */}
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative watermark, aria-hidden on parent */}
          <svg
            aria-hidden
            className="absolute inset-0 hidden opacity-100 transition-opacity duration-[500ms] ease-out group-hover:opacity-20 dark:block"
            fill="none"
            height="208"
            strokeWidth="1.15"
            style={{
              stroke: "var(--ink-corner)",
              filter:
                "drop-shadow(0 1.5px .5px rgba(255,255,255,.11)) drop-shadow(0 -1.4px 1px rgba(0,0,0,.8))",
            }}
            viewBox="0 0 24 24"
            width="208"
          >
            <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* Dark mode: glow on hover */}
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative watermark, aria-hidden on parent */}
          <svg
            aria-hidden
            className="absolute inset-0 hidden opacity-0 transition-opacity duration-[500ms] ease-out group-hover:opacity-90 dark:block"
            fill="none"
            height="208"
            strokeWidth="1.15"
            style={{
              stroke: "var(--tone)",
              filter: "drop-shadow(0 0 9px rgba(var(--tone-rgb),.85))",
            }}
            viewBox="0 0 24 24"
            width="208"
          >
            <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* ── z-3  Content */}
      <div className="relative z-[3] flex w-full items-start justify-between">
        <span className="max-w-[78%] font-semibold text-[13.5px] text-muted-foreground leading-tight dark:text-ink-muted">
          {label}
        </span>
        {!!icon && (
          <span
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border text-[16px]"
            style={{
              borderColor: `rgba(var(--${tone}-rgb),.22)`,
              background: `var(--${tone}-soft)`,
              color: "var(--tone)",
            }}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Value — unified span, tone-text covers both modes via CSS variables */}
      <div className="relative z-[3] mt-auto mb-3 whitespace-nowrap pt-3.5 font-bold font-mono text-[38px] leading-none tracking-[-0.02em]">
        <span style={{ color: "var(--tone-text)" }}>{value}</span>
        {!!unit && (
          <span className="ml-1.5 font-semibold text-[24px] opacity-80">
            {unit}
          </span>
        )}
      </div>

      {/* Delta / hint */}
      {!!(delta ?? hint) && (
        <div className="relative z-[3] flex items-center gap-2">
          {!!delta && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-[11px] py-[4px] font-bold text-[12px] tracking-[0.01em]"
              style={{
                background: deltaPos ? "var(--green-soft)" : "var(--red-soft)",
                color: deltaPos ? "var(--green-text)" : "var(--red-text)",
              }}
            >
              {deltaPos ? "↑" : "↓"} {delta.value}
            </span>
          )}
          {!!hint && (
            <span className="text-[12px] text-muted-foreground dark:text-ink-muted">
              {hint}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
