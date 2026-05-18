/**
 * Classes Tailwind alinhadas a DESIGN.app.md — telas piloto da app autenticada.
 */
export const appDesign = {
  shell: "flex w-full min-w-0 flex-col",
  pageHeader: "border-b border-border/80 px-6 py-4",
  pageTitle: "text-2xl font-bold tracking-tight text-foreground",
  pageSubtitle: "text-sm text-muted-foreground mt-0.5",
  accentBar: "mt-2 h-0.5 w-10 rounded-full bg-[#5e6ad2]",
  bodyScroll: "min-w-0 flex-1 overflow-y-auto p-6",
  section: "rounded-lg border border-border/80 bg-card shadow-sm",
  sectionHeader: "border-b border-border/60 bg-muted/30 px-5 py-3",
  sectionTitle: "text-sm font-semibold tracking-tight text-foreground",
  sectionDesc: "mt-1 text-xs text-muted-foreground",
  statCard: "rounded-lg border border-border/80 bg-card p-4 shadow-sm transition-colors hover:border-[#5e6ad2]/40",
  statValue: "text-3xl font-bold tracking-tight tabular-nums",
  quickLink:
    "flex items-center gap-2 rounded-lg border border-border/80 bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-[#5e6ad2]/50 hover:bg-muted/30",
} as const;
