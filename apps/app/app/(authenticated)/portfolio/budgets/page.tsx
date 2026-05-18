import { getLeanBudgets } from "@/app/actions/lean-budget";
import { getARTs } from "@/app/actions/arts/get-arts";
import { BudgetDashboard } from "./components/budget-dashboard";

export const metadata = {
  title: "Lean Budget - COSMOS",
  description: "Gestão de orçamento Lean por ART com guardrails CapEx/OpEx",
};

export default async function LeanBudgetPage() {
  const [budgets, rawArts] = await Promise.all([getLeanBudgets(), getARTs()]);
  const arts = rawArts.map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lean Budget</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Controle de orçamento por ART e período com guardrails CapEx/OpEx.
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <BudgetDashboard initialBudgets={budgets} arts={arts} />
      </div>
    </div>
  );
}
