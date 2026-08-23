"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  IconButton,
  KpiCard,
  PageHeader,
  SectionCard,
  type Tone,
  useNav,
} from "@repo/design-system/cosmos/kit";
// governance.tsx — Governance Board, wired to listGovernedEpics(). Lists real
// GovernedEpic rows with status + investment estimate. Gate policy editing is
// wired via GovernancePolicyModal (upserts ApprovalWorkflow by tenantId+tipo).
// Gate review (approve/reject the current pending ApprovalStepInstance) is
// wired via GateReviewModal, which reuses the existing reviewStep/
// getApprovalRequest actions (no new mutation — see epic-detail-client.tsx's
// decide() for the reference flow this mirrors). The per-epic Gate Detail
// page (RF-2.18) is now wired at screens/gate.tsx — each row below links to
// it via navigate("gate", g.epicId). The KPI row (3 of the handoff's 4 —
// see listGovernedEpics's comment on the omitted "tempo médio no gate") and
// the per-row gate-stage dots are computed server-side from the same
// listGovernedEpics query, no extra fetch per row.
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  type GovernanceGateStepView,
  type GovernedEpicView,
  type ListGovernedEpicsResult,
  listGovernedEpics,
  upsertApprovalWorkflow,
} from "@/app/(cosmos)/actions/governance";
import { getApprovalRequest, reviewStep } from "@/app/actions/governance";
import type { ApprovalRequestWithSteps } from "@/app/actions/governance/schema";
import {
  ModalCard,
  ModalProvider,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import {
  DirtyProvider,
  FormField,
  Segmented,
  Select,
  TextInput,
} from "../modal-form";
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

const ROLE_SELECT_OPTIONS = ROLE_OPTIONS.map((role) => ({
  label: role,
  value: role,
}));

// Cada tipo de gate governa uma coisa diferente — dar cor ao modal é o que
// diferencia "aprovar investimento" de "mexer em guardrail" antes de ler.
const TIPO_TONE: Record<string, string> = {
  epic_investment: "accent",
  budget_guardrail_change: "amber",
  theme_creation: "purple",
};

const ATIVO_OPTIONS = [
  { label: "Ativa", value: "sim" },
  { label: "Inativa", value: "nao" },
];

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

const rotuloOculto: CSSProperties = {
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
};

function GovernancePolicyModal({ onSaved }: { onSaved?: () => void }) {
  const { close } = useModal();
  const [tipo, setTipo] = useState(TIPO_OPTIONS[0].value);
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [steps, setSteps] = useState<GateStepDraft[]>([
    { roleRequired: "STE", slaDays: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

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

  const tone = TIPO_TONE[tipo] ?? "accent";
  const tipoLabel = TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo;

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

  useModalSubmitShortcut(save, !saving);

  return (
    <DirtyProvider value={{ markDirty: () => setDirty(true) }}>
      <ModalCard
        footer={
          confirmandoSaida ? (
            <>
              <span style={{ color: "var(--ink-subtle)", fontSize: 12.5 }}>
                Descartar o que você preencheu?
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => setConfirmandoSaida(false)}
                  size="sm"
                  variant="secondary"
                >
                  Continuar editando
                </Button>
                <Button onClick={close} size="sm" variant="secondary">
                  Descartar
                </Button>
              </div>
            </>
          ) : (
            <>
              <ModalShortcutHint salvar="salvar" />
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => {
                    // Confirma só quando há o que perder.
                    if (dirty) {
                      setConfirmandoSaida(true);
                      return;
                    }
                    close();
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button icon="check" onClick={save} size="sm" variant="primary">
                  {saving ? "Salvando..." : "Salvar política"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="shield" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Gate de aprovação de um tipo de decisão — quem aprova, em que ordem, em quantos dias"
        title="Nova política de gate"
        tone={tone}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${tone}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <span
                  className="mono"
                  style={{ color: "var(--ink-faint)", fontSize: 10.5 }}
                >
                  {tipoLabel}
                </span>
                <Badge dot tone={ativo ? "green" : "neutral"}>
                  {ativo ? "ativa" : "inativa"}
                </Badge>
              </div>
              <div
                className="display"
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: 14,
                }}
              >
                {nome || "Nome do gate"}
              </div>

              <div
                style={{
                  color: "var(--ink-faint)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".06em",
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                {`Etapas (${steps.length})`}
              </div>
              {steps.length === 0 ? (
                <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                  Sem etapa nenhuma o gate não bloqueia nada
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {steps.map((step, index) => (
                    <div
                      key={`preview-step-${index}`}
                      style={{
                        alignItems: "center",
                        display: "flex",
                        fontSize: 12,
                        gap: 8,
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          background: `var(--${tone}-soft)`,
                          borderRadius: 99,
                          color: `var(--${tone}-text)`,
                          display: "grid",
                          flexShrink: 0,
                          fontSize: 10.5,
                          fontWeight: 700,
                          height: 18,
                          placeItems: "center",
                          width: 18,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                        {step.roleRequired}
                      </span>
                      <span
                        style={{ color: "var(--ink-faint)", fontSize: 11.5 }}
                      >
                        {step.slaDays.trim()
                          ? `SLA ${step.slaDays}d`
                          : "sem SLA"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          }
        >
          <FormField label="Tipo de decisão">
            <Select onChange={setTipo} options={TIPO_OPTIONS} value={tipo} />
          </FormField>

          <FormField label="Nome do gate" required>
            <TextInput
              onChange={setNome}
              placeholder="ex: Aprovação de Épico de Portfólio"
              required
              value={nome}
            />
          </FormField>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  color: "var(--ink-subtle)",
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                Etapas de aprovação
                <span style={{ color: "var(--red-text)" }}> *</span>
              </span>
              <Button
                icon="plus"
                onClick={addStep}
                size="sm"
                variant="secondary"
              >
                Etapa
              </Button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {steps.map((step, index) => (
                // Rascunho ordenado sem id estável: a posição é a identidade
                // da etapa até ela existir no banco.
                <div
                  key={`step-${index}`}
                  style={{
                    alignItems: "center",
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderRadius: "var(--r-md)",
                    display: "flex",
                    gap: 8,
                    padding: "8px 10px",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      color: "var(--ink-faint)",
                      flexShrink: 0,
                      fontSize: 11.5,
                      width: 18,
                    }}
                  >
                    {index + 1}
                  </span>
                  {/* O rótulo some da tela mas não do leitor de tela: a linha
                      só se explica pela posição, e "select sem nome" é o que
                      o teclado ouviria sem ele. */}
                  <label style={{ flex: 1, minWidth: 0 }}>
                    <span style={rotuloOculto}>
                      {`Papel requerido na etapa ${index + 1}`}
                    </span>
                    <Select
                      onChange={(v) => updateStep(index, { roleRequired: v })}
                      options={ROLE_SELECT_OPTIONS}
                      value={step.roleRequired}
                    />
                  </label>
                  <label style={{ flexShrink: 0, width: 110 }}>
                    <span style={rotuloOculto}>
                      {`SLA em dias da etapa ${index + 1}`}
                    </span>
                    <TextInput
                      onChange={(v) => updateStep(index, { slaDays: v })}
                      placeholder="SLA (dias)"
                      type="number"
                      value={step.slaDays}
                    />
                  </label>
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

          <FormField
            hint="Uma política inativa fica registrada mas não bloqueia decisão nenhuma"
            label="Situação"
          >
            <Segmented
              onChange={(v) => setAtivo(v === "sim")}
              options={ATIVO_OPTIONS}
              tone={tone}
              value={ativo ? "sim" : "nao"}
            />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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

const GATE_STEP_TONE: Record<string, Tone> = {
  pending: "accent",
  approved: "green",
  rejected: "red",
  skipped: "neutral",
};

// Compact per-row gate-stage indicator — one dot per ApprovalStepInstance
// of the epic's current gate, tone-coded by estado. Reuses the same
// estado→tone vocabulary as gate-detail-client.tsx's StepRow, just
// collapsed to a dot instead of a full stepper card.
function GateStageDots({ steps }: { steps: GovernanceGateStepView[] }) {
  if (steps.length === 0) {
    return (
      <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
        Sem gate ativo
      </span>
    );
  }
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 4 }}
      title={steps.map((s) => `${s.roleRequired}: ${s.estado}`).join(" · ")}
    >
      {steps.map((s) => (
        <span
          key={s.etapaOrdem}
          style={{
            width: 9,
            height: 9,
            borderRadius: 99,
            flexShrink: 0,
            background: `var(--${GATE_STEP_TONE[s.estado] ?? "neutral"})`,
          }}
        />
      ))}
    </div>
  );
}

const EMPTY_RESULT: ListGovernedEpicsResult = {
  epics: [],
  kpis: { totalUnderGovernance: 0, awaitingDecision: 0, investmentInReview: 0 },
};

function GovernanceBody() {
  const modal = useModal();
  const { navigate } = useNav();
  const [result, setResult] = useState<ListGovernedEpicsResult>(EMPTY_RESULT);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listGovernedEpics().then((r) => {
      if (r.ok) {
        setResult(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { epics, kpis } = result;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Governança"
        meta={<Badge tone="accent">{epics.length} épicos</Badge>}
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
      {/* KPI row — 3 of the handoff's 4 KPIs. "Tempo médio no gate" is
          omitted: GovernedEpic.submittedAt is never written by any action
          in this codebase, so a submittedAt→decision average would be an
          average over nulls, not a real metric. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        <KpiCard
          hint="lean portfolio mgmt"
          icon="shield"
          label="Épicos sob governança"
          tone="accent"
          value={kpis.totalUnderGovernance}
        />
        <KpiCard
          hint="em gate de revisão"
          icon="clock"
          label="Aguardando decisão"
          tone="amber"
          value={kpis.awaitingDecision}
        />
        <KpiCard
          hint="épicos em revisão"
          icon="dollar"
          label="Investimento em revisão"
          tone="blue"
          unit="USD"
          value={kpis.investmentInReview}
        />
      </div>
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="shield"
        title="Épicos em governança"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && epics.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum épico em governança.
            </span>
          )}
          {epics.map((g) => (
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
              <GateStageDots steps={g.gateSteps} />
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
