"use client";

// modals-intake.tsx — IntakeModal (FR-4), a tela mais importante do produto.
//
// Extraído de modals.tsx, que está na baseline do file-size-guard e não pode
// crescer: qualquer mudança no intake passa a acontecer aqui. Anatomia
// preservada 1:1 — ModalSplit com trilho de avaliação ao vivo, e Callout
// carregando a razão na tela em vez de tooltip. `GatedAction` e `DataClass`
// continuam em modals.tsx porque os outros modais também os usam.

import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, Button } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { VendorRow } from "@/app/(charter)/actions/vendors";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_ORDER,
  DATA_CLASS_RULE,
  DATA_CLASS_TONE,
  HITL_LABEL,
  recommendPath,
  type Tone,
  vendorEligibility,
} from "@/lib/charter/rules";
import { Eyebrow, MetaCell } from "./base";
import {
  Callout,
  FooterHint,
  FormField,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from "./form-kit";
import { ModalShell, ModalSplit } from "./modal";
import { type DataClass, GatedAction } from "./modals";

type Exposure = "INTERNAL" | "EXTERNAL";
type Criticality = "LOW" | "MEDIUM" | "HIGH";

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
          {vendor && gate?.eligible === false && (
            <Callout icon="ban" tone="red">
              A combinação escolhida não é permitida pela política vigente:{" "}
              <strong>{vendor.name}</strong> não pode processar dado{" "}
              <strong>{DATA_CLASS_LABEL[dataClass]}</strong>. {gate.reason}{" "}
              {/* A saída, não só o motivo: a classe máxima vem das cláusulas. */}
              <Link
                href={`/charter/vendor/${vendor.code}`}
                style={{ color: "var(--red-text)", fontWeight: 700 }}
              >
                Ajustar cláusulas de {vendor.name}
              </Link>
            </Callout>
          )}
        </div>
      </ModalSplit>
    </ModalShell>
  );
}
