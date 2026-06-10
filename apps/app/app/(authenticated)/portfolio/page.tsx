import { getOrgId } from "@repo/auth/server";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPortfolioEpics } from "@/app/actions/epics/get-portfolio";
import {
  getPortfolioKanbanConfig,
  getViewerRole,
} from "@/app/actions/portfolio-kanban";
import { DEFAULT_PORTFOLIO_COLUMNS } from "@/app/actions/portfolio-kanban/schema";
import { getStrategicThemes } from "@/app/actions/strategic-themes";
import { appDesign } from "@/lib/app-design";
import { PageHeader } from "../components/page-header";
import { PortfolioKpiRow } from "./components/portfolio-kpi-row";
import { WalkthroughModal } from "./components/walkthrough-modal";
import { PortfolioRoom } from "./portfolio-room";

const CONFIGURE_ROLES = new Set(["ADMIN", "STE"]);
const WIP_OVERRIDE_ROLES = new Set(["ADMIN", "STE", "RTE", "PO", "SM"]);

const KanbanBoard = dynamic(
  () =>
    import("../dashboard/portfolio/components/kanban-board").then(
      (m) => m.KanbanBoard
    ),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar quadro…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "Portfolio | COSMOS",
  description: "Visão geral dos épicos do portfólio SAFe",
};

export default async function PortfolioPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    notFound();
  }

  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language") ?? "pt-BR";
  const locale = acceptLanguage.startsWith("es") ? "es" : "pt-BR";

  const [epics, configRes, roleRes, themes] = await Promise.all([
    getPortfolioEpics(),
    getPortfolioKanbanConfig(),
    getViewerRole(),
    getStrategicThemes(),
  ]);

  const columns = configRes.ok
    ? configRes.data.columns
    : DEFAULT_PORTFOLIO_COLUMNS;
  const canConfigure = roleRes.ok && CONFIGURE_ROLES.has(roleRes.data);
  const canOverrideWip = roleRes.ok && WIP_OVERRIDE_ROLES.has(roleRes.data);
  const themeOptions = themes.map((t) => ({
    id: t.id,
    title: t.title,
    color: t.color,
  }));

  return (
    <div className={`${appDesign.shell} h-full`}>
      <WalkthroughModal />
      <PageHeader
        stats={[
          { label: "Épicos", value: epics.length },
          { label: "Colunas", value: columns.length },
        ]}
        subtitle="Visão geral dos épicos por etapa SAFe."
        title="Portfolio"
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/20 dark:bg-muted/10">
        <div className="flex-shrink-0 px-6 pt-6 pb-4">
          <PortfolioKpiRow epics={epics} />
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto px-6 pb-6">
          <PortfolioRoom orgId={orgId}>
            <KanbanBoard
              canConfigure={canConfigure}
              canOverrideWip={canOverrideWip}
              columns={columns}
              initialEpics={epics}
              locale={locale}
              themes={themeOptions}
            />
          </PortfolioRoom>
        </div>
      </div>
    </div>
  );
}
