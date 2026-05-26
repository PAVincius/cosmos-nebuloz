// apps/app/app/(authenticated)/portfolio/budgets/page.tsx
import { getLeanBudgets } from "@/app/actions/lean-budget";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getBudgetOverview } from "@/app/actions/billing/snapshots";
import { listBillingIntegrations } from "@/app/actions/billing";
import { BudgetDashboard } from "./components/budget-dashboard";

export const metadata = {
  title: "Lean Budget — COSMOS",
  description: "FinOps: controle de orçamento por Tema SAFe com custo real de nuvem.",
};

export default async function LeanBudgetPage() {
  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd   = new Date();

  const [budgets, rawArts, overview, integrations] = await Promise.all([
    getLeanBudgets(),
    getARTs(),
    getBudgetOverview({ granularity: "MONTHLY", periodStart, periodEnd }),
    listBillingIntegrations(),
  ]);

  const arts = rawArts.map((a) => ({ id: a.id, name: a.name }));
  const overviewData = overview.ok ? overview.data : [];
  const billingIntegrations = integrations.ok ? integrations.data : [];

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lean Budget</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Custo real de nuvem mapeado para Temas SAFe.
          </p>
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <BudgetDashboard
          initialBudgets={budgets}
          arts={arts}
          overviewData={overviewData}
          billingIntegrations={billingIntegrations}
        />
      </div>
    </div>
  );
}
