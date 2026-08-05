"use client";

// modals.tsx — os 11 modais do inventário do SRD-Charter.md.
//
// Port de `charter-screens-1/2/3.jsx` + `charter-modal.jsx`. A diferença em
// relação ao protótipo é que aqui cada CTA chama a server action de verdade.
// O que foi preservado 1:1 é a *anatomia*: ModalSplit com trilho de avaliação
// ao vivo no intake, RadioCards na decisão, CheckRow para efeitos e artefatos,
// e Callout carregando a razão na tela em vez de tooltip.

import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, Button, IconButton } from "@repo/design-system/cosmos/kit";
import { useEffect, useMemo, useState } from "react";
import {
  getComplianceMap,
  type MapRow,
  type SetRow,
} from "@/app/(charter)/actions/compliance";
import type { VersionDiff } from "@/app/(charter)/actions/policy";
import type {
  ClauseLibraryRow,
  VendorRow,
} from "@/app/(charter)/actions/vendors";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_ORDER,
  DATA_CLASS_RULE,
  DATA_CLASS_TONE,
  HITL_LABEL,
  RISK_CATEGORY_LABEL,
  recommendPath,
  type Tone,
  vendorEligibility,
} from "@/lib/charter/rules";
import { Eyebrow, MetaCell, TableHead, TableRow } from "./base";
import {
  Callout,
  CheckRow,
  FooterHint,
  FormField,
  Kbd,
  RadioCards,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from "./form-kit";
import { ModalShell, ModalSplit } from "./modal";

type DataClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
type Exposure = "INTERNAL" | "EXTERNAL";
type Criticality = "LOW" | "MEDIUM" | "HIGH";
type VendorTier = "APPROVED" | "RESTRICTED" | "REVIEW" | "BLOCKED";

const EXPOSURE_OPTS = [
  { value: "INTERNAL", label: "Interno", tone: "green" as Tone },
  { value: "EXTERNAL", label: "Externo", tone: "amber" as Tone },
];
const CRIT_OPTS = [
  { value: "LOW", label: "Baixa", tone: "green" as Tone },
  { value: "MEDIUM", label: "Média", tone: "amber" as Tone },
  { value: "HIGH", label: "Alta", tone: "red" as Tone },
];
const DATA_CLASS_OPTS = DATA_CLASS_ORDER.map((d) => ({
  value: d,
  label: DATA_CLASS_LABEL[d].split(" ")[0],
  tone: DATA_CLASS_TONE[d],
}));

/** Confirmação que só habilita quando o formulário está pronto, e explica no
 *  `title` o que falta. Esconder o botão faria o usuário procurar. */
function GatedAction({
  ready,
  reason,
  children,
}: {
  ready: boolean;
  reason?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        opacity: ready ? 1 : 0.45,
        pointerEvents: ready ? "auto" : "none",
      }}
      title={ready ? undefined : reason}
    >
      {children}
    </span>
  );
}

// ── 1. IntakeModal (FR-4) — a tela mais importante do produto ─────────────────

export type IntakeSubmit = {
  title: string;
  objective: string;
  department: string;
  ownerName: string;
  vendorId: string | null;
  dataClass: DataClass;
  exposure: Exposure;
  criticality: Criticality;
  asDraft: boolean;
};

const DEPARTMENTS = [
  "Operações",
  "CX",
  "Engenharia",
  "Clínico",
  "Growth",
  "Financeiro",
  "Legal",
  "Marketing",
];

/**
 * Avalia ANTES de submeter. O trilho da direita recalcula a cada mudança:
 * caminho de aprovação, SLA, regra da classe de dado e elegibilidade do
 * fornecedor. O requester descobre que dado de paciente vai ao Comitê com SLA
 * de 10 dias enquanto preenche, não uma semana depois.
 */
