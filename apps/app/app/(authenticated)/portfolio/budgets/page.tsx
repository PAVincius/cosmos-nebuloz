// apps/app/app/(authenticated)/portfolio/budgets/page.tsx

import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getARTs } from "@/app/actions/arts/get-arts";
import { listBillingIntegrations } from "@/app/actions/billing";
import { getBudgetOverview } from "@/app/actions/billing/snapshots";
import { getLeanBudgets } from "@/app/actions/lean-budget";
import { appDesign } from "@/lib/app-design";
import { BudgetDashboard } from "./components/budget-dashboard";

export const metadata = {
  title: "Lean Budget — COSMOS",
  description:
    "FinOps: controle de orçamento por Tema SAFe com custo real de nuvem.",
};

export default async function LeanBudgetPage() {
  const periodStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  const periodEnd = new Date();

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
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Lean Budget" },
        ]}
        subtitle="Custo real de nuvem mapeado para Temas SAFe."
        title="Lean Budget"
      />
      <div className={appDesign.bodyScroll}>
        <BudgetDashboard
          arts={arts}
          billingIntegrations={billingIntegrations}
          initialBudgets={budgets}
          overviewData={overviewData}
        />
      </div>
    </div>
  );
}
