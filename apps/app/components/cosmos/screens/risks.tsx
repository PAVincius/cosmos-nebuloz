"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
// risks.tsx — Registro de riscos (ROAM) + matriz probabilidade × impacto,
// wired to listRisks(). story-059 AC-004: probability/impact usam o vocabulário
// de cinco níveis (very_low…very_high), então a matriz é a grade 5×5 do desenho
// (apps/app/lib/cosmos-data.ts:833) e não mais a 3×3 provisória. Os valores
// legados low/medium/high seguem válidos e caem nas mesmas células de antes.
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import {
  createRisk,
  listRisks,
  type RiskView,
  roamTransition,
} from "@/app/(cosmos)/actions/risks";
import {
  getMembersTab,
  type MembersTabView,
} from "@/app/(cosmos)/actions/settings-members";
import { EmptyState } from "../empty-state";
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
  MiniSlider,
  Select,
  TextArea,
  TextInput,
} from "../modal-form";
import { useActionToast } from "../use-action-toast";

const LEVELS = ["very_low", "low", "medium", "high", "very_high"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_LABEL: Record<Level, string> = {
  very_low: "Muito baixa",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  very_high: "Muito alta",
};

// Pontos ordinais 1-5. Os pesos de low/medium/high continuam 2/3/4: as duas
// pontas novas ocupam exatamente as posições 1 e 5 que a escala anterior tinha
// deixado vagas, então nenhum risco já gravado muda de célula nem de cor.
const LEVEL_SCORE: Record<Level, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

const ROAM_TONE: Record<string, "green" | "amber" | "blue" | "neutral"> = {
  RESOLVED: "green",
  OWNED: "amber",
  ACCEPTED: "blue",
  MITIGATED: "green",
  UNCLASSIFIED: "neutral",
};

function toLevel(value: string): Level {
  return LEVELS.includes(value as Level) ? (value as Level) : "medium";
}

function severityScore(probability: string, impact: string): number {
  return LEVEL_SCORE[toLevel(probability)] * LEVEL_SCORE[toLevel(impact)];
}

// Tom da CÉLULA da matriz probabilidade × impacto, com base no severityScore
// derivado (range 1-25, produto de LEVEL_SCORE). Os limiares são os mesmos da
// grade 3×3 anterior — é o que garante que um risco gravado antes da story-059
// continue com a cor que já tinha; as células novas apenas se encaixam nas
// faixas existentes.
function matrixCellTone(s: number): "green" | "blue" | "amber" | "red" {
  if (s >= 16) {
    return "red";
  }
  if (s >= 9) {
    return "amber";
  }
  if (s >= 6) {
    return "blue";
  }
  return "green";
}

// Tom do BADGE/linha do registro de riscos, com base no campo real
// `severity` (1-5, definido explicitamente pelo RTE) — não no score
// derivado de probabilidade × impacto.
function severityTone(severity: number): "green" | "blue" | "amber" | "red" {
  if (severity >= 5) {
    return "red";
  }
  if (severity >= 4) {
    return "amber";
  }
  if (severity >= 3) {
    return "blue";
  }
  return "green";
}

function RiskMatrix({ risks }: { risks: RiskView[] }) {
  const cell = (p: Level, i: Level) =>
    risks.filter(
      (r) => toLevel(r.probability) === p && toLevel(r.impact) === i
    );

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          Probabilidade →
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gridTemplateRows: "repeat(5, 1fr)",
            gap: 6,
            aspectRatio: "5 / 4",
          }}
        >
          {[...LEVELS].reverse().map((p) =>
            LEVELS.map((i) => {
              const items = cell(p, i);
              const s = severityScore(p, i);
              const tone = matrixCellTone(s);
              return (
                <div
                  data-cell={`${p}-${i}`}
                  key={`${p}-${i}`}
                  style={{
                    position: "relative",
                    borderRadius: "var(--r-sm)",
                    border: `1px solid rgba(var(--${tone}-rgb),.28)`,
                    background: `rgba(var(--${tone}-rgb),${items.length ? 0.16 : 0.055})`,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    padding: 6,
                    alignContent: "flex-start",
                    minHeight: 0,
                  }}
                >
                  {items.map((r) => (
                    <span
                      className="mono"
                      key={r.id}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--on-solid)",
                        background: `var(--${tone})`,
                        borderRadius: 5,
                        padding: "2px 5px",
                        boxShadow: `0 2px 6px -1px rgba(var(--${tone}-rgb),.6)`,
                        cursor: "default",
                      }}
                      title={r.title}
                    >
                      {r.id.slice(0, 6)}
                    </span>
                  ))}
                </div>
              );
            })
          )}
        </div>
        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          Impacto →
        </div>
      </div>
    </div>
  );
}

