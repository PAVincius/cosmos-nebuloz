import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

type Tone =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "purple"
  | "accent"
  | "neutral";

type BadgeProps = {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

const toneMap: Record<Tone, { bg: string; text: string; border: string }> = {
  green: {
    bg: "var(--green-soft)",
    text: "var(--green-text)",
    border: "rgba(var(--green-rgb),.22)",
  },
  red: {
    bg: "var(--red-soft)",
    text: "var(--red-text)",
    border: "rgba(var(--red-rgb),.22)",
  },
  amber: {
    bg: "var(--amber-soft)",
    text: "var(--amber-text)",
    border: "rgba(var(--amber-rgb),.22)",
  },
  blue: {
    bg: "var(--blue-soft)",
    text: "var(--blue-text)",
    border: "rgba(var(--blue-rgb),.22)",
  },
  purple: {
    bg: "var(--purple-soft)",
    text: "var(--purple-text)",
    border: "rgba(var(--purple-rgb),.22)",
  },
  accent: {
    bg: "var(--accent-soft)",
    text: "var(--accent-text)",
    border: "rgba(var(--accent-rgb),.22)",
  },
  neutral: {
    bg: "var(--chip-bg)",
    text: "var(--ink-muted)",
    border: "var(--hairline)",
  },
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: BadgeProps) {
  const { bg, text, border } = toneMap[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill",
        "px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em]",
        className
      )}
      style={{ background: bg, color: text, border: `1px solid ${border}` }}
    >
      {!!dot && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}