export function IntakeModal({
  vendors,
  policyVersion,
  onClose,
  onSubmit,
  pending,
}: {
  vendors: VendorRow[];
  policyVersion: string | null;
  onClose: () => void;
  onSubmit: (input: IntakeSubmit) => void;
  pending: boolean;
}) {
  const selectable = vendors.filter((v) => v.tier !== "BLOCKED");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [ownerName, setOwnerName] = useState("");
  const [vendorId, setVendorId] = useState(selectable[0]?.id ?? "");
  const [dataClass, setDataClass] = useState<DataClass>("INTERNAL");
  const [exposure, setExposure] = useState<Exposure>("INTERNAL");
  const [criticality, setCriticality] = useState<Criticality>("MEDIUM");
  const [hitl, setHitl] = useState("");
  const [launch, setLaunch] = useState("");

  // Mesma função pura que o servidor usa para validar.
  const rec = useMemo(
    () => recommendPath(dataClass, exposure, criticality),
    [dataClass, exposure, criticality]
  );

  const vendor = selectable.find((v) => v.id === vendorId) ?? null;
  const gate = vendor
    ? vendorEligibility(
        { maxClass: vendor.maxClass, notes: vendor.notes },
        dataClass
      )
    : null;
  const eligible = gate?.eligible ?? false;
  const ready =
    title.trim().length > 5 && objective.trim().length > 15 && eligible;

  const submit = (asDraft: boolean) =>
    onSubmit({
      title: title.trim(),
      objective: objective.trim(),
      department,
      ownerName: ownerName.trim(),
      vendorId: vendorId || null,
      dataClass,
      exposure,
      criticality,
      asDraft,
    });

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Icon name="lock" size={12} />
            Submissão cria registro de risco e marca o SLA de revisão
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={() => submit(true)} size="md" variant="secondary">
              Salvar rascunho
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason={
                eligible
                  ? "Preencha título e objetivo"
                  : "Fornecedor não elegível à classe de dado escolhida"
              }
            >
              <Button icon="send" onClick={() => submit(false)} size="md">
                {pending ? "Submetendo…" : "Submeter para revisão"}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="plus"
      onClose={onClose}
      subtitle="O caminho de aprovação e o nível de revisão humana são calculados enquanto você preenche"
      title="Novo caso de uso de IA"
      tone="accent"
      width={940}
    >
      <ModalSplit
        aside={
          <>
            <Eyebrow tone={rec.tone}>Avaliação ao vivo</Eyebrow>
            <div
              style={{
                padding: "14px 15px",
                borderRadius: 10,
                background: `rgba(var(--${rec.tone}-rgb),.09)`,
                border: `1px solid rgba(var(--${rec.tone}-rgb),.24)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 9,
                }}
              >
                <Icon
                  name="route"
                  size={15}
                  style={{ color: `var(--${rec.tone}-text)` }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: `var(--${rec.tone}-text)`,
                  }}
                >
                  Caminho de aprovação
                </span>
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "var(--ink)",
                  lineHeight: 1.4,
                }}
              >
                {rec.path}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <MetaCell label="SLA" mono value={`${rec.slaDays} dias`} />
                <MetaCell
                  label="Revisão mínima"
                  value={HITL_LABEL[rec.hitl].replace("Revisão ", "")}
                />
              </div>
              {/* A regra, não só o resultado (FR-4.3). */}
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  lineHeight: 1.5,
                  marginTop: 11,
                  paddingTop: 11,
                  borderTop: `1px solid rgba(var(--${rec.tone}-rgb),.2)`,
                }}
              >
                {rec.rule}
              </div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
              }}
            >
              <Eyebrow style={{ marginBottom: 7 }}>
                Regra da classe de dado
              </Eyebrow>
              <div style={{ marginBottom: 7 }}>
                <Badge tone={DATA_CLASS_TONE[dataClass]}>
                  {DATA_CLASS_LABEL[dataClass]}
                </Badge>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-muted)",
                  lineHeight: 1.55,
                }}
              >
                {DATA_CLASS_RULE[dataClass]}
              </div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: eligible ? "var(--surface)" : "var(--red-soft)",
                border: `1px solid ${eligible ? "var(--hairline)" : "rgba(var(--red-rgb),.28)"}`,
              }}
            >
              <Eyebrow style={{ marginBottom: 7 }}>Fornecedor</Eyebrow>
              <div
                style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}
              >
                {vendor?.name ?? "—"}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  marginTop: 3,
                }}
              >
                {vendor?.region ?? "—"} ·{" "}
                {vendor?.dpa ? "DPA assinado" : "sem DPA"} · retenção{" "}
                {vendor?.retention?.toLowerCase() ?? "—"}
              </div>
              <div style={{ marginTop: 9 }}>
                {eligible ? (
                  <Badge icon="check" tone="green">
                    Elegível a {DATA_CLASS_LABEL[dataClass]}
                  </Badge>
                ) : (
                  <Badge icon="ban" tone="red">
                    Não elegível a {DATA_CLASS_LABEL[dataClass]}
                  </Badge>
                )}
              </div>
              {gate?.eligible === false && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--red-text)",
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  {gate.reason}
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: "auto",
                fontSize: 11,
                color: "var(--ink-faint)",
                lineHeight: 1.5,
              }}
            >
              Esta avaliação é uma recomendação da política vigente
              {policyVersion ? ` (${policyVersion})` : ""}. A decisão final é
              sempre humana e fica registrada com justificativa.
            </div>
          </>
        }
        asideWidth={318}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <FormField
            hint="Uma frase que um revisor entenda sem contexto adicional"
            label="Título do caso de uso"
            required
          >
            <TextInput
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Triagem assistida de sinistros de saúde"
              value={title}
            />
          </FormField>
          <FormField
            hint="Que resultado se espera e como será medido"
            label="Objetivo de negócio"
            required
          >
            <TextArea
              onChange={(e) => setObjective(e.target.value)}
              placeholder="ex: Reduzir o tempo médio de triagem de 6 para 2 dias priorizando casos por completude documental."
              rows={3}
              value={objective}
            />
          </FormField>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <FormField label="Área solicitante" required>
              <Select
                onChange={(e) => setDepartment(e.target.value)}
                options={DEPARTMENTS}
                value={department}
              />
            </FormField>
            <FormField label="Responsável pelo caso" required>
              <TextInput
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Nome de quem responde pelo caso"
                value={ownerName}
              />
            </FormField>
          </div>
          <FormField
            hint="Determina fornecedores elegíveis e nível mínimo de revisão humana"
            label="Classe de dado envolvida"
            required
          >
            <Segmented
              full
              onChange={(v) => setDataClass(v as DataClass)}
              options={DATA_CLASS_OPTS}
              value={dataClass}
            />
          </FormField>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <FormField
              hint="Externo = visível a cliente ou paciente"
              label="Exposição"
              required
            >
              <Segmented
                full
                onChange={(v) => setExposure(v as Exposure)}
                options={EXPOSURE_OPTS}
                value={exposure}
              />
            </FormField>
            <FormField
              hint="Efeito de um erro sobre pessoa ou contrato"
              label="Criticidade da decisão"
              required
            >
              <Segmented
                full
                onChange={(v) => setCriticality(v as Criticality)}
                options={CRIT_OPTS}
                value={criticality}
              />
            </FormField>
          </div>
          <FormField
            hint="Somente fornecedores do registro aparecem aqui"
            label="Fornecedor ou modelo"
            required
          >
            <Select
              onChange={(e) => setVendorId(e.target.value)}
              options={selectable.map((v) => ({
                value: v.id,
                label: `${v.name} — ${v.maxClass ? `máx ${DATA_CLASS_LABEL[v.maxClass]}` : "sem classe permitida"}`,
              }))}
              value={vendorId}
            />
          </FormField>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <FormField
              hint={`Mínimo pela política: ${HITL_LABEL[rec.hitl]}`}
              label="Plano de revisão humana"
            >
              <Select
                onChange={(e) => setHitl(e.target.value)}
                options={[
                  "Supervisão passiva",
                  "Revisão por amostragem",
                  "Revisão integral",
                ]}
                value={hitl || HITL_LABEL[rec.hitl]}
              />
            </FormField>
            <FormField label="Início pretendido">
              <TextInput
                onChange={(e) => setLaunch(e.target.value)}
                type="date"
                value={launch}
              />
            </FormField>
          </div>
          {gate?.eligible === false && (
            <Callout icon="ban" tone="red">
              A combinação escolhida não é permitida pela política vigente:{" "}
              <strong>{vendor?.name}</strong> não pode processar dado{" "}
              <strong>{DATA_CLASS_LABEL[dataClass]}</strong>. {gate.reason}
            </Callout>
          )}
        </div>
      </ModalSplit>
    </ModalShell>
  );
}

// ── 2. DecisionModal (FR-6) ───────────────────────────────────────────────────

export type DecisionSubmit = {
  outcome: "APPROVED" | "RESTRICTED" | "CHANGES" | "BLOCKED";
  rationale: string;
  conditions: string[];
  changeRequest?: string;
  blockReason?: string;
};

const DECISIONS = [
  {
    value: "APPROVED",
    label: "Aprovar",
    tone: "green" as Tone,
    icon: "check" as const,
    desc: "Caso liberado como declarado, sem condições adicionais.",
  },
  {
    value: "RESTRICTED",
    label: "Aprovar com restrições",
    tone: "green" as Tone,
    icon: "lock" as const,
    desc: "Liberado sob condições explícitas que acompanham o caso até serem levantadas.",
  },
  {
    value: "CHANGES",
    label: "Pedir ajustes",
    tone: "amber" as Tone,
    icon: "arrowLeft" as const,
    desc: "Falta informação para decidir. Volta ao requester com o que precisa mudar.",
  },
  {
    value: "BLOCKED",
    label: "Bloquear",
    tone: "red" as Tone,
    icon: "ban" as const,
    desc: "Incompatível com a política. Registrado no Decision Log com motivo.",
  },
];

const CONDITION_SUGGESTIONS = [
  "Somente ambiente dedicado com BAA",
  "Retenção zero verificada por trimestre",
  "Auditoria de paridade antes do rollout",
  "Divulgação explícita de IA ao usuário",
];

export function DecisionModal({
  caseCode,
  caseTitle,
  approvalPath,
  dataClass,
  score,
  riskLabel,
  riskTone,
  vendorName,
  deciderName,
  deciderRole,
  onClose,
  onSubmit,
  pending,
}: {
  caseCode: string;
  caseTitle: string;
  approvalPath: string | null;
  dataClass: DataClass;
  score: number;
  riskLabel: string;
  riskTone: string;
  vendorName: string | null;
  deciderName: string;
  deciderRole: string;
  onClose: () => void;
  onSubmit: (input: DecisionSubmit) => void;
  pending: boolean;
}) {
  const [decision, setDecision] =
    useState<DecisionSubmit["outcome"]>("RESTRICTED");
  const [note, setNote] = useState("");
  const [conds, setConds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const sel = DECISIONS.find((d) => d.value === decision) ?? DECISIONS[0];
  const needsCond = decision === "RESTRICTED";
  const ready = note.trim().length >= 12 && (!needsCond || conds.length > 0);

  const cells = [
    {
      key: "dc",
      node: (
        <MetaCell
          label="Classe de dado"
          tone={DATA_CLASS_TONE[dataClass]}
          value={DATA_CLASS_LABEL[dataClass]}
        />
      ),
    },
    {
      key: "risk",
      node: (
        <MetaCell
          label="Risco composto"
          mono
          tone={riskTone as Tone}
          value={`${score} · ${riskLabel}`}
        />
      ),
    },
    {
      key: "vendor",
      node: <MetaCell label="Fornecedor" value={vendorName ?? "—"} />,
    },
  ];

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Icon name="userCheck" size={12} />
            {deciderName} · {deciderRole}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason={
                needsCond && conds.length === 0
                  ? "Aprovação com restrições exige ao menos uma condição"
                  : "Escreva a justificativa"
              }
            >
              <Button
                icon={sel.icon}
                onClick={() =>
                  onSubmit({
                    outcome: decision,
                    rationale: note.trim(),
                    conditions: needsCond ? conds : [],
                    changeRequest:
                      decision === "CHANGES" ? note.trim() : undefined,
                    blockReason:
                      decision === "BLOCKED" ? note.trim() : undefined,
                  })
                }
                size="md"
                style={{
                  background: `var(--${sel.tone})`,
                  borderColor: `var(--${sel.tone})`,
                }}
              >
                {pending ? "Registrando…" : sel.label}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="gavel"
      onClose={onClose}
      subtitle={`${caseTitle}${approvalPath ? ` · ${approvalPath}` : ""}`}
      title={`Decisão · ${caseCode}`}
      tone={sel.tone}
      width={760}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 22,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 10,
          }}
        >
          {cells.map((c) => (
            <div
              key={c.key}
              style={{
                padding: "10px 12px",
                borderRadius: 9,
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
              }}
            >
              {c.node}
            </div>
          ))}
        </div>

        <FormField label="Decisão" required>
          <RadioCards
            onChange={(v) => setDecision(v as DecisionSubmit["outcome"])}
            options={DECISIONS}
            value={decision}
          />
        </FormField>

        {needsCond && (
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>
              Condições da aprovação · obrigatório ao menos uma
            </Eyebrow>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginBottom: 10,
              }}
            >
              {conds.map((c) => (
                <CheckRow
                  checked
                  key={c}
                  label={c}
                  right={
                    <IconButton
                      name="x"
                      onClick={() =>
                        setConds((cs) => cs.filter((x) => x !== c))
                      }
                      size={26}
                      title="Remover condição"
                    />
                  }
                  tone="green"
                />
              ))}
              {conds.length === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--red-text)",
                    padding: "8px 4px",
                  }}
                >
                  Nenhuma condição — uma aprovação restrita sem condição é
                  apenas uma aprovação.
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <TextInput
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) {
                    e.preventDefault();
                    setConds((cs) => [...cs, draft.trim()]);
                    setDraft("");
                  }
                }}
                placeholder="ex: Saída sempre revisada por profissional de saúde"
                value={draft}
              />
              <Button
                icon="plus"
                onClick={() => {
                  if (draft.trim()) {
                    setConds((cs) => [...cs, draft.trim()]);
                    setDraft("");
                  }
                }}
                size="md"
                variant="secondary"
              >
                Adicionar
              </Button>
            </div>
            <div
              style={{
                display: "flex",
                gap: 7,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              {CONDITION_SUGGESTIONS.filter((s) => !conds.includes(s)).map(
                (s) => (
                  <button
                    className="btn"
                    key={s}
                    onClick={() => setConds((cs) => [...cs, s])}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 99,
                      fontSize: 11.5,
                      fontWeight: 600,
                      border: "1px dashed var(--hairline-strong)",
                      background: "transparent",
                      color: "var(--ink-muted)",
                      cursor: "pointer",
                    }}
                    type="button"
                  >
                    + {s}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        <FormField
          hint="Vai para a trilha de auditoria e para o pacote de evidência. Sem justificativa, não há decisão."
          label="Justificativa da decisão"
          required
        >
          <TextArea
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: Uso compatível com a seção 4 desde que o processamento ocorra no ambiente dedicado com BAA; risco de viés endereçado por MIT-30."
            rows={3}
            value={note}
          />
        </FormField>

        {decision === "BLOCKED" && (
          <Callout icon="ban" tone="red">
            O requester é notificado com o motivo e pode reabrir apenas com
            mudança material no caso — novo fornecedor, nova classe de dado ou
            novo desenho de revisão humana.
          </Callout>
        )}
        {decision === "CHANGES" && (
          <Callout icon="arrowLeft" tone="amber">
            O caso volta ao requester com a descrição acima e sai da fila de
            decisão até ser reenviado.
          </Callout>
        )}
      </div>
    </ModalShell>
  );
}

// ── 3. MitigationModal ────────────────────────────────────────────────────────

export function MitigationModal({
  cases,
  defaultCase,
  onClose,
  onSubmit,
  pending,
}: {
  cases: { code: string; title: string }[];
  defaultCase?: string;
  onClose: () => void;
  onSubmit: (input: {
    useCaseCode: string;
    category: keyof typeof RISK_CATEGORY_LABEL;
    action: string;
    ownerName: string;
    dueDate: string;
  }) => void;
  pending: boolean;
}) {
  const [useCaseCode, setUseCaseCode] = useState(
    defaultCase ?? cases[0]?.code ?? ""
  );
  const [category, setCategory] =
    useState<keyof typeof RISK_CATEGORY_LABEL>("PRIVACY");
  const [action, setAction] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [due, setDue] = useState("");
  const ready = action.trim().length > 8 && due !== "";

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> cancelar
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason="Descreva a ação e informe o prazo"
            >
              <Button
                icon="check"
                onClick={() =>
                  onSubmit({
                    useCaseCode,
                    category,
                    action: action.trim(),
                    ownerName: ownerName.trim(),
                    dueDate: due,
                  })
                }
                size="md"
              >
                {pending ? "Registrando…" : "Registrar"}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="shield"
      onClose={onClose}
      subtitle="Risco sem dono e prazo é risco aceito por omissão"
      title="Nova mitigação"
      tone="amber"
      width={640}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: 22,
        }}
      >
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField label="Caso de uso" required>
            <Select
              onChange={(e) => setUseCaseCode(e.target.value)}
              options={cases.map((c) => ({
                value: c.code,
                label: `${c.code} · ${c.title}`,
              }))}
              value={useCaseCode}
            />
          </FormField>
          <FormField label="Categoria de risco" required>
            <Select
              onChange={(e) =>
                setCategory(e.target.value as keyof typeof RISK_CATEGORY_LABEL)
              }
              options={Object.entries(RISK_CATEGORY_LABEL).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
              value={category}
            />
          </FormField>
        </div>
        <FormField
          hint="Verbo no infinitivo e resultado verificável"
          label="Ação de mitigação"
          required
        >
          <TextArea
            onChange={(e) => setAction(e.target.value)}
            placeholder="ex: Pseudonimizar identificadores antes do envio ao modelo"
            rows={2}
            value={action}
          />
        </FormField>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField label="Dono" required>
            <TextInput
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Quem responde pela ação"
              value={ownerName}
            />
          </FormField>
          <FormField label="Prazo" required>
            <TextInput
              onChange={(e) => setDue(e.target.value)}
              type="date"
              value={due}
            />
          </FormField>
        </div>
        <Callout icon="clock" tone="amber">
          Prazo vencido sem conclusão gera alerta para o dono e para Compliance,
          e aparece como pendência no pacote de evidência.
        </Callout>
      </div>
    </ModalShell>
  );
}

// ── 4. PublishVersionModal (FR-2.3, FR-2.4) ───────────────────────────────────

export function PublishVersionModal({
  policyName,
  currentVersion,
  nextVersion,
  blockers,
  trackCount,
  peopleCount,
  onClose,
  onSubmit,
  pending,
}: {
  policyName: string;
  currentVersion: string | null;
  nextVersion: string;
  blockers: {
    id: string;
    ordinal: number;
    name: string;
    statusLabel: string;
  }[];
  trackCount: number;
  peopleCount: number;
  onClose: () => void;
  onSubmit: (summary: string) => void;
  pending: boolean;
}) {
  const [summary, setSummary] = useState("");
  const [notify, setNotify] = useState(true);
  const [recert, setRecert] = useState(true);
  const blocked = blockers.length > 0;
  const ready = summary.trim().length >= 12 && !blocked;

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> cancelar · publicação entra na auditoria
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason={
                blocked
                  ? "Aprove todas as seções antes de publicar"
                  : "Escreva um resumo de mudança"
              }
            >
              <Button
                icon="check"
                onClick={() => onSubmit(summary.trim())}
                size="md"
              >
                {pending ? "Publicando…" : `Publicar ${nextVersion}`}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="upload"
      onClose={onClose}
      subtitle={`${currentVersion ?? "—"} → ${nextVersion} · a versão vigente só muda ao confirmar`}
      title={`Publicar ${policyName}`}
      tone="accent"
      width={720}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: 22,
        }}
      >
        {blocked && (
          <>
            <Callout icon="alert" tone="amber">
              {blockers.length}{" "}
              {blockers.length === 1
                ? "seção não está aprovada"
                : "seções não estão aprovadas"}
              . Publicar uma política com seção em rascunho cria regra que
              ninguém leu — o Charter bloqueia.
            </Callout>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {blockers.map((b) => (
                <CheckRow
                  checked={false}
                  disabled
                  hint={b.statusLabel}
                  key={b.id}
                  label={`${String(b.ordinal).padStart(2, "0")} · ${b.name}`}
                  tone="amber"
                />
              ))}
            </div>
          </>
        )}

        <FormField
          hint="Aparece na trilha de auditoria e no aviso de re-aceite. Sem resumo, não há publicação."
          label="Resumo de mudança"
          required
        >
          <TextArea
            onChange={(e) => setSummary(e.target.value)}
            placeholder="ex: Seção 4 passa a exigir retenção zero para dado Confidencial; seção 6 define divulgação obrigatória em IA voltada ao cliente."
            rows={3}
            value={summary}
          />
        </FormField>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <Eyebrow style={{ marginBottom: 8 }}>Efeitos ao publicar</Eyebrow>
          <CheckRow
            checked={notify}
            hint="E-mail e Slack com o resumo de mudança"
            label="Notificar todos os colaboradores"
            onToggle={() => setNotify((v) => !v)}
            tone="accent"
          />
          <CheckRow
            checked={recert}
            hint={`${trackCount} trilhas · ${peopleCount.toLocaleString("pt-BR")} pessoas`}
            label="Exigir re-aceite nas trilhas vinculadas"
            onToggle={() => setRecert((v) => !v)}
            tone="accent"
          />
          {/* Honestidade sobre o V1: a invalidação acontece; o envio não (ADR-0011). */}
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            A invalidação dos aceites acontece de imediato. O envio de
            notificação ainda não está ligado nesta versão.
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── 5. GenerateDraftModal (FR-2.7) ────────────────────────────────────────────

export function GenerateDraftModal({
  sections,
  requirementSets,
  industry,
  geo,
  posture,
  onClose,
  onSave,
  pending,
}: {
  sections: {
    id: string;
    ordinal: number;
    name: string;
    statusLabel: string;
    words: number;
  }[];
  /** Conjuntos disponíveis para fundamentar o rascunho — vem de
   *  listRequirementSets() na tela de Política. */
  requirementSets: SetRow[];
  industry: string | null;
  geo: string | null;
  posture: string;
  onClose: () => void;
  onSave: (
    sectionId: string,
    body: string,
    groundedRequirementId: string
  ) => void;
  pending: boolean;
}) {
  const [stage, setStage] = useState<"form" | "working" | "done">("form");
  const [ctxIndustry, setCtxIndustry] = useState(industry ?? "");
  const [ctxGeo, setCtxGeo] = useState(geo ?? "BR · UE");
  const [ctxPosture, setCtxPosture] = useState(posture);
  const [scope, setScope] = useState<string[]>([]);
  const [body, setBody] = useState("");

  // Exigência que fundamenta o rascunho (groundedRequirementId em
  // saveGeneratedDraft). Cascata: escolhido o conjunto, busca as exigências
  // dele — MapRow só existe por conjunto, nunca solto, então sem esse
  // segundo fetch o seletor de exigência não tem o que listar.
  const [groundedSetId, setGroundedSetId] = useState("");
  const [requirements, setRequirements] = useState<MapRow[]>([]);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [groundedRequirementId, setGroundedRequirementId] = useState("");
  const activeSetId = groundedSetId || requirementSets[0]?.id || "";

  useEffect(() => {
    if (!activeSetId) {
      setRequirements([]);
      return;
    }
    let alive = true;
    setLoadingRequirements(true);
    getComplianceMap(activeSetId).then((res) => {
      if (!alive) {
        return;
      }
      setRequirements(res.ok ? res.data.linhas : []);
      setLoadingRequirements(false);
    });
    return () => {
      alive = false;
    };
  }, [activeSetId]);

  const toggle = (id: string) =>
    setScope((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = () => {
    setStage("working");
    // Composição determinística a partir do contexto declarado. Sem provedor de
    // LLM nesta versão — ADR-0008: o fluxo e a garantia de DRAFT são o
    // requisito verificável; ligar um provedor é troca de implementação.
    setTimeout(() => {
      const names = sections
        .filter((s) => scope.includes(s.id))
        .map((s) => s.name)
        .join(", ");
      setBody(
        `Rascunho para: ${names}.\n\nContexto declarado: ${ctxIndustry || "não informado"}, geografia ${ctxGeo}, postura de risco ${ctxPosture}.\n\nPerguntas abertas para Legal responder antes de publicar:\n1. Quais sistemas concretos ficam no escopo desta seção?\n2. Qual evidência prova o cumprimento, e com que periodicidade?\n3. Quem é o dono nomeado da exceção, se houver?\n\nEsta seção exige revisão humana antes de publicação. Toda regra descrita aqui deve ser verificável e ter dono nomeado.`
      );
      setStage("done");
    }, 1200);
  };

  const target = sections.find((s) => s.id === scope[0]);

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Icon name="lock" size={12} />
            Saída sempre revisada por Legal antes de publicar
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Fechar
            </Button>
            {stage === "done" ? (
              <GatedAction
                ready={Boolean(target) && Boolean(groundedRequirementId)}
                reason="Selecione a exigência que este rascunho fundamenta"
              >
                <Button
                  icon="check"
                  onClick={() =>
                    target && onSave(target.id, body, groundedRequirementId)
                  }
                  size="md"
                >
                  {pending ? "Salvando…" : "Inserir como rascunho"}
                </Button>
              </GatedAction>
            ) : (
              <GatedAction
                ready={scope.length > 0 && stage === "form"}
                reason="Selecione ao menos uma seção"
              >
                <Button icon="sparkles" onClick={run} size="md">
                  Gerar {scope.length} seções
                </Button>
              </GatedAction>
            )}
          </div>
        </>
      }
      icon="sparkles"
      onClose={onClose}
      subtitle="O rascunho entra como Rascunho — nunca publica sozinho"
      title="Gerar rascunho de seção"
      tone="purple"
      width={760}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: 22,
        }}
      >
        <Callout icon="flask" tone="purple">
          Charter parte do contexto declarado — setor, geografia e postura de
          risco — e do que a política já diz. Nada é inventado sobre o negócio:
          o que falta virá como pergunta no rascunho.
        </Callout>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField label="Setor e contexto" required>
            <TextInput
              onChange={(e) => setCtxIndustry(e.target.value)}
              placeholder="ex: Healthtech · Pagamentos"
              value={ctxIndustry}
            />
          </FormField>
          <FormField label="Geografia regulatória" required>
            <Select
              onChange={(e) => setCtxGeo(e.target.value)}
              options={["BR · UE", "BR", "BR · EUA", "Global"]}
              value={ctxGeo}
            />
          </FormField>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField label="Conjunto de exigências" required>
            <Select
              onChange={(e) => {
                setGroundedSetId(e.target.value);
                setGroundedRequirementId("");
              }}
              options={
                requirementSets.length > 0
                  ? requirementSets.map((s) => ({
                      value: s.id,
                      label: `${s.nome} · v${s.versao}`,
                    }))
                  : [{ value: "", label: "Nenhum conjunto importado" }]
              }
              value={activeSetId}
            />
          </FormField>
          <FormField
            hint="Aparece na trilha de auditoria como fundamento do rascunho"
            label="Exigência fundamentada"
            required
          >
            <Select
              onChange={(e) => setGroundedRequirementId(e.target.value)}
              options={
                requirements.length > 0
                  ? requirements.map((r) => ({
                      value: r.requirementId,
                      label: `${r.codigo} — ${r.resumo}`,
                    }))
                  : [
                      {
                        value: "",
                        label: loadingRequirements
                          ? "Carregando…"
                          : "Nenhuma exigência neste conjunto",
                      },
                    ]
              }
              value={groundedRequirementId}
            />
          </FormField>
        </div>
        <FormField
          hint="Define o quanto o rascunho tende a restringir por padrão"
          label="Postura de risco"
        >
          <Segmented
            full
            onChange={setCtxPosture}
            options={[
              { value: "Permissiva", tone: "green" },
              { value: "Moderada", tone: "accent" },
              { value: "Conservadora", tone: "amber" },
            ]}
            value={ctxPosture}
          />
        </FormField>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Seções a gerar</Eyebrow>
          <div
            className="scroll"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              maxHeight: 210,
              overflowY: "auto",
            }}
          >
            {sections.map((s) => (
              <CheckRow
                checked={scope.includes(s.id)}
                hint={`${s.statusLabel} · ${s.words} palavras`}
                key={s.id}
                label={`${String(s.ordinal).padStart(2, "0")} · ${s.name}`}
                onToggle={() => toggle(s.id)}
                tone="purple"
              />
            ))}
          </div>
        </div>
        {stage === "working" && (
          <div
            className="ai-shimmer"
            style={{
              padding: "14px 15px",
              borderRadius: 9,
              border: "1px solid rgba(var(--purple-rgb),.25)",
              fontSize: 12.5,
              color: "var(--purple-text)",
              fontWeight: 700,
              display: "flex",
              gap: 9,
              alignItems: "center",
            }}
          >
            <Icon name="sparkles" size={15} />
            Redigindo {scope.length} seções com base em {ctxGeo} e postura{" "}
            {ctxPosture}…
          </div>
        )}
        {stage === "done" && (
          <>
            <Callout icon="check" tone="green">
              Rascunho pronto com perguntas abertas marcadas para Legal
              responder. Nenhuma seção publicada.
            </Callout>
            <FormField
              hint="Entra como rascunho — nunca como versão publicada."
              label="Rascunho gerado"
            >
              <TextArea
                onChange={(e) => setBody(e.target.value)}
                rows={9}
                value={body}
              />
            </FormField>
          </>
        )}
      </div>
    </ModalShell>
  );
}

// ── 6. DiffModal (FR-2.6) ─────────────────────────────────────────────────────

export function DiffModal({
  diff,
  publishedBy,
  publishedAt,
  summary,
  onClose,
}: {
  diff: VersionDiff;
  publishedBy: string | null;
  publishedAt: string;
  summary: string;
  onClose: () => void;
}) {
  return (
    <ModalShell
      footer={
        <>
          <FooterHint>Referência imutável ao registro de origem</FooterHint>
          <Button onClick={onClose} size="md" variant="secondary">
            Fechar
          </Button>
        </>
      }
      icon="eye"
      onClose={onClose}
      subtitle={`${publishedBy ?? "—"} · ${new Date(publishedAt).toLocaleDateString("pt-BR")}`}
      title={`Diff · ${diff.version}`}
      tone="accent"
      width={720}
    >
      <div
        style={{
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Callout icon="fileText" tone="accent">
          {summary}
        </Callout>
        {diff.rows.length === 0 ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-muted)",
              padding: "20px 0",
              textAlign: "center",
            }}
          >
            Nenhuma diferença de conteúdo entre esta versão e a anterior.
          </div>
        ) : (
          <div
            style={{
              borderRadius: 9,
              border: "1px solid var(--hairline)",
              overflow: "hidden",
            }}
          >
            <TableHead cols="1fr 1fr" labels={["Antes", "Depois"]} />
            {diff.rows.map((r, i, arr) => (
              <div
                key={r.field}
                style={{
                  borderBottom:
                    i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                  padding: "12px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink)",
                    marginBottom: 8,
                  }}
                >
                  {r.field}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--red-text)",
                      background: "var(--red-soft)",
                      padding: "8px 10px",
                      borderRadius: 7,
                      lineHeight: 1.5,
                    }}
                  >
                    {r.before}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--green-text)",
                      background: "var(--green-soft)",
                      padding: "8px 10px",
                      borderRadius: 7,
                      lineHeight: 1.5,
                    }}
                  >
                    {r.after}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ── 7. VendorTierModal (FR-8.5) ───────────────────────────────────────────────

const TIER_OPTS = [
  {
    value: "APPROVED",
    label: "Aprovado",
    tone: "green" as Tone,
    icon: "check" as const,
    desc: "Elegível dentro da classe máxima derivada da postura contratual.",
  },
  {
    value: "RESTRICTED",
    label: "Restrito",
    tone: "amber" as Tone,
    icon: "lock" as const,
    desc: "Uso permitido apenas em casos específicos e com mitigação.",
  },
  {
    value: "REVIEW",
    label: "Em revisão",
    tone: "accent" as Tone,
    icon: "eye" as const,
    desc: "Novos casos suspensos até conclusão da avaliação.",
  },
  {
    value: "BLOCKED",
    label: "Bloqueado",
    tone: "red" as Tone,
    icon: "ban" as const,
    desc: "Nenhum uso permitido. Casos existentes precisam migrar.",
  },
];

export function VendorTierModal({
  vendor,
  onClose,
  onSubmit,
  pending,
}: {
  vendor: {
    name: string;
    tier: string;
    cases: number;
    maxClass: DataClass | null;
  };
  onClose: () => void;
  onSubmit: (input: { tier: VendorTier; rationale: string }) => void;
  pending: boolean;
}) {
  const [tier, setTier] = useState<VendorTier>(vendor.tier as VendorTier);
  const [note, setNote] = useState("");
  const ready = note.trim().length >= 12;
  const meta = TIER_OPTS.find((t) => t.value === tier) ?? TIER_OPTS[0];

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Icon name="history" size={12} />
            Alteração entra na trilha de auditoria
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason="Escreva a justificativa"
            >
              <Button
                icon="check"
                onClick={() => onSubmit({ tier, rationale: note.trim() })}
                size="md"
              >
                {pending ? "Aplicando…" : "Aplicar"}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="shield"
      onClose={onClose}
      subtitle="A mudança afeta todos os casos de uso vinculados"
      title={`Situação · ${vendor.name}`}
      tone={meta.tone}
      width={680}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: 22,
        }}
      >
        <FormField label="Situação" required>
          <RadioCards
            cols={2}
            onChange={(v) => setTier(v as VendorTier)}
            options={TIER_OPTS}
            value={tier}
          />
        </FormField>

        {/* Divergência deliberada do protótipo (ADR-0003): a classe máxima é
            derivada das cláusulas, não escolhida aqui. Escolher livremente
            tornaria FR-9.3 ("recalcular ao marcar cláusula") sem sentido. */}
        <Callout icon="scale" tone="accent">
          Classe máxima atual:{" "}
          <strong>
            {vendor.maxClass ? DATA_CLASS_LABEL[vendor.maxClass] : "nenhuma"}
          </strong>
          . Ela é derivada da postura contratual — para mudá-la, ajuste as
          cláusulas em “Gerir cláusulas”. Mudar o tier para Bloqueado zera a
          classe permitida.
        </Callout>

        <FormField
          hint="Fica visível a quem tentar usar este fornecedor fora do permitido"
          label="Justificativa"
          required
        >
          <TextArea
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex: Retenção de 14 dias incompatível com a seção 4 para dado Confidencial; renegociação em curso."
            rows={3}
            value={note}
          />
        </FormField>

        {tier === "BLOCKED" && (
          <Callout icon="ban" tone="red">
            {vendor.cases} caso(s) de uso vinculado(s) entram em estado de
            exceção e são sinalizados para migração de fornecedor.
          </Callout>
        )}
      </div>
    </ModalShell>
  );
}

// ── 8. NewVendorModal (FR-8.4) ────────────────────────────────────────────────

const REGIONS = [
  "UE (Frankfurt)",
  "UE (Dublin)",
  "UE (Amsterdã)",
  "BR (São Paulo)",
  "EUA (Virgínia)",
  "EUA (Oregon)",
  "Não declarada",
];
const RETENTIONS = ["Zero", "14 dias", "30 dias", "90 dias", "Indefinida"];
const CATEGORIES = [
  "Assistente de texto",
  "Assistente de código",
  "Modelos de decisão",
  "IA clínica",
  "Enriquecimento de dados",
  "Análise contratual",
  "Síntese de voz",
];

export function NewVendorModal({
  clauses,
  onClose,
  onSubmit,
  pending,
}: {
  clauses: { code: string; name: string; critical: boolean }[];
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    category: string;
    region: string;
    retention: string;
    dpa: boolean;
    notes: string;
    clauseCodes: string[];
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [region, setRegion] = useState(REGIONS[0]);
  const [retention, setRetention] = useState(RETENTIONS[0]);
  const [dpa, setDpa] = useState(false);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const ready = name.trim().length > 2;

  // Prévia da mesma escada que o servidor aplica (ADR-0003).
  const derived = useMemo<DataClass>(() => {
    if (!(dpa && selected.includes("CL-01"))) {
      return "PUBLIC";
    }
    if (!["CL-02", "CL-03", "CL-04"].every((c) => selected.includes(c))) {
      return "INTERNAL";
    }
    return selected.includes("CL-08") ? "RESTRICTED" : "CONFIDENTIAL";
  }, [dpa, selected]);

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Icon name="lock" size={12} />
            Entra como Em revisão até a avaliação de Segurança
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedAction ready={ready && !pending} reason="Informe o nome">
              <Button
                icon="check"
                onClick={() =>
                  onSubmit({
                    name: name.trim(),
                    category,
                    region,
                    retention,
                    dpa,
                    notes: notes.trim(),
                    clauseCodes: selected,
                  })
                }
                size="md"
              >
                {pending ? "Adicionando…" : "Adicionar"}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="plus"
      onClose={onClose}
      subtitle="A classe máxima de dado é derivada da postura declarada, não escolhida livremente"
      title="Adicionar fornecedor de IA"
      tone="blue"
      width={720}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: 22,
        }}
      >
        <div
          style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}
        >
          <FormField label="Nome do fornecedor" required>
            <TextInput
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Corpus Legal Review"
              value={name}
            />
          </FormField>
          <FormField label="Categoria" required>
            <Select
              onChange={(e) => setCategory(e.target.value)}
              options={CATEGORIES}
              value={category}
            />
          </FormField>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <FormField
            hint="Região não declarada bloqueia qualquer dado não-público"
            label="Região de processamento"
            required
          >
            <Select
              onChange={(e) => setRegion(e.target.value)}
              options={REGIONS}
              value={region}
            />
          </FormField>
          <FormField label="Retenção declarada" required>
            <Select
              onChange={(e) => setRetention(e.target.value)}
              options={RETENTIONS}
              value={retention}
            />
          </FormField>
        </div>

        <div>
          <Eyebrow style={{ marginBottom: 8 }}>
            Cláusulas contratuais presentes
          </Eyebrow>
          <div
            className="scroll"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {clauses.map((c) => (
              <CheckRow
                checked={selected.includes(c.code)}
                hint={
                  c.critical ? "Crítica — define o teto de classe" : undefined
                }
                key={c.code}
                label={`${c.code} · ${c.name}`}
                onToggle={() =>
                  setSelected((prev) =>
                    prev.includes(c.code)
                      ? prev.filter((x) => x !== c.code)
                      : [...prev, c.code]
                  )
                }
                tone={c.critical ? "red" : "accent"}
              />
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
          <CheckRow
            checked={dpa}
            hint="Sem DPA, o fornecedor fica limitado a dado Público independentemente do resto"
            label="DPA assinado e arquivado"
            onToggle={() => setDpa((v) => !v)}
            tone="green"
          />
        </div>

        <Callout icon="scale" tone={derived === "PUBLIC" ? "amber" : "green"}>
          Classe máxima resultante: <strong>{DATA_CLASS_LABEL[derived]}</strong>
          . Derivada de DPA + cláusulas — não é campo digitado.
        </Callout>

        <FormField
          hint="Aparece na mensagem de bloqueio do intake quando o fornecedor é inelegível"
          label="Observações contratuais"
        >
          <TextArea
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ex: DPA pendente e 11 sub-processadores não mapeados."
            rows={2}
            value={notes}
          />
        </FormField>
      </div>
    </ModalShell>
  );
}

// ── 9. ClauseLibraryModal (FR-9.5) ────────────────────────────────────────────

export function ClauseLibraryModal({
  rows,
  onClose,
}: {
  rows: ClauseLibraryRow[];
  onClose: () => void;
}) {
  const critical = rows.filter((c) => c.critical).length;
  const cols = "70px minmax(0,1fr) 110px 96px";
  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            {critical} de {rows.length} são críticas
          </FooterHint>
          <Button onClick={onClose} size="md" variant="secondary">
            Fechar
          </Button>
        </>
      }
      icon="book"
      onClose={onClose}
      subtitle="O que o Charter exige de todo contrato de IA"
      title="Biblioteca de cláusulas"
      tone="accent"
      width={720}
    >
      <div
        style={{
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Callout icon="scale" tone="accent">
          Cláusula crítica ausente não é observação — é limite operacional. O
          fornecedor fica travado na classe de dado que a postura atual
          sustenta.
        </Callout>
        <div
          style={{
            borderRadius: 9,
            border: "1px solid var(--hairline)",
            overflow: "hidden",
          }}
        >
          <TableHead
            cols={cols}
            labels={["ID", "Cláusula", "Tipo", "Cobertura"]}
          />
          {rows.map((c, i) => (
            <TableRow cols={cols} key={c.code} last={i === rows.length - 1}>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--ink-faint)",
                }}
              >
                {c.code}
              </span>
              <span
                style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}
              >
                {c.name}
              </span>
              <Badge tone={c.critical ? "red" : "accent"}>
                {c.critical ? "Crítica" : "Recomendada"}
              </Badge>
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    c.covered === c.total
                      ? "var(--green-text)"
                      : c.covered === 0
                        ? "var(--red-text)"
                        : "var(--amber-text)",
                }}
              >
                {c.covered}/{c.total}
              </span>
            </TableRow>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

// ── 10. PublishTrackModal (FR-10.4) ───────────────────────────────────────────

const AUDIENCES = [
  "Todos os colaboradores",
  "Clínico · Operações",
  "Engenharia",
  "CX · Marketing",
  "Gestores · Diretoria",
];

export function PublishTrackModal({
  sections,
  policyVersion,
  onClose,
  onSubmit,
  pending,
}: {
  sections: {
    id: string;
    ordinal: number;
    name: string;
    status: string;
    statusLabel: string;
    words: number;
  }[];
  policyVersion: string | null;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    audience: string;
    modules: number;
    minutes: number;
    recert: "ANNUAL" | "SEMIANNUAL";
    people: { name: string; department?: string }[];
    dueInDays: number;
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [recert, setRecert] = useState("Anual");
  const [picked, setPicked] = useState<string[]>([]);
  const [quiz, setQuiz] = useState(true);
  const [roster, setRoster] = useState("");

  const toggle = (id: string) =>
    setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const minutes = picked.length * 6 + (quiz ? 5 : 0);
  const people = roster
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [n, dept] = l.split(",").map((s) => s.trim());
      return { name: n, department: dept || undefined };
    });
  const ready = name.trim().length > 3 && picked.length > 0;

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Icon name="lock" size={12} />
            Aceite registra a versão {policyVersion ?? "—"}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Cancelar
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason="Informe o nome e escolha ao menos uma seção publicada"
            >
              <Button
                icon="send"
                onClick={() =>
                  onSubmit({
                    name: name.trim(),
                    audience,
                    modules: picked.length,
                    minutes,
                    recert: recert === "Anual" ? "ANNUAL" : "SEMIANNUAL",
                    people,
                    dueInDays: 14,
                  })
                }
                size="md"
              >
                {pending ? "Publicando…" : "Publicar e atribuir"}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="plus"
      onClose={onClose}
      subtitle="A trilha é montada a partir de seções publicadas da política"
      title="Publicar trilha de onboarding"
      tone="green"
      width={860}
    >
      <ModalSplit
        aside={
          <>
            <Eyebrow tone="green">Prévia da trilha</Eyebrow>
            <div
              style={{
                padding: "14px 15px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
              }}
            >
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "var(--ink)",
                  lineHeight: 1.35,
                }}
              >
                {name || "Nova trilha"}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  marginTop: 4,
                }}
              >
                {audience}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginTop: 13,
                }}
              >
                <MetaCell label="Módulos" mono value={String(picked.length)} />
                <MetaCell label="Duração" mono value={`${minutes} min`} />
              </div>
              <div
                style={{
                  marginTop: 13,
                  paddingTop: 13,
                  borderTop: "1px solid var(--hairline)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                }}
              >
                {picked.map((id) => {
                  const s = sections.find((x) => x.id === id);
                  return (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        gap: 8,
                        fontSize: 11.5,
                        color: "var(--ink-muted)",
                      }}
                    >
                      <span
                        className="mono"
                        style={{ color: "var(--green-text)", fontWeight: 700 }}
                      >
                        {String(s?.ordinal ?? 0).padStart(2, "0")}
                      </span>
                      {s?.name}
                    </div>
                  );
                })}
                {quiz && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      fontSize: 11.5,
                      color: "var(--green-text)",
                      fontWeight: 700,
                    }}
                  >
                    <Icon name="check" size={13} />
                    Quiz e aceite formal
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
              }}
            >
              <Eyebrow style={{ marginBottom: 7 }}>Alcance</Eyebrow>
              <div
                className="mono"
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "var(--ink)",
                  lineHeight: 1,
                }}
              >
                {people.length}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  marginTop: 4,
                }}
              >
                pessoas recebem o pedido de aceite
              </div>
            </div>
          </>
        }
        asideWidth={290}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <FormField label="Nome da trilha" required>
            <TextInput
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Dado de paciente e IA"
              value={name}
            />
          </FormField>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <FormField label="Público" required>
              <Select
                onChange={(e) => setAudience(e.target.value)}
                options={AUDIENCES}
                value={audience}
              />
            </FormField>
            <FormField label="Re-certificação" required>
              <Segmented
                full
                onChange={setRecert}
                options={[{ value: "Anual" }, { value: "Semestral" }]}
                value={recert}
              />
            </FormField>
          </div>
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>
              Seções que compõem a trilha · somente publicadas
            </Eyebrow>
            <div
              className="scroll"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {sections.map((s) => {
                const publishable = s.status === "PUBLISHED";
                return (
                  <CheckRow
                    checked={picked.includes(s.id)}
                    disabled={!publishable}
                    hint={
                      publishable
                        ? `${s.words} palavras · ~6 min`
                        : `${s.statusLabel} — não pode entrar em trilha`
                    }
                    key={s.id}
                    label={`${String(s.ordinal).padStart(2, "0")} · ${s.name}`}
                    onToggle={() => toggle(s.id)}
                    tone="green"
                  />
                );
              })}
            </div>
          </div>
          <FormField
            hint="Uma pessoa por linha, no formato: Nome, Área"
            label="Pessoas atribuídas"
          >
            <TextArea
              onChange={(e) => setRoster(e.target.value)}
              placeholder={"Marina Alves, Compliance\nDiego Prado, Segurança"}
              rows={5}
              value={roster}
            />
          </FormField>
          <div
            style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}
          >
            <CheckRow
              checked={quiz}
              hint="Sem aceite formal, não há evidência de comunicação da política"
              label="Exigir quiz e aceite formal"
              onToggle={() => setQuiz((v) => !v)}
              tone="green"
            />
          </div>
        </div>
      </ModalSplit>
    </ModalShell>
  );
}

// ── 11. ExportPackageModal (FR-11.5, FR-11.6) ─────────────────────────────────

const ARTIFACTS = [
  { id: "policy", label: "Política e seções" },
  { id: "decision", label: "Casos e decisões" },
  { id: "risk", label: "Risco e mitigações" },
  { id: "vendor", label: "Fornecedores e cláusulas" },
  { id: "onboarding", label: "Onboarding e aceites" },
  { id: "export", label: "Exportações anteriores" },
];

export function ExportPackageModal({
  onClose,
  onSubmit,
  pending,
  result,
}: {
  onClose: () => void;
  onSubmit: (input: {
    from: string;
    to: string;
    categories: string[];
    format: "csv" | "json";
  }) => void;
  pending: boolean;
  result: string | null;
}) {
  const [from, setFrom] = useState("2026-04-01");
  const [to, setTo] = useState("2026-06-30");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [arts, setArts] = useState<string[]>([
    "policy",
    "decision",
    "risk",
    "vendor",
  ]);
  const toggle = (id: string) =>
    setArts((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const ready = arts.length > 0 && from !== "" && to !== "";

  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Icon name="lock" size={12} />
            {result ?? "Referências imutáveis aos registros de origem"}
          </FooterHint>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={onClose} size="md" variant="secondary">
              Fechar
            </Button>
            <GatedAction
              ready={ready && !pending}
              reason="Informe o período e ao menos um artefato"
            >
              <Button
                icon="download"
                onClick={() => onSubmit({ from, to, categories: arts, format })}
                size="md"
              >
                {pending ? "Gerando…" : "Gerar pacote"}
              </Button>
            </GatedAction>
          </div>
        </>
      }
      icon="download"
      onClose={onClose}
      subtitle="Período, artefatos e formato — a exportação também é registrada"
      title="Montar pacote de evidência"
      tone="accent"
      width={760}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 15,
          padding: 22,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          <FormField label="De" required>
            <TextInput
              onChange={(e) => setFrom(e.target.value)}
              type="date"
              value={from}
            />
          </FormField>
          <FormField label="Até" required>
            <TextInput
              onChange={(e) => setTo(e.target.value)}
              type="date"
              value={to}
            />
          </FormField>
          <FormField label="Formato" required>
            <Select
              onChange={(e) => setFormat(e.target.value as "csv" | "json")}
              options={[
                { value: "csv", label: "CSV" },
                { value: "json", label: "JSON" },
              ]}
              value={format}
            />
          </FormField>
        </div>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Artefatos incluídos</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {ARTIFACTS.map((a) => (
              <CheckRow
                checked={arts.includes(a.id)}
                key={a.id}
                label={a.label}
                onToggle={() => toggle(a.id)}
                tone="accent"
              />
            ))}
          </div>
        </div>
        <Callout icon="history" tone="accent">
          A exportação grava a si mesma na trilha: quem exportou, período e
          escopo. Sem isso, o momento em que dado de governança sai do sistema
          seria a única ação sem rastro.
        </Callout>
      </div>
    </ModalShell>
  );
}
