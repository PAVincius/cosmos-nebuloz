/**
 * Classes Tailwind alinhadas a DESIGN.app.md — telas piloto da app autenticada.
 */
export const appDesign = {
  shell: "flex w-full min-w-0 flex-col",
  pageHeader: "border-b border-border/80 px-6 py-5",
  pageTitle: "text-[1.625rem] font-bold tracking-[-0.025em] text-foreground",
  pageSubtitle: "mt-1 text-sm text-muted-foreground",
  accentBar: "mt-2.5 h-[3px] w-10 rounded-full bg-primary",
  bodyScroll: "min-w-0 flex-1 overflow-y-auto p-6",
  section:
    "rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]",
  sectionHeader: "border-b border-hairline bg-surface-2 px-5 py-3",
  sectionTitle: "text-sm font-semibold tracking-tight text-foreground",
  sectionDesc: "mt-1 text-xs text-muted-foreground",
  statCard:
    "rounded-xl border border-hairline bg-surface p-4 shadow-[var(--card-shadow)] transition-[transform,box-shadow,border-color] duration-200 hover:border-primary/40 hover:shadow-[var(--hover-shadow)] hover:-translate-y-0.5",
  statValue: "text-3xl font-bold tracking-tight tabular-nums",
  quickLink:
    "flex items-center gap-2.5 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm font-medium transition-[border-color,background-color,box-shadow] duration-200 hover:border-primary/50 hover:bg-surface-2",
} as const;
