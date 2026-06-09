"use client";

import Link from "next/link";
import type {
  ApprovalRequestWithSteps,
  GovernedEpicWithDetails,
} from "@/app/actions/governance";

type Props = {
  epic: GovernedEpicWithDetails;
  request: ApprovalRequestWithSteps | null;
};

const GUARDRAIL_COLORS: Record<string, string> = {
  novo_investimento_alto:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  mudança_horizonte:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  novo_value_stream:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const DEFAULT_GUARDRAIL_COLOR =
  "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";

export function GovernanceEpicCard({ epic, request }: Props) {
  const pendingStep =
    request?.steps.find((s) => s.estado === "pending") ?? null;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3 shadow-[var(--card-shadow)]">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-tight">{epic.epicTitle}</p>
        {request !== null && (
          <Link
            className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary text-xs hover:bg-primary/20"
            href={`/portfolio/governance/${request.id}`}
          >
            Ver
          </Link>
        )}
      </div>

      {epic.investmentEstimate !== null && (
        <p className="mt-1 text-muted-foreground text-xs">
          Investimento estimado:{" "}
          <span className="font-mono">
            R$ {epic.investmentEstimate.toLocaleString("pt-BR")}
          </span>
        </p>
      )}

      {epic.guardrailFlags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {epic.guardrailFlags.map((flag) => (
            <span
              className={`rounded px-1.5 py-0.5 font-medium text-xs ${
                GUARDRAIL_COLORS[flag] ?? DEFAULT_GUARDRAIL_COLOR
              }`}
              key={flag}
            >
              {flag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {pendingStep !== null && (
        <p className="mt-2 text-amber-700 text-xs dark:text-amber-400">
          Aguardando: {pendingStep.roleRequired.toUpperCase()}
        </p>
      )}
    </div>
  );
}
