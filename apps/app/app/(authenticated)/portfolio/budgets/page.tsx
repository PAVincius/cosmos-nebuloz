// apps/app/app/(authenticated)/portfolio/budgets/page.tsx

import { ShieldAlertIcon, WalletIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { getARTs } from "@/app/actions/arts/get-arts";
import { listBillingIntegrations } from "@/app/actions/billing";
import { getBudgetOverview } from "@/app/actions/billing/snapshots";
import { getLeanBudgets } from "@/app/actions/lean-budget";
import {
  getAvailablePeriods,
  getPortfolioAllocation,
} from "@/app/actions/lean-budget/portfolio-allocation";
import { getStrategicThemes } from "@/app/actions/strategic-themes";
import { appDesign } from "@/lib/app-design";
import { BudgetDashboard } from "./components/budget-dashboard";

export const metadata = {
  title: "Lean Budget — COSMOS",
  description:
    "FinOps: controle de orçamento por Tema SAFe com custo real de nuvem.",
};

type LeanBudgetPageProps = {
  searchParams: Promise<{ artId?: string }>;
};

export default async function LeanBudgetPage({
  searchParams,
}: LeanBudgetPageProps) {
  const periodStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  const periodEnd = new Date();

  const [{ artId }, budgets, rawArts, overview, integrations, themes, availablePeriods] =
    await Promise.all([
      searchParams,
      getLeanBudgets(),
      getARTs(),
      getBudgetOverview({ granularity: "MONTHLY", periodStart, periodEnd }),
      listBillingIntegrations(),
      getStrategicThemes(),
      getAvailablePeriods(),
    ]);

  const arts = rawArts.map((a) => ({ id: a.id, name: a.name }));
  const overviewData = overview.ok ? overview.data : [];
  const billingIntegrations = integrations.ok ? integrations.data : [];
  const initialPeriod = availablePeriods[0] ?? "";
  const initialAllocation = initialPeriod
    ? await getPortfolioAllocation(initialPeriod)
    : null;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RelationChip
              eyebrow="Guardrails"
              href="/portfolio/budgets/anomalies"
              icon={<ShieldAlertIcon />}
              label="Anomalias"
              tone="amber"
            />
            <RelationChip
              eyebrow="FinOps"
              href="/portfolio/finops"
              icon={<WalletIcon />}
              label="Custo de Nuvem"
              tone="blue"
            />
          </div>
        }
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
          artFilter={artId}
          availablePeriods={availablePeriods}
          billingIntegrations={billingIntegrations}
          initialAllocation={initialAllocation}
          initialBudgets={budgets}
          overviewData={overviewData}
          themes={themes}
        />
      </div>
    </div>
  );
}
