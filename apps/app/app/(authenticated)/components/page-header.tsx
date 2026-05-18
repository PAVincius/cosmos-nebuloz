import Link from "next/link";
import { ChevronRightIcon, ChevronLeftIcon } from "lucide-react";
import type { ReactNode, ElementType } from "react";

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
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  badge,
  stats,
  actions,
}: PageHeaderProps) {
  const backHref =
    breadcrumb && breadcrumb.length > 0
      ? breadcrumb[breadcrumb.length - 1].href
      : undefined;

  return (
    <div className="border-b border-border/80 bg-background px-6 py-4 shrink-0">

      {/* ── Breadcrumb ───────────────────────────────────────────────────────── */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Navegação"
          className="mb-2 flex items-center gap-0.5 text-xs text-muted-foreground"
        >
          {backHref && (
            <Link
              href={backHref}
              className="mr-1 flex items-center rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Voltar"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </Link>
          )}

          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && (
                <ChevronRightIcon className="h-3 w-3 text-muted-foreground/40 mx-0.5" />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors rounded px-1 py-0.5 hover:bg-muted"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="px-1 py-0.5 text-foreground/80 font-medium">
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* ── Title + actions ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {badge && (
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {badge}
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {actions}
          </div>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      {stats && stats.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 pt-3 border-t border-border/60">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="flex items-center gap-1.5">
                {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />}
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {stat.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
