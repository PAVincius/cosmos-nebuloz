import { Badge } from "@repo/design-system/components/cosmos/badge";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { getStrategicThemes } from "@/app/actions/strategic-themes";
import { appDesign } from "@/lib/app-design";
import { NewThemeButton } from "./components/new-theme-button";
import type { ThemeListItemWithAlloc } from "./components/themes-board";
import { ThemesBoard } from "./components/themes-board";

export const metadata = {
  title: "Temas Estratégicos - COSMOS",
  description: "Gerencie temas estratégicos e vincule épicos do portfolio",
};

export default async function StrategicThemesPage() {
  const themes = await getStrategicThemes();

  const totalBudget = themes.reduce((sum, t) => sum + (t.budgetTotal ?? 0), 0);
  const themesWithAlloc: ThemeListItemWithAlloc[] = themes.map((t) => ({
    ...t,
    allocPct: totalBudget > 0 ? ((t.budgetTotal ?? 0) / totalBudget) * 100 : 0,
  }));
  const offTarget = themesWithAlloc.filter(
    (t) => t.targetAllocationPct != null && Math.round(t.allocPct) !== Math.round(t.targetAllocationPct)
  ).length;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <>
            <RelationChip
              eyebrow="Pilares"
              href="/portfolio/strategy-map"
              label="Mapa estratégico"
              tone="accent"
            />
            <NewThemeButton nextOrder={themes.length} />
          </>
        }
        badge={
          <>
            <Badge tone="accent">{themes.length} temas ativos</Badge>
            <Badge tone="amber">{offTarget} fora do alvo</Badge>
            <Badge tone="neutral">Revisão trimestral</Badge>
          </>
        }
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Temas Estratégicos" },
        ]}
        subtitle="Como o investimento do portfolio se distribui entre as apostas estratégicas — alocação real vs. alvo de orçamento."
        title="Temas Estratégicos"
      />
      <div className={appDesign.bodyScroll}>
        <ThemesBoard initialThemes={themesWithAlloc} />
      </div>
    </div>
  );
}
