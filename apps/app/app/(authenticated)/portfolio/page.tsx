import dynamic from "next/dynamic";
import { getPortfolioEpics } from "@/app/actions/epics/get-portfolio";
import { getPortfolioKanbanConfig, getViewerRole } from "@/app/actions/portfolio-kanban";
import { DEFAULT_PORTFOLIO_COLUMNS } from "@/app/actions/portfolio-kanban/schema";
import { getStrategicThemes } from "@/app/actions/strategic-themes";
import { getOrgId } from "@repo/auth/server";
import { PortfolioRoom } from "./portfolio-room";
import { WalkthroughModal } from "./components/walkthrough-modal";
import { appDesign } from "@/lib/app-design";
import { notFound } from "next/navigation";

const CONFIGURE_ROLES = new Set(["ADMIN", "STE"]);

const KanbanBoard = dynamic(
  () =>
    import("../dashboard/portfolio/components/kanban-board").then(
      (m) => m.KanbanBoard
    ),
  {
    loading: () => (
      <div
        className="flex min-h-[320px] items-center justify-center gap-3 text-muted-foreground text-sm"
        aria-busy
        aria-label="A carregar Kanban"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <span>A carregar quadro…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "Portfolio Kanban | COSMOS",
  description: "Kanban colaborativo de épicos do portfólio SAFe",
};

export default async function PortfolioPage() {
  const orgId = await getOrgId();
  if (!orgId) notFound();

  const [epics, configRes, roleRes, themes] = await Promise.all([
    getPortfolioEpics(),
    getPortfolioKanbanConfig(),
    getViewerRole(),
    getStrategicThemes(),
  ]);

  const columns = configRes.ok ? configRes.data.columns : DEFAULT_PORTFOLIO_COLUMNS;
  const canConfigure = roleRes.ok && CONFIGURE_ROLES.has(roleRes.data);
  const themeOptions = themes.map((t) => ({ id: t.id, title: t.title, color: t.color }));

  return (
    <div className={`${appDesign.shell} h-full`}>
      <WalkthroughModal />
      <header className={appDesign.pageHeader}>
        <h1 className={appDesign.pageTitle}>Portfolio Kanban</h1>
        <p className={appDesign.pageSubtitle}>
          Arraste épicos pelas etapas do SAFe. Alterações sincronizam em tempo real no workspace.
        </p>
        <div className={appDesign.accentBar} aria-hidden />
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{epics.length}</span> épico
          {epics.length !== 1 ? "s" : ""} no portfólio
        </p>
      </header>

      <div className="min-w-0 flex-1 overflow-x-auto bg-muted/20 p-6 dark:bg-muted/10">
        <PortfolioRoom orgId={orgId}>
          <KanbanBoard
            initialEpics={epics}
            columns={columns}
            canConfigure={canConfigure}
            themes={themeOptions}
          />
        </PortfolioRoom>
      </div>
    </div>
  );
}
