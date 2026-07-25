import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type StatItem = {
  label: string;
  value: ReactNode;
  icon?: ElementType;
};

export type PageHeaderProps = {
  /** Hierarchical nav: [{label:"Portfolio",href:"/portfolio"}, {label:"Temas"}] */
  breadcrumb?: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  /** Badges rendered before the title */
  badge?: ReactNode;
  /** Key entity metrics shown below title */
  stats?: StatItem[];
  /** Action buttons (top-right) */
  actions?: ReactNode;
  /** Accent color rgb for the under-glow, e.g. "124,135,255". Defaults to accent. */
  accentRgb?: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  badge,
  stats,
  actions,
  accentRgb = "124,135,255",
}: PageHeaderProps) {
  const backHref =
    breadcrumb && breadcrumb.length > 0 ? breadcrumb.at(-1)?.href : undefined;

  return (
    <div
      className="shrink-0"
      style={{
        position: "relative",
        padding: "22px 32px 20px",
        background:
          "linear-gradient(180deg, var(--surface-3) 0%, var(--surface-2) 45%, var(--surface) 100%)",
        borderBottom: "1px solid var(--hairline)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,.08) inset, 0 18px 34px -20px rgba(0,0,0,.95), 0 3px 0 -1px rgba(0,0,0,.5)",
        zIndex: 5,
      }}
    >
      {/* Top hairline highlight — pseudo-before equivalent */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 8%, rgba(255,255,255,.14), transparent 92%)",
          pointerEvents: "none",
        }}
      />
      {/* Accent under-glow — pseudo-after equivalent */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -1,
          height: 48,
          background: `radial-gradient(120% 100% at 18% 0%, rgba(${accentRgb},.14), transparent 60%)`,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
      {/* ── Breadcrumb ───────────────────────────────────────────────────────── */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Navegação"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            marginBottom: 8,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          {backHref && (
            <Link
              aria-label="Voltar"
              href={backHref}
              style={{
                marginRight: 4,
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
                padding: 2,
                color: "var(--ink-faint)",
                transition: "color .15s",
              }}
            >
              <ChevronLeftIcon style={{ width: 13, height: 13 }} />
            </Link>
          )}

          {breadcrumb.map((item, i) => (
            <span
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 2 }}
            >
              {i > 0 && (
                <ChevronRightIcon
                  style={{
                    width: 11,
                    height: 11,
                    opacity: 0.4,
                    margin: "0 2px",
                  }}
                />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  style={{
                    borderRadius: 4,
                    padding: "2px 4px",
                    color: "var(--ink-subtle)",
                    transition: "color .15s",
                  }}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  style={{
                    padding: "2px 4px",
                    fontWeight: 700,
                    color: "var(--ink-muted)",
                  }}
                >
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* ── Title + actions ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {badge && (
            <div style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {badge}
            </div>
          )}
          <h1
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "var(--ink)",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                marginTop: 8,
                fontSize: 13.5,
                color: "var(--ink-muted)",
                maxWidth: 680,
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div style={{ marginTop: 2, display: "flex", flexShrink: 0, alignItems: "center", gap: 8 }}>
            {actions}
          </div>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      {stats && stats.length > 0 && (
        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0 26px",
          }}
        >
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", gap: 3 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                  }}
                >
                  {Icon && <Icon style={{ width: 12, height: 12 }} />}
                  {stat.label}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    color: "var(--ink)",
                  }}
                >
                  {stat.value}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
