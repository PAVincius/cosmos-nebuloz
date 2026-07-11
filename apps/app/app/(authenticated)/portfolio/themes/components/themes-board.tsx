import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { ThemeCard, type ThemeListItemWithAlloc } from "./theme-card";
import { ThemesEmptyState } from "./themes-empty-state";

export type { ThemeListItemWithAlloc };

// KpiCard `iconPath` — single/combined SVG <path d> strings (KpiCard renders
// a single <path>, not a multi-node icon tree), from lucide's compass/gauge/layers.
const ICON_COMPASS =
  "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z M2 12A10 10 0 1 0 22 12A10 10 0 1 0 2 12";
const ICON_GAUGE = "m12 14 4-4 M3.34 19a10 10 0 1 1 17.32 0";
const ICON_LAYERS =
  "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12 M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17";

type ThemesBoardProps = {
  initialThemes: ThemeListItemWithAlloc[];
};

export function ThemesBoard({ initialThemes }: ThemesBoardProps) {
  if (initialThemes.length === 0) {
    return <ThemesEmptyState />;
  }

  const themes = initialThemes;
  const totalAlloc = Math.round(themes.reduce((sum, t) => sum + t.allocPct, 0));
  const totalEpics = themes.reduce((sum, t) => sum + t.epicCount, 0);
  const withTarget = themes.filter((t) => t.targetAllocationPct != null);
  const adherence =
    withTarget.length > 0
      ? Math.round(
          100 -
            withTarget.reduce(
              (sum, t) => sum + Math.abs(t.allocPct - (t.targetAllocationPct ?? 0)),
              0
            ) /
              withTarget.length
        )
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid cols={3}>
        <KpiCard
          badge="de todo o portfólio"
          iconPath={ICON_COMPASS}
          label="Investimento mapeado"
          tone="accent"
          unit="%"
          value={totalAlloc}
        />
        <KpiCard
          badge="vinculados a temas"
          iconPath={ICON_LAYERS}
          label="Épicos sob temas"
          tone="purple"
          value={totalEpics}
        />
        <KpiCard
          badge="vs. alvo definido"
          iconPath={ICON_GAUGE}
          label="Aderência ao alvo"
          tone="green"
          unit="%"
          value={Math.max(0, adherence)}
        />
      </KpiGrid>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme, index) => (
          <ThemeCard index={index} key={theme.id} theme={theme} />
        ))}
      </div>
    </div>
  );
}