function RiskRow({ r, onClassify }: { r: RiskView; onClassify: () => void }) {
  const sevTone = severityTone(r.severity);
  const roamTone = ROAM_TONE[r.roamStatus] || "neutral";

  return (
    <div
      className="lift"
      style={{
        display: "grid",
        gridTemplateColumns: "52px minmax(0,1fr) 96px 110px 132px auto",
        alignItems: "center",
        gap: 14,
        padding: "13px 16px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          borderRadius: "var(--r-sm)",
          background: `var(--${sevTone})`,
          color: "var(--on-solid)",
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 14,
          fontWeight: 800,
          boxShadow: `0 4px 12px -3px rgba(var(--${sevTone}-rgb),.6)`,
        }}
      >
        {r.severity}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-subtle)",
              fontWeight: 600,
            }}
          >
            {r.id.slice(0, 8)}
          </span>
          <Badge dot tone="neutral">
            {r.category}
          </Badge>
        </div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.35,
            textWrap: "pretty",
          }}
        >
          {r.title}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            fontSize: 10,
            color: "var(--ink-faint)",
            fontWeight: 700,
            letterSpacing: ".04em",
          }}
        >
          P: {LEVEL_LABEL[toLevel(r.probability)]} · I:{" "}
          {LEVEL_LABEL[toLevel(r.impact)]}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Badge dot tone={roamTone}>
          {r.roamStatus}
        </Badge>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <Avatar
          name={r.ownerName === "—" ? undefined : r.ownerName}
          size={22}
          tone="accent"
        />
        <span
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {r.ownerName}
        </span>
      </div>
      {/* story-059 AC-001 — sem este botão o risco nasce UNCLASSIFIED e congela:
          o gate de commitment do PI nunca pode ser satisfeito pela tela que
          registra o risco. */}
      <button
        aria-label={`Classificar ROAM de ${r.title}`}
        onClick={onClassify}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-muted)",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".04em",
          padding: "6px 10px",
        }}
        type="button"
      >
        ROAM
      </button>
    </div>
  );
}

const CATEGORIES = [
  "TECHNICAL",
  "BUSINESS",
  "DEPENDENCY",
  "EXTERNAL",
  "COMPLIANCE",
  "CAPACITY",
  "IMPEDIMENT",
] as const;

const CATEGORY_LABEL: Record<(typeof CATEGORIES)[number], string> = {
  TECHNICAL: "Técnico",
  BUSINESS: "Negócio",
  DEPENDENCY: "Dependência",
  EXTERNAL: "Externo",
  COMPLIANCE: "Compliance",
  CAPACITY: "Capacidade",
  IMPEDIMENT: "Impedimento",
};

