"use client";

import Link from "next/link";
import type { BudgetOverviewItem } from "@/app/actions/billing/snapshots";

// ─── Types ───────────────────────────────────────────────────────────────────

type BillingIntegration = {
  id: string;
  name: string;
  source: string;
  status: string;
  lastSyncAt: Date | null;
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  isPercent,
  className,
}: {
  label: string;
  value: number;
  isPercent?: boolean;
  className?: string;
}) {
  const formatted = isPercent
    ? `${value.toFixed(1)}%`
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "USD",
      }).format(value);
  return (
    <div className={`rounded-lg border p-4 ${className ?? ""}`}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold text-xl tabular-nums">{formatted}</p>
    </div>
  );
}

// ─── computeFinOps ───────────────────────────────────────────────────────────

function computeFinOps(
  overviewData: BudgetOverviewItem[],
  billingIntegrations: BillingIntegration[]
) {
  const totalPlanned = overviewData.reduce((s, r) => s + r.plannedCost, 0);
  const totalActual = overviewData.reduce((s, r) => s + r.actualCost, 0);
  const totalUnmapped = overviewData.reduce((s, r) => s + r.unmappedAmount, 0);
  const hasConnectors = billingIntegrations.length > 0;
  const unmappedPct = totalActual > 0 ? (totalUnmapped / totalActual) * 100 : 0;
  return {
    totalPlanned,
    totalActual,
    totalUnmapped,
    hasConnectors,
    unmappedPct,
  };
}

// ─── FinOps Overview Section ─────────────────────────────────────────────────

export function FinOpsSection({
  overviewData,
  billingIntegrations,
}: {
  overviewData: BudgetOverviewItem[];
  billingIntegrations: BillingIntegration[];
}) {
  const {
    totalPlanned,
    totalActual,
    totalUnmapped,
    hasConnectors,
    unmappedPct,
  } = computeFinOps(overviewData, billingIntegrations);

  return (
    <>
      {totalUnmapped > 0 && unmappedPct > 5 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <span className="font-medium text-amber-800 dark:text-amber-200">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "USD",
            }).format(totalUnmapped)}{" "}
            não mapeado para temas SAFe
          </span>
          <Link
            className="ml-auto text-amber-700 underline dark:text-amber-300"
            href="/portfolio/budgets/tag-rules"
          >
            Revisar regras →
          </Link>
        </div>
      )}
      {!hasConnectors && (
        <div className="mb-6 rounded-xl border-2 border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">
            Conecte um provedor de billing para ver custos reais
          </p>
          <div className="flex justify-center gap-3">
            <Link
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm"
              href="/settings/integrations?provider=billing_aws"
            >
              Conectar AWS
            </Link>
            <Link
              className="rounded-md border px-4 py-2 text-sm"
              href="/settings/integrations?provider=billing_gcp"
            >
              Conectar GCP
            </Link>
            <Link
              className="rounded-md border px-4 py-2 text-sm"
              href="/settings/integrations?provider=billing_azure"
            >
              Conectar Azure
            </Link>
          </div>
        </div>
      )}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <KpiCard label="Planejado MTD" value={totalPlanned} />
        <KpiCard label="Real MTD" value={totalActual} />
        <KpiCard
          isPercent
          label="% Utilizado"
          value={(totalActual / (totalPlanned || 1)) * 100}
        />
        <KpiCard
          className={unmappedPct > 5 ? "border-amber-300" : ""}
          label="Não mapeado"
          value={totalUnmapped}
        />
      </div>
    </>
  );
}
