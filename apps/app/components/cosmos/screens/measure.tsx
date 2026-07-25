"use client";

import { useState } from "react";
import {
  type CompetencyScoreView,
  listCompetencyScores,
} from "@/app/(cosmos)/actions/measure";
// measure.tsx — Measure & Grow, wired to listCompetencyScores(). Latest and
// prior score per SAFe core competency (7 competencies, 1–5 scale), plus a
// radar comparing the two cycles. DORA metrics (RF-78) have no corresponding
// Prisma model yet — out of scope, not fabricated here.
import { EmptyState } from "../empty-state";
import {
  Badge,
  ChartTip,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useAction,
} from "../kit";

function scoreTone(
  score: number | null
): "green" | "amber" | "red" | "neutral" {
  if (score === null) {
    return "neutral";
  }
  if (score < 2.5) {
    return "red";
  }
  if (score < 3.5) {
    return "amber";
  }
  return "green";
}

// Radar over the competencies that actually have a current score. A
// competency the tenant never assessed has no honest position on the 1–5
// scale, so it's simply excluded from the axes rather than plotted at 0.
// The "previous cycle" overlay only draws when *every* plotted competency
// has a real prior assessment — a partial prior cycle would force a fake
// value onto whichever axes lack one, which is exactly the kind of
// fabrication this screen exists to avoid.
function Radar({
  items,
  showPrev,
  size = 320,
  hoverIdx,
  onHover,
}: {
  items: CompetencyScoreView[];
  showPrev: boolean;
  size?: number;
  hoverIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  const n = items.length;
  const maxV = 5;
  const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, radius: number): [number, number] => [
    cx + Math.cos(ang(i)) * radius,
    cy + Math.sin(ang(i)) * radius,
  ];
  const poly = (key: "score" | "prevScore") =>
    items
      .map((it, i) => pt(i, ((it[key] ?? 0) / maxV) * r).join(","))
      .join(" ");
  const active = hoverIdx !== null ? items[hoverIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        style={{
          display: "block",
          maxWidth: size,
          margin: "0 auto",
          overflow: "visible",
        }}
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
      >
        {[1, 2, 3, 4, 5].map((ring) => (
          <polygon
            fill="none"
            key={ring}
            points={items
              .map((_, i) => pt(i, (ring / maxV) * r).join(","))
              .join(" ")}
            stroke="var(--hairline)"
            strokeWidth="1"
          />
        ))}
        {items.map((it, i) => {
          const [ex, ey] = pt(i, r);
          const [lx, ly] = pt(i, r + 30);
          const anchor =
            Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
          const hot = hoverIdx === i;
          return (
            <g key={it.competency}>
              <line
                stroke={hot ? "var(--accent)" : "var(--hairline)"}
                strokeWidth={hot ? 2 : 1}
                x1={cx}
                x2={ex}
                y1={cy}
                y2={ey}
              />
              <text
                className="chart-hit"
                dominantBaseline="middle"
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
                style={{
                  fontSize: 10,
                  fontWeight: hot ? 800 : 600,
                  fill: hot ? "var(--accent)" : "var(--ink-muted)",
                }}
                textAnchor={anchor}
                x={lx}
                y={ly}
              >
                {it.competencyLabel}
              </text>
            </g>
          );
        })}
        {showPrev && (
          <polygon
            fill="none"
            points={poly("prevScore")}
            stroke="var(--ink-faint)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        )}
        <polygon
          fill="rgba(var(--accent-rgb),.16)"
          opacity={hoverIdx === null ? 1 : 0.55}
          points={poly("score")}
          stroke="var(--accent)"
          strokeLinejoin="round"
          strokeWidth="2.4"
          style={{ filter: "drop-shadow(0 0 8px rgba(var(--accent-rgb),.4))" }}
        />
        {items.map((it, i) => {
          const [x, y] = pt(i, ((it.score ?? 0) / maxV) * r);
          const hot = hoverIdx === i;
          return (
            <g key={it.competency}>
              <circle
                className="chart-hit"
                cx={x}
                cy={y}
                fill="transparent"
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
                r="13"
              />
              <circle
                cx={x}
                cy={y}
                fill="var(--surface)"
                r={hot ? 5.5 : 3.4}
                stroke="var(--accent)"
                strokeWidth={hot ? 2.8 : 2.2}
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}
      </svg>
      {active && hoverIdx !== null && (
        <ChartTip left={((hoverIdx + 0.5) / n) * 100} top={0}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {active.competencyLabel}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span>
              Atual <b className="mono">{active.score?.toFixed(1) ?? "—"}</b>
            </span>
            {showPrev && (
              <span style={{ color: "var(--ink-faint)" }}>
                Anterior{" "}
                <b className="mono">{active.prevScore?.toFixed(1) ?? "—"}</b>
              </span>
            )}
          </div>
        </ChartTip>
      )}
    </div>
  );
}

function RadarCard({ rows }: { rows: CompetencyScoreView[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const scored = rows.filter((c) => c.score !== null);
  const showPrev =
    scored.length > 0 && scored.every((c) => c.prevScore !== null);

  return (
    <SectionCard
      icon="compass"
      subtitle={
        showPrev
          ? "Passe o mouse para comparar ciclo atual vs. anterior"
          : "Ciclo atual — ainda sem ciclo anterior completo para comparação"
      }
      title="Radar de competências"
      tone="accent"
    >
      {scored.length < 3 ? (
        <EmptyState
          description="O radar precisa de ao menos 3 competências avaliadas para desenhar os eixos."
          icon="compass"
          title="Avaliações insuficientes para o radar"
        />
      ) : (
        <>
          <div style={{ padding: "12px 0 8px" }}>
            <Radar
              hoverIdx={hoverIdx}
              items={scored}
              onHover={setHoverIdx}
              showPrev={showPrev}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              paddingBottom: 8,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                color: "var(--ink-muted)",
                fontWeight: 600,
              }}
            >
              <svg height={8} width={28}>
                <line
                  stroke="var(--accent)"
                  strokeLinecap="round"
                  strokeWidth={2.4}
                  x1={2}
                  x2={26}
                  y1={4}
                  y2={4}
                />
              </svg>
              Ciclo atual
            </span>
            {showPrev && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: "var(--ink-faint)",
                  fontWeight: 600,
                }}
              >
                <svg height={8} width={28}>
                  <line
                    stroke="var(--ink-faint)"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    strokeWidth={1.5}
                    x1={2}
                    x2={26}
                    y1={4}
                    y2={4}
                  />
                </svg>
                Ciclo anterior
              </span>
            )}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: "var(--ink-faint)",
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: ".04em",
                }}
              >
                ESCALA
              </span>
              <span className="mono" style={{ fontWeight: 700 }}>
                1–5
              </span>
            </span>
          </div>
        </>
      )}
    </SectionCard>
  );
}

