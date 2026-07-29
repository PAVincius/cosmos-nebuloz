import { notFound } from "next/navigation";
import { getBudgetOverview } from "@/app/actions/billing/snapshots";
import { getBudgetById } from "@/app/actions/lean-budget";
import { BudgetDetail } from "./components/budget-detail";

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [budgetResult, snapshotResult] = await Promise.all([
    getBudgetById(id),
    getBudgetOverview({
      granularity: "DAILY",
      periodStart: new Date(Date.now() - 90 * 86_400_000),
      periodEnd: new Date(),
    }),
  ]);

  if (!(budgetResult.ok && budgetResult.data)) {
    notFound();
  }

  const snapshots = snapshotResult.ok ? snapshotResult.data : [];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b px-6 py-4">
        <a
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/portfolio/budgets"
        >
          ← Lean Budget
        </a>
        <span className="text-muted-foreground">/</span>
        <h1 className="font-semibold text-xl">{budgetResult.data.name}</h1>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <BudgetDetail budget={budgetResult.data} snapshots={snapshots} />
      </div>
    </div>
  );
}
