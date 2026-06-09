import { CheckCircle2Icon, TargetIcon, TrendingUpIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getOKRsWithContext, getOKRTraceability } from "@/app/actions/okrs";
import { getPIPlans } from "@/app/actions/risks";
import { appDesign } from "@/lib/app-design";
import { OKRTraceabilityView } from "./components/okr-traceability-view";
import { OKRsDashboard } from "./components/okrs-dashboard";

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

  const onTrack = okrs.filter(
    (o) => o.status === "ON_TRACK" || o.status === "ACHIEVED"
  ).length;
  const totalKRs = okrs.reduce((s, o) => s + o.keyResults.length, 0);
  const onTrackPct =
    okrs.length > 0 ? Math.round((onTrack / okrs.length) * 100) : 0;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[{ label: "Portfolio", href: "/portfolio" }]}
        stats={[
          { label: "Objetivos", value: okrs.length, icon: TargetIcon },
          { label: "Key Results", value: totalKRs, icon: CheckCircle2Icon },
          { label: "No Prazo", value: `${onTrackPct}%`, icon: TrendingUpIcon },
        ]}
        subtitle="Objetivos e Key Results — acompanhe o progresso das metas estratégicas por horizonte SAFe."
        title="OKRs"
      />
      <div className={appDesign.bodyScroll}>
        <OKRsDashboard initialOKRs={okrs} piPlans={piPlans} />
        {traceability.length > 0 && (
          <div className="mt-8">
            <OKRTraceabilityView nodes={traceability} />
          </div>
        )}
      </div>
    </div>
  );
}
