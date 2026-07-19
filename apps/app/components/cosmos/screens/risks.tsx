"use client";

// risks.tsx — Registro de riscos (ROAM) + matriz probabilidade × impacto,
// wired to listRisks(). O modelo Risk real usa probability/impact em escala
// string (low/medium/high), então a matriz é uma grade 3×3 (em vez da 5×5
// numérica dos dados de demonstração).
import { useEffect, useState } from "react";
import { listRisks, type RiskView } from "@/app/(cosmos)/actions/risks";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
} from "../kit";

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

function severityTone(s: number): "green" | "blue" | "amber" | "red" {
  if (s >= 16) {
    return "red";
  }
  if (s >= 9) {
    return "amber";
  }
  if (s >= 4) {
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
              const s = LEVEL_SCORE[p] * LEVEL_SCORE[i];
              const tone = severityTone(s);
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
  const s = severityScore(r.probability, r.impact);
  const sevTone = severityTone(s);
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
        {s}
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
        <Avatar name="—" size={22} tone="accent" />
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
          —
        </span>
      </div>
    </div>
  );
}

export default function RisksScreen() {
  const [risks, setRisks] = useState<RiskView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    listRisks().then((r) => {
      if (r.ok) {
        setRisks(r.data);
      } else {
        setError(r.error);
      }
      setLoading(false);
    });
  }, []);

  const sorted = [...risks].sort(
    (a, b) =>
      severityScore(b.probability, b.impact) -
      severityScore(a.probability, a.impact)
  );
  const critical = risks.filter(
    (r) => severityScore(r.probability, r.impact) >= 16
  ).length;
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
        <Button icon="plus" size="md" variant="primary">
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
              <div style={{ padding: 16, color: "var(--ink-faint)" }}>
                Nenhum risco registrado.
              </div>
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
