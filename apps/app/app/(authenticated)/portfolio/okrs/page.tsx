import { TargetIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getOKRsWithContext, getOKRTraceability } from "@/app/actions/okrs";
import { getPIPlans } from "@/app/actions/risks";
import { appDesign } from "@/lib/app-design";
import { OkrBadge } from "./components/okr-badge";
import { OKRsView } from "./components/okrs-view";

export const metadata = {
  title: "OKRs - COSMOS",
  description: "Objetivos e Key Results do Portfolio SAFe",
};

export default async function OKRsPage() {
  const [okrs, piPlans, traceability] = await Promise.all([
    getOKRsWithContext(),
    getPIPlans(),
    getOKRTraceability(),
  ]);

  const totalKRs = okrs.reduce((s, o) => s + o.keyResults.length, 0);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <OkrBadge icon={<TargetIcon className="h-3 w-3" />} tone="accent">
              {okrs.length} objetivos
            </OkrBadge>
            <OkrBadge tone="neutral">{totalKRs} key results</OkrBadge>
            <OkrBadge dot tone="green">
              Check-in semanal
            </OkrBadge>
          </div>
        }
        subtitle="Objetivos e Key Results do portfólio SAFe — acompanhe o progresso das metas por horizonte."
        title="OKRs"
      />
      <div className={appDesign.bodyScroll}>
        <OKRsView
          initialOKRs={okrs}
          piPlans={piPlans}
          traceability={traceability}
        />
      </div>
    </div>
  );
}
