"use client";

// gate-detail-client.tsx — per-epic Governance Gate detail (RF §2.18).
// Mirrors design_handoff_cosmos_full/screen-bundle-2.jsx EpicGateScreen's
// vertical stepper + board-review banner, built over the real approval
// engine (apps/app/app/actions/governance) instead of the handoff's mock
// GOV_STAGES/GOV_EPICS.
//
// Two deliberate divergences from the handoff (kept, not papered over):
//  1. Checklist vs. single-step approval — ApprovalWorkflow.etapas carries
//     role + SLA only, no per-criterion checklist. Each stepper node here is
//     one real ApprovalStepInstance (role, SLA, state), not a checklist of
//     criteria — there is no checklist schema to fake.
//  2. Sequential vs. parallel gates — the handoff's stepper assumes stage N
//     must complete before N+1 unlocks. reviewStep() has no such ordering
//     guard: every step is created "pending" at submission time and any
//     pending step can be decided independent of the others' state. So every
//     step showing "pending" gets approve/reject controls here, not just one
//     "current" stage — rendering a locked future stage would be fiction.
import { useCallback, useEffect, useState } from "react";
import type { GovernedEpicDetail } from "@/app/(cosmos)/actions/governance";
import {
  getApprovalRequest,
  reviewStep,
  submitEpicForApproval,
} from "@/app/actions/governance";
import type { ApprovalRequestWithSteps } from "@/app/actions/governance/schema";
import { Icon } from "../icons";
import {
  Badge,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionCard,
  useNav,
} from "../kit";
import { useActionToast } from "../use-action-toast";

// Policy constant (not a modeled field) — mirrors the hardcoded
// GOVERNANCE_ROLE_MAP/DEFAULT_WORKFLOWS policy constants already in
// apps/app/app/actions/governance/index.ts. It compares against the real
// GovernedEpic.investmentEstimate; it does not fabricate that estimate.
const BOARD_REVIEW_THRESHOLD_USD = 2_000_000;

const STATUS_TONE: Record<
  string,
  "neutral" | "blue" | "green" | "red" | "amber"
> = {
  draft: "neutral",
  review: "blue",
  approved: "green",
  rejected: "red",
  on_hold: "amber",
  deferred: "amber",
};

const STEP_TONE: Record<string, "neutral" | "green" | "red" | "accent"> = {
  pending: "accent",
  approved: "green",
  rejected: "red",
  skipped: "neutral",
};

