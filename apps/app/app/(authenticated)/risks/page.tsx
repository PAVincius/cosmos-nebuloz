import dynamic from "next/dynamic";
import { getRisks, getPIPlans } from "@/app/actions/risks";

const ROAMBoard = dynamic(
  () => import("./components/roam-board").then((m) => m.ROAMBoard),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Riscos ROAM</h1>
        <p className="text-muted-foreground text-sm">
          Rastreie e classifique riscos do PI Planning: Resolved · Owned · Accepted · Mitigated.
        </p>
      </div>
      <ROAMBoard initialRisks={risks} piPlans={piPlans} />
    </div>
  );
}
