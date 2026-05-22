"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  type LbcRow,
  saveLeanBusinessCase,
} from "@/app/actions/lean-business-case";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT: {
    label: "Rascunho",
    cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  SUBMITTED: {
    label: "Submetido",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  APPROVED: {
    label: "Aprovado",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
} satisfies Record<string, { label: string; cls: string }>;

// ─── NPV indicator ───────────────────────────────────────────────────────────

function NpvBadge({ npv }: { npv: number }) {
  const positive = npv >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold text-sm ${
        positive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
      }`}
    >
      {positive ? (
        <TrendingUpIcon className="h-3.5 w-3.5" />
      ) : (
        <XCircleIcon className="h-3.5 w-3.5" />
      )}
      NPV: {positive ? "+" : ""}
      {new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(npv)}
    </span>
  );
}

// ─── Indicator pill list ──────────────────────────────────────────────────────

function IndicatorList({
  indicators,
  onChange,
}: {
  indicators: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !indicators.includes(trimmed)) {
      onChange([...indicators, trimmed]);
      setDraft("");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {indicators.map((ind) => (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs"
            key={ind}
          >
            {ind}
            <button
              className="ml-0.5 rounded-full hover:text-destructive"
              onClick={() => onChange(indicators.filter((i) => i !== ind))}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ex: Redução de churn em 15% em 3 meses"
          type="text"
          value={draft}
        />
        <Button onClick={add} size="sm" type="button" variant="outline">
          <PlusIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type Props = {
  epicId: string;
  initial: LbcRow | null;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: multi-field form with status transitions requires unified state
export function LeanBusinessCasePanel({ epicId, initial }: Props) {
  const [open, setOpen] = useState(!!initial);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    problemStatement: initial?.problemStatement ?? "",
    solutionHypothesis: initial?.solutionHypothesis ?? "",
    nonFinancialBenefits: initial?.nonFinancialBenefits ?? "",
    riskSummary: initial?.riskSummary ?? "",
    investmentCost: initial?.investmentCost ?? "",
    expectedAnnualBenefit: initial?.expectedAnnualBenefit ?? "",
    discountRate: initial?.discountRate ?? 0.1,
    timeHorizonYears: initial?.timeHorizonYears ?? 3,
    leadingIndicators: initial?.leadingIndicators ?? ([] as string[]),
    status: (initial?.status ?? "DRAFT") as "DRAFT" | "SUBMITTED" | "APPROVED",
  });

  const [npv, setNpv] = useState<number | null>(initial?.npvEstimate ?? null);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const handleSave = (status?: "DRAFT" | "SUBMITTED" | "APPROVED") => {
    startTransition(async () => {
      const result = await saveLeanBusinessCase({
        epicId,
        ...form,
        status: status ?? form.status,
      });
      setNpv(result.npvEstimate);
      if (status) {
        set("status", status);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  };

  const statusInfo = STATUS_CONFIG[form.status];

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <TrendingUpIcon className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm tracking-tight">
            Lean Business Case
          </span>
          <Badge
            className={`${statusInfo.cls} text-[10px] uppercase tracking-wider`}
          >
            {statusInfo.label}
          </Badge>
          {npv !== null && <NpvBadge npv={npv} />}
        </div>
        {open ? (
          <ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Body */}
      {open ? (
        <div className="space-y-6 border-t px-6 py-5">
          {/* Row 1: Problem + Solution */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                className="font-semibold text-muted-foreground text-xs uppercase tracking-wide"
                htmlFor="lbc-problem"
              >
                Declaração do Problema
              </label>
              <textarea
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                id="lbc-problem"
                onChange={(e) => set("problemStatement", e.target.value)}
                placeholder="Qual problema de negócio este épico resolve?"
                rows={4}
                value={form.problemStatement}
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="font-semibold text-muted-foreground text-xs uppercase tracking-wide"
                htmlFor="lbc-solution"
              >
                Hipótese de Solução
              </label>
              <textarea
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                id="lbc-solution"
                onChange={(e) => set("solutionHypothesis", e.target.value)}
                placeholder="Como a solução proposta resolve o problema?"
                rows={4}
                value={form.solutionHypothesis}
              />
            </div>
          </div>

          {/* Row 2: Financial inputs */}
          <div>
            <p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Modelo Financeiro
            </p>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="lbc-cost"
                >
                  Custo Total (R$)
                </label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  id="lbc-cost"
                  min={0}
                  onChange={(e) =>
                    set("investmentCost", e.target.value as unknown as number)
                  }
                  placeholder="500000"
                  type="number"
                  value={form.investmentCost}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="lbc-benefit"
                >
                  Benefício Anual (R$)
                </label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  id="lbc-benefit"
                  min={0}
                  onChange={(e) =>
                    set(
                      "expectedAnnualBenefit",
                      e.target.value as unknown as number
                    )
                  }
                  placeholder="300000"
                  type="number"
                  value={form.expectedAnnualBenefit}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="lbc-rate"
                >
                  Taxa Desc. (%)
                </label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  id="lbc-rate"
                  max={100}
                  min={0}
                  onChange={(e) =>
                    set("discountRate", Number(e.target.value) / 100)
                  }
                  step={1}
                  type="number"
                  value={Math.round(form.discountRate * 100)}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="lbc-years"
                >
                  Horizonte (anos)
                </label>
                <input
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  id="lbc-years"
                  max={10}
                  min={1}
                  onChange={(e) =>
                    set("timeHorizonYears", Number(e.target.value))
                  }
                  type="number"
                  value={form.timeHorizonYears}
                />
              </div>
            </div>
            {npv !== null && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  NPV calculado:
                </span>
                <NpvBadge npv={npv} />
              </div>
            )}
          </div>

          {/* Row 3: Leading indicators */}
          <div className="space-y-1.5">
            <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Indicadores Líderes
            </p>
            <IndicatorList
              indicators={form.leadingIndicators}
              onChange={(v) => set("leadingIndicators", v)}
            />
          </div>

          {/* Row 4: Non-financial + Risk */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                className="font-semibold text-muted-foreground text-xs uppercase tracking-wide"
                htmlFor="lbc-benefits"
              >
                Benefícios Não-Financeiros
              </label>
              <textarea
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                id="lbc-benefits"
                onChange={(e) => set("nonFinancialBenefits", e.target.value)}
                placeholder="Melhorias de NPS, retenção, compliance..."
                rows={3}
                value={form.nonFinancialBenefits}
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="font-semibold text-muted-foreground text-xs uppercase tracking-wide"
                htmlFor="lbc-risk"
              >
                Resumo de Riscos
              </label>
              <textarea
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                id="lbc-risk"
                onChange={(e) => set("riskSummary", e.target.value)}
                placeholder="Riscos técnicos, de mercado, dependências críticas..."
                rows={3}
                value={form.riskSummary}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              {saved ? (
                <span className="flex items-center gap-1 text-emerald-600 text-xs">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Salvo
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                disabled={isPending}
                onClick={() => handleSave("DRAFT")}
                size="sm"
                type="button"
                variant="outline"
              >
                {isPending ? (
                  <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Salvar rascunho
              </Button>
              {form.status !== "APPROVED" && (
                <Button
                  disabled={isPending}
                  onClick={() =>
                    handleSave(
                      form.status === "DRAFT" ? "SUBMITTED" : "APPROVED"
                    )
                  }
                  size="sm"
                  type="button"
                >
                  {form.status === "DRAFT"
                    ? "Submeter para aprovação"
                    : "Marcar como aprovado"}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
