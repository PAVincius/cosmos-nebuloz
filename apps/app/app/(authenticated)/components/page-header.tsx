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
    breadcrumb && breadcrumb.length > 0 ? breadcrumb.at(-1)?.href : undefined;

  return (
    <div className="shrink-0 border-border/80 border-b bg-background px-6 py-4">
      {/* ── Breadcrumb ───────────────────────────────────────────────────────── */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Navegação"
          className="mb-2 flex items-center gap-0.5 text-muted-foreground text-xs"
        >
          {backHref && (
            <Link
              aria-label="Voltar"
              className="mr-1 flex items-center rounded p-0.5 transition-colors hover:bg-muted hover:text-foreground"
              href={backHref}
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </Link>
          )}

          {breadcrumb.map((item, i) => (
            <span className="flex items-center gap-0.5" key={i}>
              {i > 0 && (
                <ChevronRightIcon className="mx-0.5 h-3 w-3 text-muted-foreground/40" />
              )}
              {item.href ? (
                <Link
                  className="rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ) : (
                <span className="px-1 py-0.5 font-medium text-foreground/80">
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* ── Title + actions ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {badge && (
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {badge}
            </div>
          )}
          <h1 className="font-bold text-2xl text-foreground leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-muted-foreground text-sm leading-snug">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="mt-0.5 flex shrink-0 items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      {stats && stats.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-border/60 border-t pt-3">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div className="flex items-center gap-1.5" key={i}>
                {Icon && (
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                )}
                <span className="text-muted-foreground text-xs">
                  {stat.label}
                </span>
                <span className="font-semibold text-foreground text-xs tabular-nums">
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
