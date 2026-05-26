"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  BellIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Progress } from "@repo/design-system/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import {
  createLeanBudget,
  deleteLeanBudget,
  updateLeanBudget,
  type LeanBudgetWithUsage,
} from "@/app/actions/lean-budget";

// ─── Types ───────────────────────────────────────────────────────────────────

type ARTOption = { id: string; name: string };

type OverviewItem = {
  themeId: string | null;
  themeName: string | null;
  plannedCost: number;
  actualCost: number;
  cloudCost: number;
  unmappedAmount: number;
  period: string;
};

type BillingIntegration = {
  id: string;
  name: string;
  source: string;
  status: string;
  lastSyncAt: Date | null;
};

type Props = {
  initialBudgets: LeanBudgetWithUsage[];
  arts: ARTOption[];
  overviewData: OverviewItem[];
  billingIntegrations: BillingIntegration[];
};

type CreateForm = {
  name: string;
  amount: string;
  period: string;
  artId: string;
  capex: string;
  opex: string;
};

const DEFAULT_FORM: CreateForm = {
  name: "",
  amount: "",
  period: "",
  artId: "",
  capex: "",
  opex: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function progressColor(pct: number): string {
  if (pct >= 90) return "[&>div]:bg-red-500";
  if (pct >= 80) return "[&>div]:bg-orange-500";
  if (pct >= 60) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-green-500";
}

// ─── Budget Card ─────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  artName,
  onDelete,
  onUpdateSpent,
}: {
  budget: LeanBudgetWithUsage;
  artName: string | undefined;
  onDelete: (id: string) => void;
  onUpdateSpent: (id: string, spent: number) => void;
}) {
  const [editingSpent, setEditingSpent] = useState(false);
  const [localSpent, setLocalSpent] = useState(String(budget.spent));
  const [isPending, startTransition] = useTransition();

  function handleSaveSpent() {
    const val = parseFloat(localSpent);
    if (!Number.isNaN(val) && val >= 0) {
      onUpdateSpent(budget.id, val);
      startTransition(() => { void updateLeanBudget(budget.id, { spent: val }); });
    }
    setEditingSpent(false);
  }

  const isApproaching = !budget.isOverGuardrail && budget.percentUsed >= 75;

  return (
    <Card className={
      budget.isOverGuardrail
        ? "border-red-300 dark:border-red-700"
        : isApproaching
          ? "border-amber-300 dark:border-amber-700"
          : ""
    }>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">{budget.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              {artName && (
                <Badge variant="secondary" className="text-xs">{artName}</Badge>
              )}
              <span className="text-xs text-muted-foreground">{budget.period}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {budget.isOverGuardrail && (
              <ShieldAlertIcon className="h-4 w-4 text-red-500" aria-label="Guardrail violado" />
            )}
            {isApproaching && (
              <BellIcon className="h-4 w-4 text-amber-500" aria-label="Aproximando guardrail" />
            )}
            <button
              type="button"
              onClick={() => onDelete(budget.id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Excluir budget"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Utilização</span>
            <span className={`text-xs font-mono font-semibold ${budget.percentUsed >= 80 ? "text-orange-600" : "text-foreground"}`}>
              {budget.percentUsed}%
            </span>
          </div>
          <Progress value={budget.percentUsed} className={`h-2 ${progressColor(budget.percentUsed)}`} />
        </div>

        {/* Spent / Total */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Gasto</p>
            {editingSpent ? (
              <div className="flex items-center gap-1 mt-0.5">
                <Input
                  type="number"
                  value={localSpent}
                  onChange={(e) => setLocalSpent(e.target.value)}
                  className="h-6 text-xs w-24"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveSpent()}
                  autoFocus
                />
                <Button size="sm" className="h-6 text-xs px-2" onClick={handleSaveSpent}>OK</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingSpent(true)}
                className="font-semibold hover:text-primary transition-colors"
              >
                {formatCurrency(budget.spent)}
              </button>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold">{formatCurrency(budget.amount)}</p>
          </div>
        </div>

        {/* Guardrails */}
        {budget.guardrails && (
          <div className="rounded-md bg-muted/40 px-3 py-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">CapEx</p>
              <p className="font-mono">{budget.guardrails.capex}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">OpEx</p>
              <p className="font-mono">{budget.guardrails.opex}%</p>
            </div>
          </div>
        )}

        {budget.isOverGuardrail && (
          <div className="flex items-center gap-1.5 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2.5 py-1.5">
            <ShieldAlertIcon className="h-3.5 w-3.5 text-red-600 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-300">
              Guardrail violado — requer aprovação LPM.
            </p>
          </div>
        )}
        {isApproaching && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5">
            <BellIcon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {budget.percentUsed}% utilizado — monitorar consumo.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, isPercent, className }: {
  label: string;
  value: number;
  isPercent?: boolean;
  className?: string;
}) {
  const formatted = isPercent
    ? `${value.toFixed(1)}%`
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);
  return (
    <div className={`rounded-lg border p-4 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{formatted}</p>
    </div>
  );
}

// ─── FinOps Overview Section ─────────────────────────────────────────────────

function computeFinOps(overviewData: OverviewItem[], billingIntegrations: BillingIntegration[]) {
  const totalPlanned  = overviewData.reduce((s, r) => s + r.plannedCost, 0);
  const totalActual   = overviewData.reduce((s, r) => s + r.actualCost, 0);
  const totalUnmapped = overviewData.reduce((s, r) => s + r.unmappedAmount, 0);
  const hasConnectors = billingIntegrations.length > 0;
  const unmappedPct   = totalActual > 0 ? (totalUnmapped / totalActual) * 100 : 0;
  return { totalPlanned, totalActual, totalUnmapped, hasConnectors, unmappedPct };
}

function FinOpsSection({ overviewData, billingIntegrations }: Pick<Props, "overviewData" | "billingIntegrations">) {
  const { totalPlanned, totalActual, totalUnmapped, hasConnectors, unmappedPct } =
    computeFinOps(overviewData, billingIntegrations);

  return (
    <>
      {totalUnmapped > 0 && unmappedPct > 5 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <span className="font-medium text-amber-800 dark:text-amber-200">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(totalUnmapped)} não mapeado para temas SAFe
          </span>
          <a href="/portfolio/budgets/tag-rules" className="ml-auto text-amber-700 underline dark:text-amber-300">
            Revisar regras →
          </a>
        </div>
      )}
      {!hasConnectors && (
        <div className="mb-6 rounded-xl border-2 border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">Conecte um provedor de billing para ver custos reais</p>
          <div className="flex justify-center gap-3">
            <a href="/settings/integrations?provider=billing_aws" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Conectar AWS</a>
            <a href="/settings/integrations?provider=billing_gcp" className="rounded-md border px-4 py-2 text-sm">Conectar GCP</a>
            <a href="/settings/integrations?provider=billing_azure" className="rounded-md border px-4 py-2 text-sm">Conectar Azure</a>
          </div>
        </div>
      )}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <KpiCard label="Planejado MTD" value={totalPlanned} />
        <KpiCard label="Real MTD"      value={totalActual} />
        <KpiCard label="% Utilizado"   value={(totalActual / (totalPlanned || 1)) * 100} isPercent />
        <KpiCard label="Não mapeado"   value={totalUnmapped} className={unmappedPct > 5 ? "border-amber-300" : ""} />
      </div>
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function BudgetDashboard({ initialBudgets, arts, overviewData, billingIntegrations }: Props) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();

  const artMap = new Map(arts.map((a) => [a.id, a.name]));

  // Consolidated totals per period
  const periodTotals = Array.from(
    budgets.reduce((map, b) => {
      const existing = map.get(b.period) ?? { amount: 0, spent: 0 };
      return map.set(b.period, {
        amount: existing.amount + b.amount,
        spent: existing.spent + b.spent,
      });
    }, new Map<string, { amount: number; spent: number }>())
  ).sort(([a], [b]) => b.localeCompare(a));

  const overGuardrailCount = budgets.filter((b) => b.isOverGuardrail).length;
  const approachingGuardrailBudgets = budgets.filter(
    (b) => !b.isOverGuardrail && b.percentUsed >= 75
  );

  function handleDelete(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    startTransition(() => { void deleteLeanBudget(id); });
  }

  function handleUpdateSpent(id: string, spent: number) {
    setBudgets((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const percentUsed = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
        return { ...b, spent, percentUsed, isOverGuardrail: percentUsed > 80 };
      })
    );
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.amount || !form.period.trim()) return;
    const amount = parseFloat(form.amount);
    if (Number.isNaN(amount) || amount <= 0) return;

    const capex = parseFloat(form.capex) || 0;
    const opex = parseFloat(form.opex) || 0;
    const guardrails = (capex > 0 || opex > 0) ? { capex, opex } : undefined;

    const optimistic: LeanBudgetWithUsage = {
      id: `tmp-${Date.now()}`,
      name: form.name,
      amount,
      spent: 0,
      period: form.period,
      artId: form.artId || null,
      guardrails: guardrails ?? null,
      percentUsed: 0,
      isOverGuardrail: false,
      isOverBudget: false,
      isNearLimit: false,
      tenantId: "",
      themeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setBudgets((prev) => [optimistic, ...prev]);
    setForm(DEFAULT_FORM);
    setDialogOpen(false);

    startTransition(() => {
      void createLeanBudget({
        name: form.name,
        amount,
        period: form.period,
        artId: form.artId || undefined,
        guardrails,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* FinOps overview: KPI cards, unmapped banner, empty state */}
      <FinOpsSection overviewData={overviewData} billingIntegrations={billingIntegrations} />

      {/* Guardrail alert banners */}
      {overGuardrailCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <ShieldAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {overGuardrailCount} budget{overGuardrailCount > 1 ? "s" : ""} com guardrail violado
            </p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
              {budgets
                .filter((b) => b.isOverGuardrail)
                .map((b) => b.name)
                .join(", ")} — revise alocações e obtenha aprovação do LPM.
            </p>
          </div>
        </div>
      )}
      {approachingGuardrailBudgets.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <BellIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {approachingGuardrailBudgets.length} budget{approachingGuardrailBudgets.length > 1 ? "s" : ""} se aproximando do guardrail (≥75%)
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              {approachingGuardrailBudgets
                .map((b) => `${b.name} (${b.percentUsed}%)`)
                .join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Budgets</p>
            <p className="text-2xl font-bold">{budgets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Alocado</p>
            <p className="text-2xl font-bold">
              {formatCurrency(budgets.reduce((s, b) => s + b.amount, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Gasto</p>
            <p className="text-2xl font-bold">
              {formatCurrency(budgets.reduce((s, b) => s + b.spent, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Alertas Guardrail</p>
            <p className={`text-2xl font-bold ${overGuardrailCount > 0 ? "text-orange-600" : "text-green-600"}`}>
              {overGuardrailCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {budgets.length} budget{budgets.length !== 1 && "s"}
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-1.5" /> Novo Budget
        </Button>
      </div>

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <WalletIcon className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-sm">Nenhum budget configurado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure budgets por ART e período para acompanhar gastos com guardrails Lean.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-1.5" /> Criar Budget
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              artName={budget.artId ? artMap.get(budget.artId) : undefined}
              onDelete={handleDelete}
              onUpdateSpent={handleUpdateSpent}
            />
          ))}
        </div>
      )}

      {/* Consolidated table by period */}
      {periodTotals.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Consolidado por Período</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Total Alocado</TableHead>
                <TableHead className="text-right">Total Gasto</TableHead>
                <TableHead className="text-right">Utilização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodTotals.map(([period, totals]) => {
                const pct = totals.amount > 0
                  ? Math.min(100, Math.round((totals.spent / totals.amount) * 100))
                  : 0;
                return (
                  <TableRow key={period}>
                    <TableCell className="font-medium">{period}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(totals.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(totals.spent)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-mono font-semibold ${pct >= 80 ? "text-orange-600" : "text-green-600"}`}>
                        {pct}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lean Budget</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: Q1 2026 - ART Platform"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Valor Total (R$)</Label>
                <Input
                  type="number"
                  placeholder="1000000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Período</Label>
                <Input
                  placeholder="Ex: 2026-Q1"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                />
              </div>
            </div>
            {arts.length > 0 && (
              <div className="grid gap-1">
                <Label>ART (opcional)</Label>
                <Select
                  value={form.artId || "none"}
                  onValueChange={(v) => setForm({ ...form, artId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar ART" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {arts.map((art) => (
                      <SelectItem key={art.id} value={art.id}>
                        {art.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Guardrails */}
            <div className="rounded-md border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Guardrails (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">CapEx (%)</Label>
                  <Input
                    type="number"
                    placeholder="40"
                    value={form.capex}
                    onChange={(e) => setForm({ ...form, capex: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">OpEx (%)</Label>
                  <Input
                    type="number"
                    placeholder="60"
                    value={form.opex}
                    onChange={(e) => setForm({ ...form, opex: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !form.name.trim() || !form.amount || !form.period.trim()}
            >
              Criar Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
