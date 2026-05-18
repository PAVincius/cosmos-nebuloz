"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalRequestWithSteps } from "@/app/actions/governance";
import type { LeanBudgetWithStats } from "@/app/actions/lean-budget";
import { reviewStep, cancelApprovalRequest } from "@/app/actions/governance";

const STEP_ESTADO_LABELS: Record<string, { label: string; class: string }> = {
  pending:  { label: "Pendente",  class: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Aprovado",  class: "bg-green-100 text-green-800"   },
  rejected: { label: "Rejeitado", class: "bg-red-100 text-red-800"       },
  skipped:  { label: "Ignorado",  class: "bg-slate-100 text-slate-600"   },
};

const REQUEST_ESTADO_LABELS: Record<string, string> = {
  open:      "Aberto",
  in_review: "Em Revisão",
  approved:  "Aprovado",
  rejected:  "Rejeitado",
  cancelled: "Cancelado",
};

type Props = {
  request: ApprovalRequestWithSteps;
  budgets: LeanBudgetWithStats[];
};

export function ApprovalDetail({ request, budgets }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pendingStep = request.steps.find((s) => s.estado === "pending") ?? null;
  const isActive = request.estado === "open" || request.estado === "in_review";

  function handleReview(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      if (!pendingStep) return;
      const result = await reviewStep({
        stepId: pendingStep.id,
        decision,
        comentario: comentario.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/portfolio/governance");
    });
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelApprovalRequest(request.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/portfolio/governance");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            {request.epicTitle ?? request.targetId}
          </h1>
          <p className="text-sm text-muted-foreground">{request.workflowNome}</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-sm font-medium">
          {REQUEST_ESTADO_LABELS[request.estado] ?? request.estado}
        </span>
      </div>

      {/* Steps timeline */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Etapas de Aprovação
        </h2>
        <ol className="space-y-3">
          {request.steps.map((step) => {
            const badge = STEP_ESTADO_LABELS[step.estado] ?? { label: step.estado, class: "bg-slate-100" };
            return (
              <li key={step.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {step.etapaOrdem}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">
                      {step.roleRequired}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>
                  {step.comentario && (
                    <p className="mt-0.5 text-xs text-muted-foreground">"{step.comentario}"</p>
                  )}
                  {step.timestamp && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(step.timestamp).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Budget context */}
      {budgets.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Contexto de Budget
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {budgets.slice(0, 4).map((b) => (
              <div key={b.id} className="rounded bg-muted/50 p-3 text-sm">
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.period}</p>
                <div className="mt-1 flex justify-between text-xs">
                  <span>Gasto: R$ {b.spent.toLocaleString("pt-BR")}</span>
                  <span className={b.isNearLimit ? "font-bold text-red-600" : ""}>
                    {b.percentUsed.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full ${b.isOverBudget ? "bg-red-500" : b.isNearLimit ? "bg-orange-400" : "bg-green-500"}`}
                    style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Review form — only for active requests with pending step */}
      {isActive && pendingStep && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sua Decisão
          </h2>
          <p className="mb-3 text-sm">
            Papel requerido:{" "}
            <span className="font-semibold capitalize">{pendingStep.roleRequired}</span>
          </p>
          <textarea
            className="mb-3 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Justificativa (opcional)"
            rows={3}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => handleReview("approved")}
              disabled={isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Aprovar
            </button>
            <button
              onClick={() => handleReview("rejected")}
              disabled={isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Rejeitar
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancelar request
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