export default function MeasureScreen() {
  const { data, loading, error } = useAction(listCompetencyScores);
  const rows = data ?? [];
  const scored = rows.filter(
    (c): c is CompetencyScoreView & { score: number } => c.score !== null
  );
  const withDelta = rows.filter(
    (c): c is CompetencyScoreView & { delta: number } => c.delta !== null
  );

  const avgMaturity =
    scored.length > 0
      ? scored.reduce((sum, c) => sum + c.score, 0) / scored.length
      : null;
  const avgDelta =
    withDelta.length > 0
      ? withDelta.reduce((sum, c) => sum + c.delta, 0) / withDelta.length
      : null;
  const improved = withDelta.filter((c) => c.delta > 0).length;
  const strongest =
    scored.length > 0 ? [...scored].sort((a, b) => b.score - a.score)[0] : null;
  const weakest =
    scored.length > 0 ? [...scored].sort((a, b) => a.score - b.score)[0] : null;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ART Board"
        meta={
          <>
            <Badge tone="accent">{rows.length} competências</Badge>
            {withDelta.length > 0 && (
              <Badge dot tone="green">
                {improved} em evolução
              </Badge>
            )}
          </>
        }
        subtitle="Avaliação por competência-chave SAFe vs. ciclo anterior (escala 1–5)."
        title="Measure & Grow"
      />
      {error && <ErrorState />}
      {!error && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <KpiCard
              delta={
                avgDelta !== null
                  ? `${avgDelta > 0 ? "+" : ""}${avgDelta.toFixed(1)}`
                  : undefined
              }
              deltaTone="accent"
              hint={avgDelta !== null ? "vs. ciclo anterior" : "escala 1–5"}
              icon="award"
              label="Maturidade média"
              tone="accent"
              unit={avgMaturity !== null ? "/5" : undefined}
              value={
                avgMaturity !== null
                  ? avgMaturity.toFixed(1).replace(".", ",")
                  : "—"
              }
            />
            <KpiCard
              hint={
                withDelta.length > 0
                  ? `de ${withDelta.length} comparáveis`
                  : "sem ciclo anterior"
              }
              icon="trendingUp"
              label="Competências evoluindo"
              tone="green"
              unit={withDelta.length > 0 ? `/${withDelta.length}` : undefined}
              value={withDelta.length > 0 ? improved : "—"}
            />
            <KpiCard
              hint={strongest?.competencyLabel ?? "sem avaliação"}
              icon="star"
              label="Mais forte"
              tone="blue"
              value={
                strongest ? strongest.score.toFixed(1).replace(".", ",") : "—"
              }
            />
            <KpiCard
              delta={weakest ? "foco" : undefined}
              deltaTone="amber"
              hint={weakest?.competencyLabel ?? "sem avaliação"}
              icon="alert"
              label="Maior oportunidade"
              tone="amber"
              value={weakest ? weakest.score.toFixed(1).replace(".", ",") : "—"}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            {loading || rows.length === 0 ? (
              <SectionCard subtitle="7 competências SAFe" title="Competências">
                {loading ? (
                  <div
                    style={{
                      padding: 16,
                      color: "var(--ink-muted)",
                      fontSize: 13,
                    }}
                  >
                    Carregando...
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 16,
                      color: "var(--ink-muted)",
                      fontSize: 13,
                    }}
                  >
                    Nenhuma avaliação encontrada.
                  </div>
                )}
              </SectionCard>
            ) : (
              <RadarCard rows={rows} />
            )}

            <SectionCard
              bodyStyle={{ padding: 12 }}
              icon="gauge"
              subtitle="Nota e variação no ciclo"
              title="Detalhe por competência"
              tone="blue"
            >
              {loading ? (
                <div
                  style={{
                    padding: 16,
                    color: "var(--ink-muted)",
                    fontSize: 13,
                  }}
                >
                  Carregando...
                </div>
              ) : rows.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    color: "var(--ink-muted)",
                    fontSize: 13,
                  }}
                >
                  Nenhuma avaliação encontrada.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {[...rows]
                    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                    .map((row) => (
                      <div
                        key={row.competency}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 14px",
                          borderRadius: "var(--r-md)",
                          border: "1px solid var(--hairline)",
                          background: "var(--surface)",
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--ink)",
                            minWidth: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {row.competencyLabel}
                        </span>
                        {row.score === null ? (
                          <span
                            style={{
                              fontSize: 12.5,
                              color: "var(--ink-muted)",
                            }}
                          >
                            — sem avaliação
                          </span>
                        ) : (
                          <>
                            <div style={{ width: 96 }}>
                              <Progress
                                height={6}
                                tone={scoreTone(row.score)}
                                value={(row.score / 5) * 100}
                              />
                            </div>
                            <span
                              className="mono"
                              style={{
                                width: 34,
                                textAlign: "right",
                                fontSize: 14,
                                fontWeight: 800,
                                color: "var(--ink)",
                              }}
                            >
                              {row.score.toFixed(1)}
                            </span>
                            <span
                              className="mono"
                              style={{
                                width: 42,
                                textAlign: "right",
                                fontSize: 11.5,
                                fontWeight: 700,
                                color:
                                  row.delta === null
                                    ? "var(--ink-faint)"
                                    : row.delta > 0
                                      ? "var(--green-text)"
                                      : row.delta < 0
                                        ? "var(--red-text)"
                                        : "var(--ink-faint)",
                              }}
                            >
                              {row.delta === null
                                ? "—"
                                : `${row.delta > 0 ? "+" : ""}${row.delta}`}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
