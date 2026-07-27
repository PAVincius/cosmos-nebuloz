"use client";

import {
  CheckCircle2Icon,
  PencilIcon,
  PieChartIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Gauge, type GaugeTone } from "@/app/(authenticated)/components/gauge";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import type {
  PortfolioAllocation,
  ThemeAllocation,
} from "@/app/actions/lean-budget/portfolio-allocation";
import type { ThemeListItem } from "@/app/actions/strategic-themes/schema";
import { Select } from "./cosmos-form";

// ─── Icon paths (single-`d` lucide glyphs, safe across Server→Client) ─────

const ICON_SHIELD_ALERT =
  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM12 8v4M12 16h.01";
const ICON_WALLET =
  "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4Z";
const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

function StatusIcon({ status }: { status: "ok" | "warn" | "over" }) {
  if (status === "over") {
    return (
      <ShieldAlertIcon
        className="h-3.5 w-3.5"
        style={{ color: "var(--red-text)" }}
      />
    );
  }
  if (status === "warn") {
    return (
      <TriangleAlertIcon
        className="h-3.5 w-3.5"
        style={{ color: "var(--amber-text)" }}
      />
    );
  }
  return (
    <CheckCircle2Icon
      className="h-3.5 w-3.5"
      style={{ color: "var(--green-text)" }}
    />
  );
}

function spendTextColor(pct: number): string {
  if (pct > 100) {
    return "var(--red-text)";
  }
  if (pct > 80) {
    return "var(--amber-text)";
  }
  return "var(--ink)";
}

function gaugeTone(pct: number): GaugeTone {
  if (pct >= 100) {
    return "red";
  }
  if (pct >= 80) {
    return "amber";
  }
  return "green";
}

