"use client";

import Link from "next/link";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import type { BudgetOverviewItem } from "@/app/actions/billing/snapshots";

// ─── Icon paths (single-`d` lucide glyphs, safe across Server→Client) ─────

const ICON_WALLET =
  "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4Z";
const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_SHIELD_ALERT =
  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM12 8v4M12 16h.01";

// ─── Types ──────────────────────────────────────────────────────────────

type BillingIntegration = {
  id: string;
  name: string;
  source: string;
  status: string;
  lastSyncAt: Date | null;
};

// ─── computeFinOps ────────────────────────────────────────────────────────

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

function formatUSD(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

// ─── FinOps Overview Section ───────────────────────────────────────────────

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

  const utilPct = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
  const unmappedTone = unmappedPct > 5 ? "amber" : "green";

  return (
    <>
      {totalUnmapped > 0 && unmappedPct > 5 && (
        <div
          className="flex items-center gap-3 rounded-cosmos-md border px-4 py-3 text-[13px]"
          style={{
            borderColor: "rgba(var(--amber-rgb),.35)",
            background: "rgba(var(--amber-rgb),.08)",
          }}
        >
          <span
            className="font-semibold"
            style={{ color: "var(--amber-text)" }}
          >
            {formatUSD(totalUnmapped)} não mapeado para temas SAFe
          </span>
          <Link
            className="ml-auto text-ink-muted underline transition-colors hover:text-ink"
            href="/portfolio/budgets/tag-rules"
          >
            Revisar regras →
          </Link>
        </div>
      )}
      {!hasConnectors && (
        <div className="flex flex-col items-center gap-4 rounded-cosmos-lg border border-hairline border-dashed p-8 text-center">
          <p className="text-[13px] text-ink-muted">
            Conecte um provedor de billing para ver custos reais
          </p>
          <div className="flex justify-center gap-2">
            <Link
              className="rounded-cosmos-md bg-accent-c px-3.5 py-2 font-semibold text-[13px] text-[color:var(--on-accent)] transition-opacity hover:opacity-90"
              href="/settings/integrations?provider=billing_aws"
            >
              Conectar AWS
            </Link>
            <Link
              className="rounded-cosmos-md border border-hairline-strong bg-surface px-3.5 py-2 font-semibold text-[13px] text-ink transition-colors hover:bg-surface-2"
              href="/settings/integrations?provider=billing_gcp"
            >
              Conectar GCP
            </Link>
            <Link
              className="rounded-cosmos-md border border-hairline-strong bg-surface px-3.5 py-2 font-semibold text-[13px] text-ink transition-colors hover:bg-surface-2"
              href="/settings/integrations?provider=billing_azure"
            >
              Conectar Azure
            </Link>
          </div>
        </div>
      )}
      <KpiGrid>
        <KpiCard
          badge="— custo planejado do mês"
          iconPath={ICON_WALLET}
          label="Planejado MTD"
          tone="blue"
          value={formatUSD(totalPlanned)}
        />
        <KpiCard
          badge="— custo real de nuvem"
          iconPath={ICON_ACTIVITY}
          label="Real MTD"
          tone="accent"
          value={formatUSD(totalActual)}
        />
        <KpiCard
          badge={utilPct >= 100 ? "— acima do planejado" : "— dentro do plano"}
          iconPath={ICON_ACTIVITY}
          label="% Utilizado"
          tone={utilPct >= 100 ? "red" : utilPct >= 80 ? "amber" : "green"}
          unit="%"
          value={Math.round(utilPct * 10) / 10}
        />
        <KpiCard
          badge={unmappedPct > 5 ? "— revisar regras de tag" : "— sob controle"}
          iconPath={ICON_SHIELD_ALERT}
          label="Não mapeado"
          tone={unmappedTone}
          value={formatUSD(totalUnmapped)}
        />
      </KpiGrid>
    </>
  );
}
