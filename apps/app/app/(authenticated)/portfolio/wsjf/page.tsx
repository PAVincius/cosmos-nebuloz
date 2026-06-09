import dynamic from "next/dynamic";
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

  return (
    <div className={`${appDesign.shell} h-full`}>
      <header className={appDesign.pageHeader}>
        <h1 className={appDesign.pageTitle}>Priorização WSJF</h1>
        <p className={appDesign.pageSubtitle}>
          Weighted Shortest Job First — ordene épicos e features por custo de
          atraso ÷ tamanho do job.
        </p>
        <div aria-hidden className={appDesign.accentBar} />
      </header>

      <div className={appDesign.bodyScroll}>
        <WSJFDashboard access={access} config={config} epics={epics} />
      </div>
    </div>
  );
}