function GuardrailStatus({
  overCount,
  warnCount,
}: {
  overCount: number;
  warnCount: number;
}) {
  if (overCount > 0) {
    return (
      <span
        className="flex items-center gap-1.5 font-semibold text-[13px]"
        style={{ color: "var(--red-text)" }}
      >
        <ShieldAlertIcon className="h-4 w-4" />
        {overCount} violação{overCount > 1 ? "ões" : ""}
      </span>
    );
  }
  if (warnCount > 0) {
    return (
      <span
        className="flex items-center gap-1.5 font-semibold text-[13px]"
        style={{ color: "var(--amber-text)" }}
      >
        <TriangleAlertIcon className="h-4 w-4" />
        {warnCount} atenção
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1.5 font-semibold text-[13px]"
      style={{ color: "var(--green-text)" }}
    >
      <CheckCircle2Icon className="h-4 w-4" />
      Todos OK
    </span>
  );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  horizon,
  onEditTheme,
}: {
  theme: ThemeAllocation;
  horizon: string | null;
  onEditTheme: (themeId: string) => void;
}) {
  return (
    <div className="rounded-cosmos-md border border-hairline bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: theme.themeColor }}
          />
          <span className="font-semibold text-[13px] text-ink leading-snug">
            {theme.themeName}
          </span>
        </div>
        <span className="rounded-pill bg-surface-3 px-2 py-0.5 font-mono text-[9.5px] text-ink-muted uppercase">
          {theme.percentOfPortfolio}% do portfólio
        </span>
      </div>

      {horizon && (
        <span
          className="mb-3 inline-block rounded-pill px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em]"
          style={{
            background: "rgba(var(--accent-c),.12)",
            color: "var(--accent-c)",
            border: "1px solid rgba(var(--accent-c),.3)",
          }}
        >
          {horizon}
        </span>
      )}

      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-pill bg-surface-4">
        <div
          className="h-full rounded-pill transition-all"
          style={{
            width: `${theme.percentOfPortfolio}%`,
            backgroundColor: theme.themeColor,
          }}
        />
      </div>

      <div className="mb-3 flex items-center justify-between text-[11.5px] text-ink-muted">
        <span>{BRL(theme.totalAmount)} alocado</span>
        <span>{BRL(theme.totalSpent)} gasto</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Gauge
            label="Consumo"
            size={44}
            sublabel={`${theme.percentUsed}%`}
            tone={gaugeTone(theme.percentUsed)}
            value={Math.min(theme.percentUsed, 100)}
          />
          {theme.guardrails !== null && theme.guardrails !== undefined && (
            <div className="flex flex-col gap-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <StatusIcon status={theme.capexStatus} />
                <span className="text-ink-muted">
                  CapEx: {BRL(theme.guardrails.capex)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusIcon status={theme.opexStatus} />
                <span className="text-ink-muted">
                  OpEx: {BRL(theme.guardrails.opex)}
                </span>
              </div>
            </div>
          )}
        </div>
        {theme.themeId && (
          <button
            className="flex shrink-0 items-center gap-1 rounded-md border border-hairline-strong px-2 py-1 font-semibold text-[11px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            onClick={() => onEditTheme(theme.themeId as string)}
            type="button"
          >
            <PencilIcon className="h-3 w-3" />
            Editar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type Props = {
  data: PortfolioAllocation | null;
  period: string;
  availablePeriods: string[];
  isPending: boolean;
  onPeriodChange: (period: string) => void;
  themes: ThemeListItem[];
  onEditTheme: (themeId: string) => void;
};

export function BudgetAllocationPanel({
  data,
  period,
  availablePeriods,
  isPending,
  onPeriodChange,
  themes,
  onEditTheme,
}: Props) {
  const horizonByThemeId = new Map(themes.map((t) => [t.id, t.horizon]));

  const overCount =
    data?.themes.filter(
      (t) => t.capexStatus === "over" || t.opexStatus === "over"
    ).length ?? 0;
  const warnCount =
    data?.themes.filter(
      (t) => t.capexStatus === "warn" || t.opexStatus === "warn"
    ).length ?? 0;
  const portfolioUsedPct =
    data && data.portfolioTotal > 0
      ? Math.round((data.portfolioSpent / data.portfolioTotal) * 100 * 10) / 10
      : 0;

  if (availablePeriods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-cosmos-lg border border-hairline border-dashed py-16 text-center">
        <PieChartIcon className="mb-3 h-10 w-10 text-ink-muted opacity-40" />
        <p className="font-semibold text-[13px] text-ink">
          Nenhum orçamento cadastrado
        </p>
        <p className="mt-1 text-[12px] text-ink-muted">
          Crie orçamentos na aba principal para ver a alocação
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[14px] text-ink">
            Alocação por Tema Estratégico
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Distribuição do orçamento do portfólio entre temas SAFe
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <RefreshCwIcon className="h-3.5 w-3.5 animate-spin text-ink-muted" />
          ) : null}
          <Select
            aria-label="Período"
            className="w-auto"
            onChange={(e) => onPeriodChange(e.target.value)}
            value={period}
          >
            {availablePeriods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Portfolio summary row */}
      {data !== null && data !== undefined && (
        <KpiGrid cols={3}>
          <KpiCard
            badge="— alocado no período"
            iconPath={ICON_WALLET}
            label="Total alocado"
            tone="blue"
            value={BRL(data.portfolioTotal)}
          />
          <KpiCard
            badge={`— ${portfolioUsedPct}% do alocado`}
            iconPath={ICON_ACTIVITY}
            label="Total gasto"
            tone={
              portfolioUsedPct > 100
                ? "red"
                : portfolioUsedPct > 80
                  ? "amber"
                  : "green"
            }
            value={BRL(data.portfolioSpent)}
          />
          <div className="rounded-cosmos-md border border-hairline bg-surface-2 p-4">
            <p className="font-mono text-[9.5px] text-ink-muted uppercase tracking-[0.08em]">
              Guardrails
            </p>
            <div className="mt-3 flex items-center gap-3">
              <GuardrailStatus overCount={overCount} warnCount={warnCount} />
            </div>
          </div>
        </KpiGrid>
      )}

      {/* Theme grid */}
      {data !== null && data !== undefined && data.themes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.themes.map((theme) => (
            <ThemeCard
              horizon={
                theme.themeId
                  ? (horizonByThemeId.get(theme.themeId) ?? null)
                  : null
              }
              key={theme.themeId ?? "unallocated"}
              onEditTheme={onEditTheme}
              theme={theme}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 rounded-cosmos-lg border border-hairline border-dashed py-12 text-center">
          <PieChartIcon className="mb-2 h-8 w-8 text-ink-muted opacity-40" />
          <p className="text-[13px] text-ink-muted">
            Nenhum orçamento para o período {period}
          </p>
        </div>
      )}
    </div>
  );
}
