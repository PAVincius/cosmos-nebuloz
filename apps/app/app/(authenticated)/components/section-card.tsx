import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SectionCardProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Optional accent color rgb (e.g. "124,135,255") for the icon chip */
  accentRgb?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Skip the 16px body padding (for tables/full-bleed content) */
  noPadding?: boolean;
};

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  accentRgb,
  actions,
  children,
  noPadding = false,
}: SectionCardProps) {
  const iconColor = accentRgb
    ? `rgb(${accentRgb})`
    : "var(--accent)";
  const iconBorder = accentRgb
    ? `rgba(${accentRgb},.3)`
    : "var(--hairline-strong)";
  const iconBg = accentRgb
    ? `linear-gradient(180deg, rgba(${accentRgb},.18), rgba(${accentRgb},.08))`
    : "linear-gradient(180deg, var(--surface-4), var(--surface-3))";

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: 14,
        background: "var(--surface)",
        overflow: "hidden",
        boxShadow:
          "0 1px 0 rgba(255,255,255,.03) inset, 0 12px 28px -22px rgba(0,0,0,.9)",
      }}
    >
      {/* ── Card head — depth header language ─────────────────────────── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "12px 16px",
          background:
            "linear-gradient(180deg, var(--surface-3) 0%, var(--surface-2) 100%)",
          borderBottom: "1px solid var(--hairline)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,.06) inset, 0 8px 16px -12px rgba(0,0,0,.8)",
        }}
      >
        {/* Top hairline highlight */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent)",
            pointerEvents: "none",
          }}
        />

        {Icon && (
          <div
            style={{
              display: "grid",
              placeItems: "center",
              width: 30,
              height: 30,
              borderRadius: 8,
              flexShrink: 0,
              background: iconBg,
              color: iconColor,
              border: `1px solid ${iconBorder}`,
              boxShadow:
                "0 1px 0 rgba(255,255,255,.08) inset, 0 3px 8px -3px rgba(0,0,0,.8)",
            }}
          >
            <Icon size={15} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-subtle)",
                marginTop: 1,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {actions && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {actions}
          </div>
        )}
      </div>

      {/* ── Card body ─────────────────────────────────────────────────── */}
      {noPadding ? children : <div style={{ padding: 16 }}>{children}</div>}
    </div>
  );
}
