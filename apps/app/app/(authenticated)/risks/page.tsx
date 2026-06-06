import dynamic from "next/dynamic";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getPIPlans, getRisks } from "@/app/actions/risks";
import { appDesign } from "@/lib/app-design";
import { ROAMMetricsStrip } from "./components/roam-metrics-strip";

const ROAMBoard = dynamic(
  () => import("./components/roam-board").then((m) => m.ROAMBoard),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar quadro ROAM…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "Riscos ROAM | COSMOS",
  description: "Quadro ROAM de riscos do PI Planning SAFe",
};

export default async function RisksPage() {
  const [risks, piPlans] = await Promise.all([getRisks(), getPIPlans()]);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        subtitle="Rastreie e classifique riscos do PI Planning: Resolved · Owned · Accepted · Mitigated."
        title="Riscos ROAM"
      />
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <ROAMMetricsStrip risks={risks} />
          <ROAMBoard initialRisks={risks} piPlans={piPlans} />
        </div>
      </div>
    </div>
  );
}
