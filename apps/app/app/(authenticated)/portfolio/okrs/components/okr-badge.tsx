import type { ReactNode } from "react";
import type { OKRTone } from "./okr-constants";

type OkrBadgeTone = OKRTone | "neutral";

const TONE_STYLE: Record<
  OkrBadgeTone,
  { bg: string; text: string; border: string }
> = {
  green: {
    bg: "var(--green-soft)",
    text: "var(--green-text)",
    border: "rgba(var(--green-rgb),.25)",
  },
  red: {
    bg: "var(--red-soft)",
    text: "var(--red-text)",
    border: "rgba(var(--red-rgb),.25)",
  },
  amber: {
    bg: "var(--amber-soft)",
    text: "var(--amber-text)",
    border: "rgba(var(--amber-rgb),.25)",
  },
  blue: {
    bg: "var(--blue-soft)",
    text: "var(--blue-text)",
    border: "rgba(var(--blue-rgb),.25)",
  },
  purple: {
    bg: "var(--purple-soft)",
    text: "var(--purple-text)",
    border: "rgba(var(--purple-rgb),.25)",
  },
  accent: {
    bg: "var(--accent-soft)",
    text: "var(--accent-text)",
    border: "rgba(var(--accent-rgb),.25)",
  },
  neutral: {
    bg: "var(--surface-3)",
    text: "var(--ink-subtle)",
    border: "var(--hairline)",
  },
};

type OkrBadgeProps = {
  tone?: OkrBadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Cosmos-kit style pill badge (tone-soft bg + tone-text color), scoped to the OKRs screen. */
export function OkrBadge({
  tone = "neutral",
  dot,
  icon,
  children,
  className,
}: OkrBadgeProps) {
  const t = TONE_STYLE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold text-[11.5px] leading-none ${className ?? ""}`}
      style={{
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.border}`,
      }}
    >
      {dot ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: t.text }}
        />
      ) : null}
      {icon}
      {children}
    </span>
  );
}
