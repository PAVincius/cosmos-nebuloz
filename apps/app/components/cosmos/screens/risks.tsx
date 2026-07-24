"use client";

// risks.tsx — Registro de riscos (ROAM) + matriz probabilidade × impacto,
// wired to listRisks(). O modelo Risk real usa probability/impact em escala
// string (low/medium/high), então a matriz é uma grade 3×3 (em vez da 5×5
// numérica dos dados de demonstração).
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import {
  createRisk,
  listRisks,
  type RiskView,
} from "@/app/(cosmos)/actions/risks";
import { EmptyState } from "../empty-state";
import { Icon } from "../icons";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const LEVELS = ["low", "medium", "high"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_LABEL: Record<Level, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

// Mapeia low/medium/high para pontos ordinais 2/3/4 (não há escala 1-5 no
// schema real) para reaproveitar a matemática de severidade prob × impact.
const LEVEL_SCORE: Record<Level, number> = { low: 2, medium: 3, high: 4 };

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

// Tom da CÉLULA da matriz probabilidade × impacto, com base no
// severityScore derivado (range 4-16, produto de LEVEL_SCORE). Os 9
// combos possíveis de (probabilidade, impacto) geram os scores
// {4, 6, 8, 9, 12, 16}, então os limiares abaixo cobrem as 4 faixas:
// green apenas no score 4 (low×low), blue em 6/8, amber em 9/12, red em 16.
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
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
            gap: 6,
            aspectRatio: "3 / 2.4",
          }}
        >
          {[...LEVELS].reverse().map((p) =>
            LEVELS.map((i) => {
              const items = cell(p, i);
              const s = severityScore(p, i);
              const tone = matrixCellTone(s);
              return (
                <div
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
                        color: "#fff",
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

function RiskRow({ r }: { r: RiskView }) {
  const sevTone = severityTone(r.severity);
  const roamTone = ROAM_TONE[r.roamStatus] || "neutral";

  return (
    <div
      className="lift"
      style={{
        display: "grid",
        gridTemplateColumns: "52px minmax(0,1fr) 96px 110px 132px",
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
          color: "#fff",
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
    close();
    if (res.ok) {
      onCreated?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="plus" size={16} strokeWidth={2.4} />}
      subtitle="Adicionar um risco ao registro ROAM do ART"
      title="Registrar risco"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="risk-title" style={fieldLabelStyle}>
            Título do risco
          </label>
          <input
            autoFocus
            id="risk-title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                create();
              }
            }}
            placeholder="Ex: Instabilidade no gateway de pagamento…"
            style={selectStyle}
            value={title}
          />
        </div>

        <div>
          <label htmlFor="risk-description" style={fieldLabelStyle}>
            Descrição
          </label>
          <textarea
            id="risk-description"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contexto, causa raiz, impacto potencial…"
            rows={3}
            style={{ ...selectStyle, resize: "vertical" }}
            value={description}
          />
        </div>

        <div>
          <label htmlFor="risk-category" style={fieldLabelStyle}>
            Categoria
          </label>
          <select
            id="risk-category"
            onChange={(e) =>
              setCategory(e.target.value as (typeof CATEGORIES)[number] | "")
            }
            style={selectStyle}
            value={category}
          >
            <option value="">Sem categoria</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              ...fieldLabelStyle,
            }}
          >
            <span>Severidade</span>
            <span className="mono" style={{ color: "var(--accent-text)" }}>
              {severity}
            </span>
          </div>
          <input
            max={5}
            min={1}
            onChange={(e) => setSeverity(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
            type="range"
            value={severity}
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label htmlFor="risk-probability" style={fieldLabelStyle}>
              Probabilidade
            </label>
            <select
              id="risk-probability"
              onChange={(e) => setProbability(e.target.value as Level)}
              style={selectStyle}
              value={probability}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="risk-impact" style={fieldLabelStyle}>
              Impacto
            </label>
            <select
              id="risk-impact"
              onChange={(e) => setImpact(e.target.value as Level)}
              style={selectStyle}
              value={impact}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Registrar risco
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

  return (
    <div className="fade-in">
      <PageHeader
        meta={
          <>
            <Badge dot tone="red">
              {critical} críticos
            </Badge>
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
                  <RiskRow key={r.id} r={r} />
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
