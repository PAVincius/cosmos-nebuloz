import { CompassIcon, LayersIcon, TargetIcon, ZapIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { getAllEpics } from "@/app/actions/strategic-themes";
import { getStrategyMapData } from "@/app/actions/strategy-map";
import { appDesign } from "@/lib/app-design";
import { NewThemeButton } from "./components/new-theme-modal";
import { PillarsOverview } from "./components/pillars-overview";
import { StrategyTree } from "./components/strategy-tree";

export const metadata = {
  title: "Strategy Map | COSMOS",
  description: "Mapa estratégico: Temas → OKRs → Épicos → PI → Times",
};

export default async function StrategyMapPage() {
  const [data, allEpics] = await Promise.all([
    getStrategyMapData(),
    getAllEpics(),
  ]);

  const totalOKRs =
    data.themes.reduce((s, t) => s + t.okrs.length, 0) +
    data.unlinkedOKRs.length;
  const totalEpics = data.themes.reduce((s, t) => s + t.epics.length, 0);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="139,92,246"
        actions={
          <>
            <RelationChip
              eyebrow="Gestão"
              href="/portfolio/themes"
              icon={<LayersIcon />}
              label="Temas Estratégicos"
              tone="purple"
            />
            <RelationChip
              eyebrow="Gestão"
              href="/portfolio/okrs"
              icon={<TargetIcon />}
              label="OKRs"
              tone="blue"
            />
            <NewThemeButton
              allEpics={allEpics}
              nextOrder={data.themes.length}
            />
          </>
        }
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Strategy Map" },
        ]}
        stats={[
          { label: "Temas", value: data.themes.length, icon: LayersIcon },
          { label: "OKRs", value: totalOKRs, icon: TargetIcon },
          { label: "Épicos", value: totalEpics, icon: ZapIcon },
        ]}
        subtitle="Árvore de Strategic Themes → Épicos. Clique no nome do tema para renomear; use o + para adicionar épicos."
        title="Strategy Map"
      />
      <div className={`${appDesign.bodyScroll} flex flex-col gap-4`}>
        {data.vision && (
          <div
            className="flex items-center gap-4 overflow-hidden rounded-lg border px-6 py-5"
            style={{
              background: "var(--accent-soft)",
              borderColor: "rgba(var(--accent-rgb),.28)",
            }}
          >
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-md"
              style={{
                background: "var(--accent)",
                boxShadow: "0 8px 22px -6px rgba(var(--accent-rgb),.8)",
                color: "var(--accent-fg)",
              }}
            >
              <CompassIcon className="h-6 w-6" />
            </span>
            <div>
              <div
                className="mb-1 font-extrabold font-mono text-[11px] uppercase tracking-[0.1em]"
                style={{ color: "var(--accent-text)" }}
              >
                Visão Estratégica
              </div>
              <div className="font-semibold text-[15px] leading-snug">
                {data.vision}
              </div>
            </div>
          </div>
        )}

        <PillarsOverview pillars={data.pillars} />

        <StrategyTree allEpics={allEpics} data={data} />
      </div>
    </div>
  );
}