function fmtDate(d: Date | string | null): string | null {
  if (!d) {
    return null;
  }
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StepRow({
  step,
  isLast,
  reviewing,
  onDecide,
}: {
  step: ApprovalRequestWithSteps["steps"][number];
  isLast: boolean;
  reviewing: boolean;
  onDecide: (stepId: string, decision: "approved" | "rejected") => void;
}) {
  const isDone = step.estado === "approved" || step.estado === "skipped";
  const isPending = step.estado === "pending";
  const tone = STEP_TONE[step.estado] ?? "neutral";
  const slaBreached = step.slaStatus === "BREACHED";

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 32,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            background: isDone
              ? "var(--green)"
              : isPending
                ? "var(--accent-soft)"
                : "var(--surface-3)",
            border: isPending
              ? "2px solid var(--accent)"
              : "1px solid var(--hairline-strong)",
            color: isDone
              ? "#fff"
              : isPending
                ? "var(--accent)"
                : "var(--ink-faint)",
            boxShadow: isPending ? "0 0 0 4px var(--accent-soft)" : "none",
          }}
        >
          {isDone ? (
            <Icon name="check" size={15} strokeWidth={3} />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 800 }}>
              {step.etapaOrdem + 1}
            </span>
          )}
        </span>
        {!isLast && (
          <span
            style={{
              flex: 1,
              width: 2,
              minHeight: 20,
              background: isDone ? "var(--green)" : "var(--hairline-strong)",
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, marginBottom: 18 }}>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: "var(--r-lg)",
            border: isPending
              ? "1.5px solid var(--accent)"
              : "1px solid var(--hairline)",
            background: isPending ? "var(--accent-soft)" : "var(--surface)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}
              >
                {step.roleRequired}
              </span>
              <Badge tone={tone}>{step.estado}</Badge>
              {slaBreached && <Badge tone="red">SLA estourado</Badge>}
            </div>
            {step.slaDeadline && (
              <span
                style={{
                  display: "flex",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  fontWeight: 600,
                }}
              >
                <Icon name="clock" size={11} style={{ verticalAlign: -1 }} />
                SLA até {fmtDate(step.slaDeadline)}
              </span>
            )}
          </div>

          {step.timestamp && (
            <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              {step.estado === "approved" ? "Aprovado" : "Rejeitado"} em{" "}
              {fmtDate(step.timestamp)}
              {step.comentario ? ` · "${step.comentario}"` : ""}
            </div>
          )}

          {isPending && (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                disabled={reviewing}
                onClick={() => onDecide(step.id, "approved")}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--accent)",
                  background: "var(--accent)",
                  color: "var(--accent-fg)",
                  cursor: reviewing ? "default" : "pointer",
                  opacity: reviewing ? 0.6 : 1,
                }}
                type="button"
              >
                Aprovar
              </button>
              <button
                disabled={reviewing}
                onClick={() => onDecide(step.id, "rejected")}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--hairline)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  cursor: reviewing ? "default" : "pointer",
                  opacity: reviewing ? 0.6 : 1,
                }}
                type="button"
              >
                Rejeitar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GateDetailClient({
  epicId,
  initial,
}: {
  epicId: string;
  initial: GovernedEpicDetail;
}) {
  const { navigate } = useNav();
  const [data, setData] = useState(initial);
  const [approval, setApproval] = useState<ApprovalRequestWithSteps | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [reviewingStepId, setReviewingStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadApproval = useCallback(async (requestId: string) => {
    const res = await getApprovalRequest(requestId);
    if (res.ok) {
      setApproval(res.data);
    }
  }, []);

  useEffect(() => {
    if (data.currentApprovalRequestId) {
      loadApproval(data.currentApprovalRequestId);
    } else {
      setApproval(null);
    }
  }, [data.currentApprovalRequestId, loadApproval]);

  async function submitForApproval() {
    setSubmitting(true);
    setError(null);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        submitEpicForApproval({
          epicId,
          investmentEstimate: data.investmentEstimate ?? undefined,
          valueStreamId: data.valueStreamId ?? undefined,
          themeId: data.themeId ?? undefined,
          guardrailFlags: data.guardrailFlags,
        }),
      {
        loading: "Enviando épico para aprovação...",
        success: "Épico enviado para aprovação.",
        error: (err: string) =>
          `Não foi possível enviar para aprovação: ${err}`,
      }
    );
    setSubmitting(false);
    if (res.ok) {
      setData((d) => ({
        ...d,
        currentApprovalRequestId: res.data.requestId,
        governanceStatus: "review",
      }));
    } else {
      setError(res.error);
    }
  }

  async function decide(stepId: string, decision: "approved" | "rejected") {
    setReviewingStepId(stepId);
    setError(null);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => reviewStep({ stepId, decision }), {
      loading:
        decision === "approved" ? "Aprovando etapa..." : "Rejeitando etapa...",
      success: decision === "approved" ? "Etapa aprovada." : "Etapa rejeitada.",
      error: (err: string) => `Não foi possível registrar a decisão: ${err}`,
    });
    setReviewingStepId(null);
    if (res.ok && data.currentApprovalRequestId) {
      const refreshed = await getApprovalRequest(data.currentApprovalRequestId);
      if (refreshed.ok) {
        setApproval(refreshed.data);
        if (
          refreshed.data.estado === "approved" ||
          refreshed.data.estado === "rejected"
        ) {
          setData((d) => ({ ...d, governanceStatus: refreshed.data.estado }));
        }
      }
    } else if (!res.ok) {
      setError(res.error);
    }
  }

  const requiresBoardReview =
    (data.investmentEstimate ?? 0) >= BOARD_REVIEW_THRESHOLD_USD;

  return (
    <div className="fade-in">
      <button
        onClick={() => navigate("governance")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--ink-muted)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 14,
          padding: 0,
        }}
        type="button"
      >
        <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
          ‹
        </span>{" "}
        Governance Board
      </button>

      <PageHeader
        eyebrow="Governança · Gate por Épico"
        meta={
          <>
            <Badge dot tone={STATUS_TONE[data.governanceStatus] ?? "neutral"}>
              {data.governanceStatus}
            </Badge>
            {data.investmentEstimate !== null && (
              <Badge tone="blue">
                US$ {data.investmentEstimate.toLocaleString()}
              </Badge>
            )}
          </>
        }
        title={data.epicTitle}
      />

      {error && <ErrorState message={error} />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        <KpiCard
          icon="shield"
          label="Status de governança"
          tone="accent"
          value={data.governanceStatus}
        />
        <KpiCard
          icon="dollar"
          label="Investimento estimado"
          tone="blue"
          unit="USD"
          value={data.investmentEstimate ?? "—"}
        />
        <KpiCard
          icon="layers"
          label="Etapas do gate"
          tone="purple"
          value={approval?.steps.length ?? 0}
        />
      </div>

      {requiresBoardReview && (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "13px 15px",
            borderRadius: "var(--r-lg)",
            background: "var(--amber-soft)",
            border: "1px solid rgba(var(--amber-rgb),.3)",
            marginBottom: "var(--gap)",
          }}
        >
          <Icon
            name="shield"
            size={16}
            style={{ color: "var(--amber-text)", marginTop: 1, flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 12.5,
              color: "var(--ink-muted)",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "var(--ink)" }}>Atenção:</strong> este épico
            tem investimento estimado de US${" "}
            {(data.investmentEstimate ?? 0).toLocaleString()}, acima do critério
            interno de US$ {BOARD_REVIEW_THRESHOLD_USD.toLocaleString()} —
            recomenda-se revisão adicional do Portfolio Board antes de aprovar
            as etapas abaixo.
          </span>
        </div>
      )}

      {data.guardrailFlags.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: "var(--gap)",
          }}
        >
          {data.guardrailFlags.map((flag) => (
            <Badge key={flag} tone="amber">
              {flag}
            </Badge>
          ))}
        </div>
      )}

      <SectionCard
        icon="shield"
        subtitle={
          approval
            ? `${approval.workflowNome} · ${approval.estado}`
            : "Nenhuma aprovação em andamento"
        }
        title="Etapas do gate"
        tone="accent"
      >
        {!data.currentApprovalRequestId && (
          <button
            disabled={submitting}
            onClick={submitForApproval}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 14px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
            type="button"
          >
            {submitting ? "Enviando…" : "Enviar para aprovação"}
          </button>
        )}

        {approval && approval.steps.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: data.currentApprovalRequestId ? 4 : 16,
            }}
          >
            {approval.steps.map((step, i) => (
              <StepRow
                isLast={i === approval.steps.length - 1}
                key={step.id}
                onDecide={decide}
                reviewing={reviewingStepId === step.id}
                step={step}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
