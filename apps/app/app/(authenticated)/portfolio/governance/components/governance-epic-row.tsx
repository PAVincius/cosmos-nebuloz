"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { Check, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { reviewStep } from "@/app/actions/governance";
import type {
  ApprovalRequestWithSteps,
  GovernanceStatus,
  GovernedEpicWithDetails,
} from "@/app/actions/governance/schema";

/** Gate progression mirrors the board columns: Funil → Em Análise → Aprovado. */
const GATE_STAGES = ["Funil", "Em Análise", "Aprovado"] as const;

const STAGE_INDEX: Record<GovernanceStatus, number> = {
  draft: 0,
  review: 1,
  on_hold: 1,
  deferred: 1,
  rejected: 1,
  approved: 2,
};

const STATUS_BADGE: Record<
  GovernanceStatus,
  { tone: "green" | "amber" | "blue" | "red" | "neutral"; label: string }
> = {
  draft: { tone: "neutral", label: "Funil" },
  review: { tone: "amber", label: "Em revisão" },
  approved: { tone: "green", label: "Aprovado" },
  on_hold: { tone: "blue", label: "Em espera" },
  deferred: { tone: "neutral", label: "Adiado" },
  rejected: { tone: "red", label: "Rejeitado" },
};

type Props = {
  epic: GovernedEpicWithDetails;
  request: ApprovalRequestWithSteps | null;
};

export function GovernanceEpicRow({ epic, request }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pendingStep =
    request?.steps.find((s) => s.estado === "pending") ?? null;
  const canReview = epic.governanceStatus === "review" && pendingStep !== null;
  const stage = STAGE_INDEX[epic.governanceStatus];
  const status = STATUS_BADGE[epic.governanceStatus];
  const investmentLabel =
    epic.investmentEstimate !== null
      ? `R$ ${epic.investmentEstimate.toLocaleString("pt-BR")}`
      : "—";

  function handleRowClick() {
    router.push(`/epics/${epic.epicId}`);
  }

  function handleDecision(decision: "approved" | "rejected") {
    if (!pendingStep) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await reviewStep({ stepId: pendingStep.id, decision });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav handled by nested focusable controls
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only navigates, inner controls stop propagation
    <div
      className="lift flex cursor-pointer flex-col gap-2 rounded-cosmos-md border border-hairline bg-surface px-[18px] py-3.5 transition-colors hover:border-hairline-strong"
      onClick={handleRowClick}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-[11px] text-ink-subtle">
              {epic.epicId.slice(-8).toUpperCase()}
            </span>
            {epic.guardrailFlags.length > 0 && (
              <Badge tone="amber" dot>
                {epic.guardrailFlags[0].replace(/_/g, " ")}
              </Badge>
            )}
          </div>
          <div className="mt-[3px] truncate font-semibold text-[13.5px] text-ink">
            {epic.epicTitle}
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          {GATE_STAGES.map((label, i) => {
            const done = i < stage;
            const cur = i === stage;
            return (
              <Fragment key={label}>
                {i > 0 && (
                  <span
                    className="h-0.5 w-[22px]"
                    style={{
                      background:
                        done || cur
                          ? "var(--accent-c)"
                          : "var(--hairline-strong)",
                    }}
                  />
                )}
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-bold text-[11px]"
                  style={{
                    background: done
                      ? "var(--accent-c)"
                      : cur
                        ? "var(--accent-soft)"
                        : "var(--surface-3)",
                    color: done
                      ? "var(--on-accent, #fff)"
                      : cur
                        ? "var(--accent-text)"
                        : "var(--ink-faint)",
                    border: cur
                      ? "1.5px solid var(--accent-c)"
                      : done
                        ? "1px solid transparent"
                        : "1px solid var(--hairline-strong)",
                  }}
                  title={label}
                >
                  {done ? <Check size={13} strokeWidth={2.6} /> : i + 1}
                </span>
              </Fragment>
            );
          })}
        </div>

        <div className="w-24 shrink-0 text-right">
          <div className="font-mono font-bold text-[13px] text-ink">
            {investmentLabel}
          </div>
          <div className="font-semibold text-[10px] text-ink-subtle tracking-[.04em]">
            INVESTIMENTO
          </div>
        </div>

        <div className="flex w-[110px] shrink-0 justify-end">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
      </div>

      {(canReview || request) && (
        <div
          className="flex items-center justify-end gap-2 border-hairline border-t pt-2"
          // biome-ignore lint/a11y/useKeyWithClickEvents: stops navigation from bubbling to the row
          // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops propagation
          onClick={(e) => e.stopPropagation()}
        >
          {error && <p className="mr-auto text-[11px] text-red-text">{error}</p>}
          {request && (
            <Link
              className="inline-flex items-center gap-1 rounded-cosmos-sm bg-accent-soft px-2 py-1 font-semibold text-[11px] text-accent-text hover:bg-accent-soft/80"
              href={`/portfolio/governance/${request.id}`}
            >
              <ExternalLink size={12} /> Ver solicitação
            </Link>
          )}
          {canReview && (
            <>
              <button
                className="inline-flex items-center gap-1 rounded-cosmos-sm border border-hairline-strong px-2.5 py-1 font-bold text-[11px] text-green-text transition-colors hover:border-[rgba(var(--green-rgb),.4)] hover:bg-green-soft disabled:opacity-50"
                disabled={isPending}
                onClick={() => handleDecision("approved")}
                type="button"
              >
                <Check size={12} /> Aprovar
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-cosmos-sm border border-hairline-strong px-2.5 py-1 font-bold text-[11px] text-red-text transition-colors hover:border-[rgba(var(--red-rgb),.4)] hover:bg-red-soft disabled:opacity-50"
                disabled={isPending}
                onClick={() => handleDecision("rejected")}
                type="button"
              >
                <X size={12} /> Rejeitar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
