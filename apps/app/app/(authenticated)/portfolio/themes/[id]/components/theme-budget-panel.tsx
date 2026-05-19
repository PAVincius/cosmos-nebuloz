"use client";

import { useState, useTransition } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
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
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  AlertTriangleIcon,
  LinkIcon,
  PlusIcon,
  WalletIcon,
} from "lucide-react";
import {
  createLeanBudget,
  linkBudgetToTheme,
  type LeanBudgetWithStats,
} from "@/app/actions/lean-budget";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  }).format(v);
}

function progressColor(pct: number): string {
  if (pct >= 90) return "[&>div]:bg-red-500";
  if (pct >= 75) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-green-500";
}

// ─── BudgetRow ────────────────────────────────────────────────────────────────

function BudgetRow({ budget }: { budget: LeanBudgetWithStats }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-medium">{budget.name}</p>
          <p className="text-xs text-muted-foreground">{budget.period}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {budget.isNearLimit && (
            <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
          )}
          <Badge
            variant="outline"
            className={`text-[10px] ${budget.isOverBudget ? "border-red-300 text-red-700" : ""}`}
          >
            {budget.percentUsed}%
          </Badge>
        </div>
      </div>
      <div className="space-y-1">
        <Progress
          value={Math.min(budget.percentUsed, 100)}
          className={`h-1.5 ${progressColor(budget.percentUsed)}`}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Gasto: {formatCurrency(budget.spent)}</span>
          <span>Total: {formatCurrency(budget.amount)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  themeId:        string;
  themeTitle:     string;
  budgetTotal:    number | null;
  linkedBudgets:  LeanBudgetWithStats[];
  allBudgets:     LeanBudgetWithStats[];
};

type CreateForm = {
  name:   string;
  amount: string;
  period: string;
  capex:  string;
  opex:   string;
};

const DEFAULT_FORM: CreateForm = { name: "", amount: "", period: "", capex: "", opex: "" };

// ─── Component ────────────────────────────────────────────────────────────────

export function ThemeBudgetPanel({ themeId, themeTitle, budgetTotal, linkedBudgets: initial, allBudgets }: Props) {
  const [budgets, setBudgets] = useState<LeanBudgetWithStats[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM);
  const [selectedToLink, setSelectedToLink] = useState("");

  const totalAllocated = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent     = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPct     = totalAllocated > 0
    ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100))
    : 0;

  const unlinkedBudgets = allBudgets.filter(
    (b) => !budgets.some((lb) => lb.id === b.id)
  );

  function handleCreate() {
    if (!form.name.trim() || !form.amount || !form.period) return;
    const amount = parseFloat(form.amount);
    if (Number.isNaN(amount) || amount <= 0) return;

    const capex = parseFloat(form.capex) || 0;
    const opex  = parseFloat(form.opex)  || 0;

    const optimistic: LeanBudgetWithStats = {
      id:            `tmp-${Date.now()}`,
      tenantId:      "",
      artId:         null,
      themeId:       themeId,
      name:          form.name,
      amount,
      spent:         0,
      period:        form.period,
      guardrails:    capex > 0 || opex > 0 ? { capex, opex } : null,
      createdAt:     new Date(),
      updatedAt:     new Date(),
      percentUsed:   0,
      isOverBudget:  false,
      isNearLimit:   false,
    };

    setBudgets((prev) => [...prev, optimistic]);
    setForm(DEFAULT_FORM);
    setCreateOpen(false);

    startTransition(async () => {
      await createLeanBudget({
        name:       form.name,
        amount,
        period:     form.period,
        themeId,
        guardrails: capex > 0 || opex > 0 ? { capex, opex } : undefined,
      });
    });
  }

  function handleLink() {
    if (!selectedToLink || selectedToLink === "none") return;
    const budget = allBudgets.find((b) => b.id === selectedToLink);
    if (!budget) return;

    setBudgets((prev) => [...prev, { ...budget, themeId }]);
    setSelectedToLink("");
    setLinkOpen(false);

    startTransition(async () => {
      await linkBudgetToTheme(selectedToLink, themeId);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {budgetTotal != null && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Budget Estratégico
            </p>
            <p className="text-base font-bold tabular-nums">{formatCurrency(budgetTotal)}</p>
          </div>
        )}
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Total Alocado
          </p>
          <p className="text-base font-bold tabular-nums">{formatCurrency(totalAllocated)}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Total Gasto
          </p>
          <p className={`text-base font-bold tabular-nums ${overallPct >= 90 ? "text-red-600" : overallPct >= 75 ? "text-amber-600" : "text-green-600"}`}>
            {formatCurrency(totalSpent)}
          </p>
        </div>
      </div>

      {totalAllocated > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">Utilização consolidada</span>
            <span className="font-mono font-semibold">{overallPct}%</span>
          </div>
          <Progress value={overallPct} className={`h-2 ${progressColor(overallPct)}`} />
        </div>
      )}

      <Separator />

      {/* Budget list */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lean Budgets associados ({budgets.length})
          </p>
          <div className="flex items-center gap-1.5">
            {unlinkedBudgets.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setLinkOpen(true)}>
                <LinkIcon className="h-3 w-3" /> Associar existente
              </Button>
            )}
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setCreateOpen(true)}>
              <PlusIcon className="h-3 w-3" /> Novo budget
            </Button>
          </div>
        </div>

        {budgets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
            <WalletIcon className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">Nenhum budget associado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crie um novo budget ou associe um existente a este tema estratégico.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {budgets.map((b) => <BudgetRow key={b.id} budget={b} />)}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lean Budget — {themeTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Q2 2026 - Tema Innovation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Total (R$) *</Label>
                <Input
                  type="number"
                  placeholder="1000000"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Período *</Label>
                <Input
                  placeholder="Ex: 2026-Q2"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                />
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Guardrails (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CapEx (%)</Label>
                  <Input
                    type="number" placeholder="40"
                    value={form.capex}
                    onChange={(e) => setForm({ ...form, capex: e.target.value })}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">OpEx (%)</Label>
                  <Input
                    type="number" placeholder="60"
                    value={form.opex}
                    onChange={(e) => setForm({ ...form, opex: e.target.value })}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !form.name.trim() || !form.amount || !form.period}
            >
              Criar Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link existing dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Associar Budget Existente</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="mb-1.5 block">Selecione um budget</Label>
            <Select value={selectedToLink} onValueChange={setSelectedToLink}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-muted-foreground">—</SelectItem>
                {unlinkedBudgets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} — {b.period} ({formatCurrency(b.amount)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleLink}
              disabled={isPending || !selectedToLink || selectedToLink === "none"}
            >
              Associar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
