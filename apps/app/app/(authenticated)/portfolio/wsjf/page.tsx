import { LayoutGrid } from "lucide-react";
import dynamic from "next/dynamic";
import { Badge } from "@repo/design-system/components/cosmos/badge";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { getEpicsWithFeatureWSJF, getWSJFConfig } from "@/app/actions/wsjf";
import { getAIAccessStatus } from "@/app/actions/wsjf/rebalance";
import { appDesign } from "@/lib/app-design";

const WSJFDashboard = dynamic(
  () => import("./components/wsjf-dashboard").then((m) => m.WSJFDashboard),
  {
    loading: () => (
      <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar priorização WSJF…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "Priorização WSJF | COSMOS",
  description: "Priorização Weighted Shortest Job First do portfólio SAFe",
};

export default async function WSJFPage() {
  const [epics, config, access] = await Promise.all([
    getEpicsWithFeatureWSJF(),
    getWSJFConfig(),
    getAIAccessStatus(),
  ]);

  const totalFeatures = epics.reduce((sum, epic) => sum + epic.features.length, 0);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="0,212,255"
        actions={
          <RelationChip
            eyebrow="Board"
            href="/portfolio"
            icon={<LayoutGrid />}
            label="Portfolio Kanban"
            tone="accent"
          />
        }
        badge={
          totalFeatures > 0 ? (
            <Badge dot tone="accent">
              {totalFeatures} {totalFeatures === 1 ? "item" : "itens"} na fila
            </Badge>
          ) : undefined
        }
        breadcrumb={[{ label: "Portfolio", href: "/portfolio" }]}
        subtitle="Weighted Shortest Job First — ordene épicos e features por custo de atraso ÷ tamanho do job."
        title="Priorização WSJF"
      />

      <div className={appDesign.bodyScroll}>
        <WSJFDashboard access={access} config={config} epics={epics} />
      </div>
    </div>
  );
}
