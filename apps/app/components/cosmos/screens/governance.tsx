"use client";

// governance.tsx — Governance Board, wired to listGovernedEpics(). Lists real
// GovernedEpic rows with status + investment estimate. Gate policy editing is
// wired via GovernancePolicyModal (upserts ApprovalWorkflow by tenantId+tipo).
// Gate review (approve/reject the current pending ApprovalStepInstance) is
// wired via GateReviewModal, which reuses the existing reviewStep/
// getApprovalRequest actions (no new mutation — see epic-detail-client.tsx's
// decide() for the reference flow this mirrors). The per-epic Gate Detail
// page (RF-2.18) is now wired at screens/gate.tsx — each row below links to
// it via navigate("gate", g.epicId).
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  type GovernedEpicView,
  listGovernedEpics,
  upsertApprovalWorkflow,
} from "@/app/(cosmos)/actions/governance";
import { getApprovalRequest, reviewStep } from "@/app/actions/governance";
import type { ApprovalRequestWithSteps } from "@/app/actions/governance/schema";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  ErrorState,
  IconButton,
  PageHeader,
  SectionCard,
  useNav,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

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

const TIPO_OPTIONS: { value: string; label: string }[] = [
  { value: "epic_investment", label: "Investimento em Épico" },
  { value: "budget_guardrail_change", label: "Mudança de Guardrail de Budget" },
  { value: "theme_creation", label: "Criação de Tema" },
];

const ROLE_OPTIONS = ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"];

type GateStepDraft = {
  roleRequired: string;
  slaDays: string;
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
};

const selectStyle: CSSProperties = inputStyle;

function GovernancePolicyModal({ onSaved }: { onSaved?: () => void }) {
  const { close } = useModal();
  const [tipo, setTipo] = useState(TIPO_OPTIONS[0].value);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [steps, setSteps] = useState<GateStepDraft[]>([
    { roleRequired: "STE", slaDays: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const addStep = () => {
    setSteps((prev) => [...prev, { roleRequired: "STE", slaDays: "" }]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, patch: Partial<GateStepDraft>) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...patch } : step))
    );
  };

  const save = async () => {
    if (!nome.trim() || steps.length === 0 || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        upsertApprovalWorkflow({
          tipo: tipo as
            | "epic_investment"
            | "budget_guardrail_change"
            | "theme_creation",
          nome: nome.trim(),
          ativo,
          etapas: steps.map((step, order) => ({
            order,
            roleRequired: step.roleRequired as
              | "ADMIN"
              | "STE"
              | "RTE"
              | "SM"
              | "PO"
              | "DEV"
              | "MEMBER",
            slaDays: step.slaDays.trim() ? Number(step.slaDays) : undefined,
          })),
        }),
      {
        loading: "Salvando política de gate...",
        success: "Política de gate salva.",
        error: (err: string) => `Não foi possível salvar a política: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onSaved?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="shield" size={16} strokeWidth={2.4} />}
      subtitle="Definir o gate de aprovação (etapas e papéis) para um tipo de decisão"
      title="Nova política de gate"
      width={520}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="gate-tipo" style={fieldLabelStyle}>
            Tipo
          </label>
          <select
            id="gate-tipo"
            onChange={(e) => setTipo(e.target.value)}
            style={selectStyle}
            value={tipo}
          >
            {TIPO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="gate-nome" style={fieldLabelStyle}>
            Nome do gate
          </label>
          <input
            id="gate-nome"
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Aprovação de Épico de Portfólio"
            style={inputStyle}
            value={nome}
          />
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={fieldLabelStyle}>Etapas de aprovação</span>
            <Button icon="plus" onClick={addStep} size="sm" variant="secondary">
              Etapa
            </Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((step, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: steps are an ordered, position-addressed draft list with no stable id
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--hairline)",
                  background: "var(--surface)",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-faint)",
                    width: 18,
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>
                <select
                  aria-label={`Papel requerido na etapa ${index + 1}`}
                  onChange={(e) =>
                    updateStep(index, { roleRequired: e.target.value })
                  }
                  style={{ ...selectStyle, flex: 1 }}
                  value={step.roleRequired}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`SLA em dias da etapa ${index + 1}`}
                  min={0}
                  onChange={(e) =>
                    updateStep(index, { slaDays: e.target.value })
                  }
                  placeholder="SLA (dias)"
                  style={{ ...inputStyle, width: 110 }}
                  type="number"
                  value={step.slaDays}
                />
                <IconButton
                  name="x"
                  onClick={() => removeStep(index)}
                  size={30}
                  title="Remover etapa"
                />
              </div>
            ))}
          </div>
        </div>

        <label
          htmlFor="gate-ativo"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--ink-muted)",
          }}
        >
          <input
            checked={ativo}
            id="gate-ativo"
            onChange={(e) => setAtivo(e.target.checked)}
            type="checkbox"
          />
          Ativo
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={save} size="sm" variant="primary">
            Salvar política
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

// GateReviewModal — decides the current pending ApprovalStepInstance for a
// GovernedEpic row. Reuses the existing reviewStep/getApprovalRequest
// actions (story-016); Epic.lifecycleStatus / GovernedEpic.governanceStatus
// updates are handled entirely by reviewStep, not by this component.
function GateReviewModal({
  governedEpic,
  onDecided,
}: {
  governedEpic: GovernedEpicView;
  onDecided?: () => void;
}) {
  const { close } = useModal();
  const [approval, setApproval] = useState<ApprovalRequestWithSteps | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const requestId = governedEpic.currentApprovalRequestId;
    if (!requestId) {
      setLoading(false);
      return;
    }
    let active = true;
    getApprovalRequest(requestId).then((res) => {
      if (active) {
        if (res.ok) {
          setApproval(res.data);
        }
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [governedEpic.currentApprovalRequestId]);

  const pendingStep =
    approval?.steps.find((s) => s.estado === "pending") ?? null;
  const rationaleMissing = decision === "rejected" && !comentario.trim();

  const submit = async () => {
    if (!pendingStep || saving || rationaleMissing) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        reviewStep({
          stepId: pendingStep.id,
          decision,
          comentario: comentario.trim() || undefined,
        }),
      {
        loading: "Registrando decisão do gate...",
        success: "Decisão do gate registrada.",
        error: (err: string) => `Não foi possível registrar a decisão: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onDecided?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="check" size={16} strokeWidth={2.4} />}
      subtitle={governedEpic.epicTitle}
      title="Revisar gate"
      width={460}
    >
      {loading && (
        <div style={{ fontSize: 13, color: "var(--ink-subtle)" }}>
          Carregando…
        </div>
      )}
      {!(loading || pendingStep) && (
        <div style={{ fontSize: 13, color: "var(--ink-subtle)" }}>
          Nenhuma etapa pendente para revisão neste momento.
        </div>
      )}
      {!loading && pendingStep && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
            {/* etapaOrdem is 0-based (see actions/governance/index.ts) — +1
                for a 1-based display label, matching gate-detail-client.tsx. */}
            Etapa {pendingStep.etapaOrdem + 1} · Papel requerido:{" "}
            {pendingStep.roleRequired}
          </div>

          <div>
            <span style={fieldLabelStyle}>Decisão</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setDecision("approved")}
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: "var(--r-md)",
                  border:
                    decision === "approved"
                      ? "1px solid var(--green)"
                      : "1px solid var(--hairline-strong)",
                  background:
                    decision === "approved"
                      ? "var(--green-soft)"
                      : "var(--surface)",
                  color:
                    decision === "approved"
                      ? "var(--green-text)"
                      : "var(--ink)",
                  cursor: "pointer",
                }}
                type="button"
              >
                Aprovar
              </button>
              <button
                onClick={() => setDecision("rejected")}
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: "var(--r-md)",
                  border:
                    decision === "rejected"
                      ? "1px solid var(--red)"
                      : "1px solid var(--hairline-strong)",
                  background:
                    decision === "rejected"
                      ? "var(--red-soft)"
                      : "var(--surface)",
                  color:
                    decision === "rejected" ? "var(--red-text)" : "var(--ink)",
                  cursor: "pointer",
                }}
                type="button"
              >
                Rejeitar
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="gate-review-comentario" style={fieldLabelStyle}>
              Justificativa {decision === "rejected" ? "" : "(opcional)"}
            </label>
            <textarea
              id="gate-review-comentario"
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Racional da decisão…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              value={comentario}
            />
            {rationaleMissing && (
              <span style={{ fontSize: 11.5, color: "var(--red-text)" }}>
                Justificativa obrigatória para rejeitar.
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button onClick={close} size="sm" variant="secondary">
              Cancelar
            </Button>
            <button
              disabled={saving || rationaleMissing}
              onClick={submit}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "7px 14px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--accent)",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                cursor: saving || rationaleMissing ? "default" : "pointer",
                opacity: saving || rationaleMissing ? 0.6 : 1,
              }}
              type="button"
            >
              {saving ? "Enviando…" : "Confirmar decisão"}
            </button>
          </div>
        </div>
      )}
    </ModalCard>
  );
}

