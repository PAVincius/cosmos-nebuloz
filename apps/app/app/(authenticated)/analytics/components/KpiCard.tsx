"use client";

import type React from "react";

/**
 * KpiCard — card de métrica tecno-UI para o COSMOS dashboard.
 *
 * REPOUSO: ícone cravado (letterpress / baixo-relevo) no canto inferior direito.
 * HOVER:   ícone acende com glow, textura de bolinhas surge no canto,
 *          linha ECG ("sinal vivo") brilha, card sobe 3px.
 *
 * Toda interação é CSS puro via group-hover — sem estado JS.
 * Requer @keyframes ecg-sweep em globals.css (já adicionado).
 */

type Tone = "green" | "red" | "amber";
type IconName = "activity" | "check" | "clock" | "dollar";

const TONES: Record<
  Tone,
  {
    accent: string;
    rgb: string;
    ink: string;
    bg: string;
    border: string;
    num: string;
    badgeBg: string;
    badgeFg: string;
  }
> = {
  green: {
    accent: "#34d399",
    rgb: "52,211,153",
    ink: "#0a111c",
    bg: "radial-gradient(130% 130% at 0% 0%, rgba(52,211,153,.12), transparent 46%), linear-gradient(180deg,#0e1826,#0a111c)",
    border: "rgba(52,211,153,.20)",
    num: "#34d399",
    badgeBg: "rgba(52,211,153,.12)",
    badgeFg: "#7ff0bf",
  },
  red: {
    accent: "#fb7185",
    rgb: "251,113,133",
    ink: "#170c12",
    bg: "radial-gradient(130% 150% at 100% 25%, rgba(244,63,94,.30), transparent 55%), linear-gradient(180deg,#22121a,#160c12)",
    border: "rgba(244,63,94,.32)",
    num: "#fda4af",
    badgeBg: "rgba(244,63,94,.16)",
    badgeFg: "#fda4af",
  },
  amber: {
    accent: "#fbbf24",
    rgb: "251,191,36",
    ink: "#120f0a",
    bg: "radial-gradient(130% 130% at 0% 0%, rgba(245,158,11,.13), transparent 48%), linear-gradient(180deg,#1a1610,#120f0a)",
    border: "rgba(245,158,11,.22)",
    num: "#fcd34d",
    badgeBg: "rgba(245,158,11,.14)",
    badgeFg: "#fcd34d",
  },
};

function IconPaths({ name }: { name: IconName }) {
  switch (name) {
    case "activity":
      return <path d="M22 12h-4l-3 9L9 3l-3 9H2" />;
    case "check":
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3.2 2" />
        </>
      );
    case "dollar":
      return (
        <>
          <line x1="12" x2="12" y1="2.4" y2="21.6" />
          <path d="M16.5 6H9.75a3.25 3.25 0 0 0 0 6.5h4.5a3.25 3.25 0 0 1 0 6.5H7" />
        </>
      );
  }
}

export type KpiCardProps = {
  icon: IconName;
  tone?: Tone;
  label: string;
  value: string;
  unit?: string;
  badge: React.ReactNode;
  className?: string;
};

