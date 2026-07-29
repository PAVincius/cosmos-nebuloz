import { cn } from "@repo/design-system/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

type CosmosButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const sizeMap: Record<Size, string> = {
  sm: "px-3 py-[5px] text-[12.5px] rounded-sm",
  md: "px-[14px] py-2 text-sm rounded-md",
  lg: "px-[18px] py-[11px] text-[14.5px] rounded-md",
};

// Accent-based variants use inline style (--accent conflicts with shadcn surface-3)
const variantClass: Record<Variant, string> = {
  primary: "border",
  secondary: "bg-surface text-ink border-hairline-strong hover:bg-surface-2",
  ghost:
    "bg-transparent text-ink-muted border-transparent hover:bg-surface-2 hover:text-ink",
  soft: "text-accent-text border",
  danger: "text-red-text border",
};

const variantStyle: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--accent-c)",
    // Not white: on the cyan brand accent that is 1.77:1. --on-accent is the
    // per-theme foreground app/styles.css already defines for solid accent
    // fills (canvas on dark, white on light).
    color: "var(--on-accent, #fff)",
    borderColor: "var(--accent-c)",
    boxShadow:
      "0 1px 2px rgba(var(--accent-rgb),.4), 0 4px 12px -6px rgba(var(--accent-rgb),.5)",
  },
  secondary: {},
  ghost: {},
  soft: {
    background: "var(--accent-soft)",
    borderColor: "rgba(var(--accent-rgb),.2)",
  },
  danger: {
    background: "var(--red-soft)",
    borderColor: "rgba(var(--red-rgb),.2)",
  },
};

export function CosmosButton({
  variant = "secondary",
  size = "md",
  className,
  style,
  children,
  ...props
}: CosmosButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 border font-semibold",
        "transition-all duration-200",
        sizeMap[size],
        variantClass[variant],
        className
      )}
      style={{ ...variantStyle[variant], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