function GovernanceBody() {
  const modal = useModal();
  const { navigate } = useNav();
  const [rows, setRows] = useState<GovernedEpicView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listGovernedEpics().then((r) => {
      if (r.ok) {
        setRows(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Governança"
        meta={<Badge tone="accent">{rows.length} épicos</Badge>}
        subtitle="Pipeline de gates de governança por épico."
        title="Governance Board"
      >
        <Button
          icon="plus"
          onClick={() => modal.open(<GovernancePolicyModal onSaved={load} />)}
          size="md"
          variant="primary"
        >
          Nova política de gate
        </Button>
      </PageHeader>
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="shield"
        title="Épicos em governança"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && rows.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum épico em governança.
            </span>
          )}
          {rows.map((g) => (
            <div
              key={g.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}
                >
                  {g.epicTitle}
                </div>
                {g.investmentEstimate !== null && (
                  <div
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
                  >
                    ${g.investmentEstimate.toLocaleString()}
                  </div>
                )}
              </div>
              <Badge tone={STATUS_TONE[g.governanceStatus] ?? "neutral"}>
                {g.governanceStatus}
              </Badge>
              <Button
                onClick={() => navigate("gate", g.epicId)}
                size="sm"
                variant="secondary"
              >
                Ver gate
              </Button>
              {g.currentApprovalRequestId && (
                <Button
                  onClick={() =>
                    modal.open(
                      <GateReviewModal governedEpic={g} onDecided={load} />
                    )
                  }
                  size="sm"
                  variant="secondary"
                >
                  Revisar gate
                </Button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function GovernanceScreen() {
  return (
    <ModalProvider>
      <GovernanceBody />
    </ModalProvider>
  );
}