export default function KpiCard({
  icon,
  tone = "green",
  label,
  value,
  unit,
  badge,
  className,
}: KpiCardProps) {
  const t = TONES[tone];

  const vars = {
    "--accent": t.accent,
    "--rgb": t.rgb,
    "--ink": t.ink,
    background: t.bg,
    borderColor: t.border,
  } as React.CSSProperties;

  return (
    <div
      className={[
        "group relative box-border flex min-h-[152px] w-[312px] flex-col items-start overflow-hidden rounded-[18px] border p-5",
        "font-[var(--font-manrope)]",
        "transition-[transform,border-color,box-shadow] duration-[400ms] ease-out",
        "hover:-translate-y-[3px] hover:border-[rgba(var(--rgb),0.55)] hover:shadow-[0_20px_44px_-22px_rgba(var(--rgb),0.55)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={vars}
    >
      {/* textura de bolinhas — concentrada no canto inferior direito no hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-[550ms] ease-out [-webkit-mask-image:radial-gradient(150%_130%_at_100%_100%,#000_0%,transparent_58%)] [background-image:radial-gradient(currentColor_1.1px,transparent_1.5px)] [background-size:11px_11px] [color:var(--accent)] [mask-image:radial-gradient(150%_130%_at_100%_100%,#000_0%,transparent_58%)] group-hover:opacity-[0.45]"
      />

      {/* marca-d'água CRAVADA (repouso) — traço na cor da superfície + bevel */}
      <svg
        aria-hidden
        className="-bottom-12 -right-9 pointer-events-none absolute z-[1] h-52 w-52 opacity-100 transition-opacity duration-500 ease-out [filter:drop-shadow(0_1.5px_0.5px_rgba(255,255,255,0.11))_drop-shadow(0_-1.4px_1px_rgba(0,0,0,0.8))] [stroke:var(--ink)] group-hover:opacity-20"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.15}
        viewBox="0 0 24 24"
      >
        <IconPaths name={icon} />
      </svg>

      {/* marca-d'água com GLOW (hover) */}
      <svg
        aria-hidden
        className="-bottom-12 -right-9 pointer-events-none absolute z-[1] h-52 w-52 opacity-0 transition-opacity duration-500 ease-out [color:var(--accent)] [filter:drop-shadow(0_0_9px_rgba(var(--rgb),0.85))] group-hover:opacity-90"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.15}
        viewBox="0 0 24 24"
      >
        <IconPaths name={icon} />
      </svg>

      {/* sinal vivo (ECG) na base */}
      <svg
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-1.5 left-0 z-[1] h-[46px] w-full opacity-30 transition-[opacity,filter] duration-500 ease-out group-hover:opacity-100 group-hover:[filter:drop-shadow(0_0_5px_rgba(var(--rgb),0.6))]"
        preserveAspectRatio="none"
        viewBox="0 0 312 46"
      >
        <defs>
          <linearGradient
            id={`sig-${tone}-${icon}`}
            x1="0"
            x2="312"
            y1="0"
            y2="0"
          >
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset=".5" stopColor="var(--accent)" stopOpacity=".9" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="[stroke-dasharray:360_360] motion-safe:animate-[ecg-sweep_3s_linear_infinite]"
          d="M-30 26 H66 l7 -17 l9 32 l8 -24 l6 11 H180 l7 -14 l8 24 l7 -13 H430"
          fill="none"
          stroke={`url(#sig-${tone}-${icon})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
        />
      </svg>

      {/* cabeçalho: label + chip do ícone */}
      <div className="relative z-[3] flex w-full items-start justify-between">
        <span className="max-w-[78%] font-semibold text-[#93a1b3] text-[13.5px] leading-[1.3] tracking-[0.005em]">
          {label}
        </span>
        <span
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border"
          style={{
            color: t.accent,
            background: `rgba(${t.rgb},0.10)`,
            borderColor: `rgba(${t.rgb},0.22)`,
          }}
        >
          <svg
            className="h-[17px] w-[17px]"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <IconPaths name={icon} />
          </svg>
        </span>
      </div>

      {/* valor (fonte mono para dados numéricos) */}
      <div
        className="relative z-[3] my-3 whitespace-nowrap font-[var(--font-jetbrains-mono)] font-bold text-[38px] leading-none tracking-[-0.01em]"
        style={{ color: t.num }}
      >
        {value}
        {unit && (
          <span className="ml-[7px] font-semibold text-[24px] opacity-80">
            {unit}
          </span>
        )}
      </div>

      {/* badge de estado */}
      <span
        className="relative z-[3] inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-[11px] py-1 font-bold text-[12px] tracking-[0.01em]"
        style={{
          background: t.badgeBg,
          color: t.badgeFg,
          borderColor: `rgba(${t.rgb},0.18)`,
        }}
      >
        {badge}
      </span>
    </div>
  );
}
