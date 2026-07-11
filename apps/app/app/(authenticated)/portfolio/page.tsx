import { Badge } from "@repo/design-system/components/cosmos/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { getOrgId } from "@repo/auth/server";
import { GanttChartSquare, Gauge, Layers, PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortfolioEpics } from "@/app/actions/epics/get-portfolio";
import {
  getPortfolioKanbanConfig,
  getViewerRole,
} from "@/app/actions/portfolio-kanban";
import { DEFAULT_PORTFOLIO_COLUMNS } from "@/app/actions/portfolio-kanban/schema";
import { getStrategicThemes } from "@/app/actions/strategic-themes";
import { appDesign } from "@/lib/app-design";
import { RelationChip } from "../components/relation-chip";
import { PageHeader } from "../components/page-header";
import { EpicsKanbanBoard } from "./components/epics-kanban-board";
import { WalkthroughModal } from "./components/walkthrough-modal";
import { PortfolioRoom } from "./portfolio-room";

const WIP_OVERRIDE_ROLES = new Set(["ADMIN", "STE", "RTE", "PO", "SM"]);

export const metadata = {
  title: "Portfolio Kanban | COSMOS",
  description: "Lifecycle completo dos épicos do portfólio, do Funnel ao Done.",
};

const HEADER_BREADCRUMB = [{ label: "Portfolio" }];
const HEADER_SUBTITLE =
  "Arraste épicos pelas etapas do SAFe. Alterações sincronizam em tempo real no workspace.";

function PortfolioPageHeader({ totalEpics }: { totalEpics: number }) {
  return (
    <PageHeader
      actions={
        <Button asChild size="sm">
          <Link href="/portfolio?epic=new">
            <PlusIcon aria-hidden size={14} />
            Novo Épico
          </Link>
        </Button>
      }
      badge={
        <>
          <Badge tone="accent">{totalEpics} épicos no portfólio</Badge>
          <RelationChip
            eyebrow="Priorização"
            href="/portfolio/wsjf"
            icon={<Gauge />}
            label="WSJF"
            tone="amber"
          />
          <RelationChip
            eyebrow="Timeline"
            href="/portfolio/roadmap"
            icon={<GanttChartSquare />}
            label="Roadmap"
            tone="blue"
          />
          <RelationChip
            eyebrow="Agrupamento"
            href="/portfolio/themes"
            icon={<Layers />}
            label="Temas"
            tone="purple"
          />
        </>
      }
      breadcrumb={HEADER_BREADCRUMB}
      subtitle={HEADER_SUBTITLE}
      title="Portfolio Kanban"
    />
  );
}

export default async function PortfolioPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    notFound();
  }

  try {
    const [epics, configRes, roleRes, themes] = await Promise.all([
      getPortfolioEpics(),
      getPortfolioKanbanConfig(),
      getViewerRole(),
      getStrategicThemes(),
    ]);

    const columns = configRes.ok
      ? configRes.data.columns
      : DEFAULT_PORTFOLIO_COLUMNS;
    const canOverrideWip = roleRes.ok && WIP_OVERRIDE_ROLES.has(roleRes.data);
    const themeOptions = themes.map((t) => ({
      id: t.id,
      title: t.title,
      color: t.color,
    }));

    return (
      <div className={`${appDesign.shell} h-full`}>
        <WalkthroughModal />
        <PortfolioPageHeader totalEpics={epics.length} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/20 dark:bg-muted/10">
          <div className="min-h-0 flex-1 overflow-x-auto px-6 pb-6 pt-6">
            <PortfolioRoom orgId={orgId}>
              <EpicsKanbanBoard
                canOverrideWip={canOverrideWip}
                columns={columns}
                initialEpics={epics}
                themes={themeOptions}
              />
            </PortfolioRoom>
          </div>
        </div>
      </div>
    );
  } catch {
    return (
      <div className={`${appDesign.shell} h-full`}>
        <PortfolioPageHeader totalEpics={0} />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-hairline bg-card px-6 py-8 text-center">
            <p className="font-medium text-sm">
              Não foi possível carregar o board de épicos.
            </p>
            <p className="text-muted-foreground text-xs">
              Tente recarregar a página. Se o problema persistir, contacte o
              suporte.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
