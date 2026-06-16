"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
  BellIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import type { BudgetOverviewItem } from "@/app/actions/billing/snapshots";
import {
  createLeanBudget,
  deleteLeanBudget,
  updateLeanBudget,
} from "@/app/actions/lean-budget";
import type { LeanBudgetWithUsage } from "@/app/actions/lean-budget/schema";
import { FinOpsSection } from "./finops-section";

// ─── Types ───────────────────────────────────────────────────────────────────

type ARTOption = { id: string; name: string };

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
  overviewData: BudgetOverviewItem[];
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
  if (pct >= 90) {
    return "[&>div]:bg-red-500";
  }
  if (pct >= 80) {
    return "[&>div]:bg-orange-500";
  }
  if (pct >= 60) {
    return "[&>div]:bg-yellow-500";
  }
  return "[&>div]:bg-green-500";
}

function cardBorderClass(
  isOverGuardrail: boolean,
  isApproaching: boolean
): string {
  if (isOverGuardrail) {
    return "border-red-300 dark:border-red-700";
  }
  if (isApproaching) {
    return "border-amber-300 dark:border-amber-700";
  }
  return "";
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
  const [localSpent, setLocalSpent] = useState(
    String(budget.spentDecimal ?? 0)
  );
  const [_isPending, startTransition] = useTransition();

  function handleSaveSpent() {
    const val = Number.parseFloat(localSpent);
    if (!Number.isNaN(val) && val >= 0) {
      onUpdateSpent(budget.id, val);
      startTransition(() => {
        updateLeanBudget(budget.id, { spent: val }).catch(() => {});
      });
    }
    setEditingSpent(false);
  }

  const isApproaching = !budget.isOverGuardrail && budget.percentUsed >= 75;

  return (
    <Card className={cardBorderClass(budget.isOverGuardrail, isApproaching)}>
      <CardHeader className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate font-semibold text-sm">
              {budget.name}
            </CardTitle>
            <div className="mt-1 flex items-center gap-2">
              {Boolean(artName) && (
                <Badge className="text-xs" variant="secondary">
                  {artName}
                </Badge>
              )}
              <span className="text-muted-foreground text-xs">
                {budget.period}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {Boolean(budget.isOverGuardrail) && (
              <ShieldAlertIcon
                aria-label="Guardrail violado"
                className="h-4 w-4 text-red-500"
              />
            )}
            {Boolean(isApproaching) && (
              <BellIcon
                aria-label="Aproximando guardrail"
                className="h-4 w-4 text-amber-500"
              />
            )}
            <button
              aria-label="Excluir budget"
              className="text-muted-foreground transition-colors hover:text-destructive"
              onClick={() => onDelete(budget.id)}
              type="button"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        {/* Progress */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Utilização</span>
            <span
              className={`font-mono font-semibold text-xs ${budget.percentUsed >= 80 ? "text-orange-600" : "text-foreground"}`}
            >
              {budget.percentUsed}%
            </span>
          </div>
          <Progress
            className={`h-2 ${progressColor(budget.percentUsed)}`}
            value={budget.percentUsed}
          />
        </div>

        {/* Spent / Total */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Gasto</p>
            {editingSpent ? (
              <div className="mt-0.5 flex items-center gap-1">
                <Input
                  autoFocus
                  className="h-6 w-24 text-xs"
                  onChange={(e) => setLocalSpent(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveSpent()}
                  type="number"
                  value={localSpent}
                />
                <Button
                  className="h-6 px-2 text-xs"
                  onClick={handleSaveSpent}
                  size="sm"
                >
                  OK
                </Button>
              </div>
            ) : (
              <button
                className="font-semibold transition-colors hover:text-primary"
                onClick={() => setEditingSpent(true)}
                type="button"
              >
                {formatCurrency(budget.spentDecimal ?? 0)}
              </button>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold">{formatCurrency(budget.amount)}</p>
          </div>
        </div>

        {/* Guardrails */}
        {budget.guardrails !== null && budget.guardrails !== undefined && (
          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
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

        {Boolean(budget.isOverGuardrail) && (
          <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-800 dark:bg-red-950/30">
            <ShieldAlertIcon className="h-3.5 w-3.5 shrink-0 text-red-600" />
            <p className="text-red-700 text-xs dark:text-red-300">
              Guardrail violado — requer aprovação LPM.
            </p>
          </div>
        )}
        {Boolean(isApproaching) && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-800 dark:bg-amber-950/30">
            <BellIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-amber-700 text-xs dark:text-amber-300">
              {budget.percentUsed}% utilizado — monitorar consumo.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function BudgetDashboard({
  initialBudgets,
  arts,
  overviewData,
  billingIntegrations,
}: Props) {
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
        spent: existing.spent + (b.spentDecimal ?? 0),
      });
    }, new Map<string, { amount: number; spent: number }>())
  ).sort(([a], [b]) => {
    if (a < b) {
      return 1;
    }
    if (a > b) {
      return -1;
    }
    return 0;
  });

  const overGuardrailCount = budgets.filter((b) => b.isOverGuardrail).length;
  const approachingGuardrailBudgets = budgets.filter(
    (b) => !b.isOverGuardrail && b.percentUsed >= 75
  );

  function handleDelete(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    startTransition(() => {
      deleteLeanBudget(id).catch(() => {});
    });
  }

  function handleUpdateSpent(id: string, spent: number) {
    setBudgets((prev) =>
      prev.map((b) => {
        if (b.id !== id) {
          return b;
        }
        const percentUsed =
          b.amount > 0
            ? Math.min(100, Math.round((spent / b.amount) * 100))
            : 0;
        return {
          ...b,
          spentDecimal: spent,
          percentUsed,
          isOverGuardrail: percentUsed > 80,
        };
      })
    );
  }

  function handleCreate() {
    if (!(form.name.trim() && form.amount && form.period.trim())) {
      return;
    }
    const amount = Number.parseFloat(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      return;
    }

    const capex = Number.parseFloat(form.capex) || 0;
    const opex = Number.parseFloat(form.opex) || 0;
    const guardrails = capex > 0 || opex > 0 ? { capex, opex } : undefined;

    const optimistic: LeanBudgetWithUsage = {
      id: `tmp-${Date.now()}`,
      name: form.name,
      amount,
      spentDecimal: null,
      period: form.period,
      artId: form.artId || null,
      guardrails: guardrails ?? null,
      percentUsed: 0,
      isOverGuardrail: false,
      isOverBudget: false,
      isNearLimit: false,
      tenantId: "",
      themeId: null,
      spentSource: "manual",
      spentManualOverride: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeanBudgetWithUsage;

    setBudgets((prev) => [optimistic, ...prev]);
    setForm(DEFAULT_FORM);
    setDialogOpen(false);

    startTransition(() => {
      createLeanBudget({
        name: form.name,
        amount,
        period: form.period,
        artId: form.artId || undefined,
        guardrails,
      }).catch(() => {});
    });
  }

  return (
    <div className="space-y-6">
      {/* FinOps overview: KPI cards, unmapped banner, empty state */}
      <FinOpsSection
        billingIntegrations={billingIntegrations}
        overviewData={overviewData}
      />

      {/* Guardrail alert banners */}
      {overGuardrailCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          <ShieldAlertIcon
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
          />
          <div className="min-w-0">
            <p className="font-semibold text-red-800 text-sm dark:text-red-300">
              {overGuardrailCount} budget{overGuardrailCount > 1 ? "s" : ""} com
              guardrail violado
            </p>
            <p className="mt-0.5 text-red-700 text-xs dark:text-red-400">
              {budgets
                .filter((b) => b.isOverGuardrail)
                .map((b) => b.name)
                .join(", ")}{" "}
              — revise alocações e obtenha aprovação do LPM.
            </p>
          </div>
        </div>
      )}
      {approachingGuardrailBudgets.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <BellIcon
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div className="min-w-0">
            <p className="font-semibold text-amber-800 text-sm dark:text-amber-300">
              {approachingGuardrailBudgets.length} budget
              {approachingGuardrailBudgets.length > 1 ? "s" : ""} se aproximando
              do guardrail (≥75%)
            </p>
            <p className="mt-0.5 text-amber-700 text-xs dark:text-amber-400">
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
            <p className="text-muted-foreground text-xs">Total Budgets</p>
            <p className="font-bold text-2xl">{budgets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Total Alocado</p>
            <p className="font-bold text-2xl">
              {formatCurrency(budgets.reduce((s, b) => s + b.amount, 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Total Gasto</p>
            <p className="font-bold text-2xl">
              {formatCurrency(
                budgets.reduce((s, b) => s + (b.spentDecimal ?? 0), 0)
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs">Alertas Guardrail</p>
            <p
              className={`font-bold text-2xl ${overGuardrailCount > 0 ? "text-orange-600" : "text-green-600"}`}
            >
              {overGuardrailCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {budgets.length} budget{budgets.length !== 1 && "s"}
        </p>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <PlusIcon className="mr-1.5 h-4 w-4" /> Novo Budget
        </Button>
      </div>

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <WalletIcon className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-sm">Nenhum budget configurado</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Configure budgets por ART e período para acompanhar gastos com
              guardrails Lean.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <PlusIcon className="mr-1.5 h-4 w-4" /> Criar Budget
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard
              artName={artMap.get(budget.artId ?? "") ?? undefined}
              budget={budget}
              key={budget.id}
              onDelete={handleDelete}
              onUpdateSpent={handleUpdateSpent}
            />
          ))}
        </div>
      )}

      {/* Consolidated table by period */}
      {periodTotals.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-border border-b px-4 py-3">
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Consolidado por Período</h3>
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
                const pct =
                  totals.amount > 0
                    ? Math.min(
                        100,
                        Math.round((totals.spent / totals.amount) * 100)
                      )
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
                      <span
                        className={`font-mono font-semibold text-xs ${pct >= 80 ? "text-orange-600" : "text-green-600"}`}
                      >
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
      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lean Budget</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label>Nome</Label>
              <Input
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Q1 2026 - ART Platform"
                value={form.name}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Valor Total (R$)</Label>
                <Input
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="1000000"
                  type="number"
                  value={form.amount}
                />
              </div>
              <div className="grid gap-1">
                <Label>Período</Label>
                <Input
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="Ex: 2026-Q1"
                  value={form.period}
                />
              </div>
            </div>
            {arts.length > 0 && (
              <div className="grid gap-1">
                <Label>ART (opcional)</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, artId: v === "none" ? "" : (v ?? "") })
                  }
                  value={form.artId || "none"}
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
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="font-medium text-muted-foreground text-xs">
                Guardrails (opcional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">CapEx (%)</Label>
                  <Input
                    className="h-8 text-xs"
                    onChange={(e) =>
                      setForm({ ...form, capex: e.target.value })
                    }
                    placeholder="40"
                    type="number"
                    value={form.capex}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">OpEx (%)</Label>
                  <Input
                    className="h-8 text-xs"
                    onChange={(e) => setForm({ ...form, opex: e.target.value })}
                    placeholder="60"
                    type="number"
                    value={form.opex}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={
                isPending ||
                !form.name.trim() ||
                !form.amount ||
                !form.period.trim()
              }
              onClick={handleCreate}
            >
              Criar Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