const selectStyle: CSSProperties = {
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

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

function NewRiskModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number] | "">(
    ""
  );
  const [severity, setSeverity] = useState(3);
  const [probability, setProbability] = useState<Level>("medium");
  const [impact, setImpact] = useState<Level>("medium");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  // Duas leituras diferentes da mesma tela: o cabeçalho segue `severity`, que
  // é a coluna que colore o registro de riscos, e a exposição segue
  // probabilidade × impacto, que é a que decide a célula da matriz. Mostrar as
  // duas evita registrar um risco severidade 5 que cai numa célula verde sem
  // ninguém notar a contradição.
  const tone = severityTone(severity);
  const exposicao = severityScore(probability, impact);
  const toneExposicao = matrixCellTone(exposicao);

  const create = async () => {
    if (!title.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createRisk({
          title: title.trim(),
          description: description.trim() || undefined,
          category: category || undefined,
          severity,
          probability,
          impact,
        }),
      {
        loading: "Registrando risco...",
        success: "Risco registrado.",
        error: (err: string) => `Não foi possível registrar o risco: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onCreated?.();
    }
  };

  useModalSubmitShortcut(create, !saving);

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
              <ModalShortcutHint salvar="registrar" />
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
                <Button
                  icon="check"
                  onClick={create}
                  size="sm"
                  variant="primary"
                >
                  {saving ? "Registrando..." : "Registrar risco"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="shield" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Risco ROAM — classificado por severidade e por probabilidade × impacto"
        title="Registrar risco"
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
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <Badge tone={tone}>{`Severidade ${severity}`}</Badge>
                <Badge dot tone="neutral">
                  UNCLASSIFIED
                </Badge>
              </div>
              <div
                className="display"
                style={{
                  color: "var(--ink)",
                  fontSize: 14.5,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: 8,
                }}
              >
                {title || "Título do risco"}
              </div>
              <div
                style={{
                  color: "var(--ink-muted)",
                  fontSize: 12,
                  lineHeight: 1.55,
                  marginBottom: 14,
                }}
              >
                {description || "Contexto, causa raiz, impacto potencial..."}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1fr 1fr",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={previewLabelStyle}>Probabilidade</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {LEVEL_LABEL[probability]}
                  </div>
                </div>
                <div>
                  <div style={previewLabelStyle}>Impacto</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {LEVEL_LABEL[impact]}
                  </div>
                </div>
              </div>

              <div
                className="mono"
                style={{
                  color: `var(--${toneExposicao}-text)`,
                  fontSize: 11.5,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                {`Exposição ${exposicao}/25 na matriz`}
              </div>

              <div style={previewLabelStyle}>Categoria</div>
              <div style={{ fontSize: 12.5, marginBottom: 14 }}>
                {category ? CATEGORY_LABEL[category] : "Sem categoria"}
              </div>

              {/* O gate de commitment do PI recusa risco UNCLASSIFIED: dizer
                  isso aqui evita a surpresa de descobrir o pendente só na
                  hora de fechar o PI. */}
              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  lineHeight: 1.5,
                  paddingTop: 10,
                }}
              >
                Nasce sem desfecho ROAM — o RTE classifica depois, pelo botão
                ROAM do registro.
              </div>
            </div>
          }
        >
          <FormField label="Título do risco" required>
            <TextInput
              onChange={setTitle}
              placeholder="ex: Instabilidade no gateway de pagamento"
              required
              value={title}
            />
          </FormField>
          <FormField label="Descrição">
            <TextArea
              maxLength={2000}
              onChange={setDescription}
              placeholder="Contexto, causa raiz, impacto potencial"
              rows={3}
              value={description}
            />
          </FormField>
          <FormField label="Categoria">
            <Select
              onChange={(v) =>
                setCategory(v as (typeof CATEGORIES)[number] | "")
              }
              options={[
                { value: "", label: "Sem categoria" },
                ...CATEGORIES.map((c) => ({
                  value: c,
                  label: CATEGORY_LABEL[c],
                })),
              ]}
              value={category}
            />
          </FormField>
          <MiniSlider
            label="Severidade"
            max={5}
            min={1}
            onChange={setSeverity}
            value={severity}
          />
          <div
            style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}
          >
            <FormField label="Probabilidade">
              <Select
                onChange={(v) => setProbability(v as Level)}
                options={LEVELS.map((l) => ({
                  value: l,
                  label: LEVEL_LABEL[l],
                }))}
                value={probability}
              />
            </FormField>
            <FormField label="Impacto">
              <Select
                onChange={(v) => setImpact(v as Level)}
                options={LEVELS.map((l) => ({
                  value: l,
                  label: LEVEL_LABEL[l],
                }))}
                value={impact}
              />
            </FormField>
          </div>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

// story-059 AC-001/AC-002 — os quatro desfechos ROAM e o compromisso que cada
// um exige. UNCLASSIFIED não aparece: é estado de nascimento, não destino.
const ROAM_OUTCOMES = ["OWNED", "ACCEPTED", "MITIGATED", "RESOLVED"] as const;
type RoamOutcome = (typeof ROAM_OUTCOMES)[number];

const ROAM_LABEL: Record<RoamOutcome, string> = {
  OWNED: "Owned — alguém assume",
  ACCEPTED: "Accepted — conviver com ele",
  MITIGATED: "Mitigated — há plano de mitigação",
  RESOLVED: "Resolved — deixou de existir",
};

const MIN_MITIGATION_PLAN_LENGTH = 30;

function RoamModal({
  risk: r,
  onClassified,
}: {
  risk: RiskView;
  onClassified?: () => void;
}) {
  const { close } = useModal();
  const [outcome, setOutcome] = useState<RoamOutcome>("OWNED");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [mitigationPlan, setMitigationPlan] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [members, setMembers] = useState<MembersTabView["members"]>([]);
  const [saving, setSaving] = useState(false);

  // O dono sai da lista real de membros do tenant — nenhum id é digitado à mão.
  useEffect(() => {
    getMembersTab().then((res) => {
      if (res.ok) {
        setMembers(res.data.members);
      }
    });
  }, []);

  // Mesmo guard do servidor, aplicado antes da chamada: o servidor continua
  // sendo a autoridade (roamGuard em actions/risks.ts), isto só evita mandar
  // uma transição que já se sabe inválida.
  const missingCommitment =
    (outcome === "OWNED" && !ownerUserId) ||
    (outcome === "MITIGATED" &&
      mitigationPlan.trim().length < MIN_MITIGATION_PLAN_LENGTH) ||
    (outcome === "RESOLVED" && !resolutionNote.trim());

  const classify = async () => {
    if (missingCommitment || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        roamTransition({
          riskId: r.id,
          roamStatus: outcome,
          ...(outcome === "OWNED" ? { ownerUserId } : {}),
          ...(outcome === "MITIGATED"
            ? { mitigationPlan: mitigationPlan.trim() }
            : {}),
          ...(outcome === "RESOLVED"
            ? { resolutionNote: resolutionNote.trim() }
            : {}),
        }),
      {
        loading: "Gravando desfecho ROAM...",
        success: "Desfecho ROAM gravado.",
        error: (err: string) => `Não foi possível classificar o risco: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onClassified?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="shield" size={16} strokeWidth={2.4} />}
      subtitle="Nenhum risco entra no commitment do PI sem desfecho"
      title={`Classificar ${r.title}`}
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="roam-outcome" style={fieldLabelStyle}>
            Desfecho ROAM
          </label>
          <select
            id="roam-outcome"
            onChange={(e) => setOutcome(e.target.value as RoamOutcome)}
            style={selectStyle}
            value={outcome}
          >
            {ROAM_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {ROAM_LABEL[o]}
              </option>
            ))}
          </select>
        </div>

        {outcome === "OWNED" && (
          <div>
            <label htmlFor="roam-owner" style={fieldLabelStyle}>
              Dono do risco
            </label>
            <select
              id="roam-owner"
              onChange={(e) => setOwnerUserId(e.target.value)}
              style={selectStyle}
              value={ownerUserId}
            >
              <option value="">Selecione um membro…</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {outcome === "MITIGATED" && (
          <div>
            <label htmlFor="roam-plan" style={fieldLabelStyle}>
              Plano de mitigação (mín. {MIN_MITIGATION_PLAN_LENGTH} caracteres)
            </label>
            <textarea
              id="roam-plan"
              onChange={(e) => setMitigationPlan(e.target.value)}
              placeholder="O que será feito, por quem, até quando…"
              rows={3}
              style={{ ...selectStyle, resize: "vertical" }}
              value={mitigationPlan}
            />
          </div>
        )}

        {outcome === "RESOLVED" && (
          <div>
            <label htmlFor="roam-note" style={fieldLabelStyle}>
              Nota de resolução
            </label>
            <textarea
              id="roam-note"
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="O que fez o risco deixar de existir…"
              rows={3}
              style={{ ...selectStyle, resize: "vertical" }}
              value={resolutionNote}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={classify} size="sm" variant="primary">
            Gravar desfecho
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function RisksBody() {
  const modal = useModal();
  const [risks, setRisks] = useState<RiskView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(() => {
    setLoading(true);
    listRisks().then((r) => {
      if (r.ok) {
        setRisks(r.data);
      } else {
        setError(r.error);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // listRisks() já retorna os riscos ordenados por severity desc
  // (orderBy no servidor), então não é necessário reordenar no cliente.
  const sorted = risks;
  const critical = risks.filter((r) => r.severity >= 4).length;
  const open = risks.filter((r) => r.roamStatus === "OWNED").length;
  const resolved = risks.filter(
    (r) => r.roamStatus === "RESOLVED" || r.roamStatus === "MITIGATED"
  ).length;
  // story-019 AC-003 — PI com risco UNCLASSIFIED não comita. O contador põe o
  // gate à vista de quem pode fechá-lo, em vez de deixá-lo aparecer só na hora
  // do commit.
  const unclassified = risks.filter(
    (r) => r.roamStatus === "UNCLASSIFIED"
  ).length;

  return (
    <div className="fade-in">
      <PageHeader
        meta={
          <>
            <Badge dot tone="red">
              {critical} críticos
            </Badge>
            {unclassified > 0 && (
              <Badge dot tone="neutral">
                {unclassified} sem classificação ROAM
              </Badge>
            )}
            <Badge tone="amber">{open} em aberto (Owned)</Badge>
            <Badge icon="check" tone="green">
              {resolved} endereçados
            </Badge>
          </>
        }
        subtitle="Registro de riscos do ART classificado por ROAM e severidade (probabilidade × impacto). Revisado a cada sync de PI."
        title="Riscos"
      >
        <Button icon="filter" size="md" variant="secondary">
          Por ART
        </Button>
        <Button
          icon="plus"
          onClick={() => modal.open(<NewRiskModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Registrar risco
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState message={error} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.6fr",
            gap: "var(--gap)",
            alignItems: "start",
          }}
        >
          <SectionCard
            icon="scale"
            subtitle="Probabilidade × impacto · severidade por cor"
            title="Matriz de risco"
          >
            <RiskMatrix risks={risks} />
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                marginTop: 16,
                justifyContent: "center",
              }}
            >
              {[
                { t: "green", l: "Baixo" },
                { t: "blue", l: "Moderado" },
                { t: "amber", l: "Alto" },
                { t: "red", l: "Crítico" },
              ].map((x) => (
                <span
                  key={x.l}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    color: "var(--ink-muted)",
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: `var(--${x.t})`,
                    }}
                  />
                  {x.l}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            action={<Badge tone="neutral">{risks.length} riscos</Badge>}
            bodyStyle={{ padding: 12 }}
            icon="shield"
            subtitle="Ordenado por severidade"
            title="Registro de riscos"
          >
            {loading ? (
              <div style={{ padding: 16, color: "var(--ink-faint)" }}>
                Carregando…
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState
                description="Riscos identificados no PI aparecerão aqui, com probabilidade, impacto e status ROAM."
                icon="shield"
                title="Nenhum risco registrado"
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {sorted.map((r) => (
                  <RiskRow
                    key={r.id}
                    onClassify={() =>
                      modal.open(<RoamModal onClassified={load} risk={r} />)
                    }
                    r={r}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

export default function RisksScreen() {
  return (
    <ModalProvider>
      <RisksBody />
    </ModalProvider>
  );
}
