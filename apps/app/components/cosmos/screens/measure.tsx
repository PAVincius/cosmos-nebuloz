"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ChartTip,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useAction,
} from "@repo/design-system/cosmos/kit";
import type { CSSProperties } from "react";
import { useCallback, useState } from "react";
import {
  type CompetencyScoreView,
  createImprovementAction,
  type ImprovementActionsView,
  listCompetencyScores,
  listImprovementActions,
  recordCompetencyAssessment,
} from "@/app/(cosmos)/actions/measure";
import { listTeams } from "@/app/(cosmos)/actions/teams";
// measure.tsx — Measure & Grow, ligado a listCompetencyScores() +
// listImprovementActions() + os dois caminhos de escrita. Nota atual e do ciclo
// anterior por competência-chave SAFe (7 competências, escala 1–5), radar
// comparando os dois ciclos, e as ações de melhoria que saem da avaliação —
// medir sem registrar ação é termômetro, não Measure & Grow. Métricas DORA
// vivem em /cosmos/flow, não aqui.
import { EmptyState } from "../empty-state";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

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

// ── escrita: avaliação de competência e ação de melhoria ──

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

type TeamOption = { id: string; name: string };

// A lista de times é buscada aqui dentro, e não recebida por prop, porque estes
// dois formulários vivem em modal e o modal é aberto por
// `modal.open(<Modal .../>)` — um elemento React criado no instante do clique,
// com as props congeladas ali. Se `listTeams` ainda não tivesse respondido, o
// select nasceria vazio e continuaria vazio para sempre: nenhum re-render da
// tela alcança um elemento já guardado no estado do provider. O usuário não
// conseguiria escolher time nenhum, e "Salvar" não faria nada — sem erro, sem
// aviso, porque o guard do `save` sai calado quando `scopeId` está vazio.
function TeamSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data, loading } = useAction(listTeams);
  const teams: TeamOption[] = (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
  }));

  return (
    <div>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
      </label>
      <select
        id={id}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        value={value}
      >
        <option value="">
          {loading ? "Carregando times..." : "Selecione um time"}
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function NewAssessmentModal({
  competencies,
  onSaved,
}: {
  competencies: CompetencyScoreView[];
  onSaved: () => void;
}) {
  const { close } = useModal();
  const [competency, setCompetency] = useState(
    competencies[0]?.competency ?? ""
  );
  const [score, setScore] = useState("3");
  const [scopeId, setScopeId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = Number(score);
    if (!(competency && scopeId) || Number.isNaN(parsed) || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        recordCompetencyAssessment({
          competency,
          score: parsed,
          scope: "team",
          scopeId,
        }),
      {
        loading: "Registrando avaliação...",
        success: "Avaliação registrada.",
        error: (err: string) => `Não foi possível registrar: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      onSaved();
      close();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="award" size={16} />}
      subtitle="Escala 1–5 do Measure & Grow, por time avaliado"
      title="Registrar avaliação"
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="assessment-competency" style={fieldLabelStyle}>
            Competência
          </label>
          <select
            id="assessment-competency"
            onChange={(e) => setCompetency(e.target.value)}
            style={inputStyle}
            value={competency}
          >
            {competencies.map((c) => (
              <option key={c.competency} value={c.competency}>
                {c.competencyLabel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="assessment-score" style={fieldLabelStyle}>
            Nota (1–5)
          </label>
          <input
            id="assessment-score"
            max={5}
            min={1}
            onChange={(e) => setScore(e.target.value)}
            step={0.1}
            style={inputStyle}
            type="number"
            value={score}
          />
        </div>
        {/* O escopo é obrigatório no modelo e é o que dá sentido ao "ciclo
            anterior": comparar a nota de um time com a de outro produziria um
            delta que não descreve a evolução de ninguém. */}
        <TeamSelect
          id="assessment-scope"
          label="Time avaliado"
          onChange={setScopeId}
          value={scopeId}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={save} size="sm" variant="primary">
            Salvar avaliação
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function NewImprovementActionModal({ onSaved }: { onSaved: () => void }) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!(title.trim() && scopeId) || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createImprovementAction({
          title: title.trim(),
          scope: "team",
          scopeId,
        }),
      {
        loading: "Criando ação...",
        success: "Ação de melhoria criada.",
        error: (err: string) => `Não foi possível criar a ação: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      onSaved();
      close();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="target" size={16} />}
      subtitle="O que muda a partir da avaliação"
      title="Nova ação de melhoria"
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="action-title" style={fieldLabelStyle}>
            Título
          </label>
          <input
            id="action-title"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rodar dojo de testes de contrato"
            style={inputStyle}
            value={title}
          />
        </div>
        <TeamSelect
          id="action-scope"
          label="Time responsável"
          onChange={setScopeId}
          value={scopeId}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={save} size="sm" variant="primary">
            Criar ação
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

const ACTION_STATUS_TONE: Record<string, "green" | "amber" | "neutral"> = {
  DONE: "green",
  IN_PROGRESS: "amber",
  OPEN: "neutral",
  CANCELLED: "neutral",
};

function ImprovementActionsCard({
  data,
  loading,
  error,
  onNew,
}: {
  data: ImprovementActionsView | undefined;
  loading: boolean;
  error: boolean;
  onNew: () => void;
}) {
  return (
    <SectionCard
      action={
        <Button icon="plus" onClick={onNew} size="sm" variant="secondary">
          Nova ação
        </Button>
      }
      bodyStyle={{ padding: 12 }}
      icon="target"
      subtitle={
        // Taxa sem denominador vira nota de rodapé; com denominador vira
        // decisão. E sem ação viva a taxa é null, não 0%.
        data && data.completionPct !== null
          ? `${data.done} de ${data.total} concluídas`
          : "O que muda a partir da avaliação"
      }
      title="Ações de melhoria"
      tone="green"
    >
      {error && (
        <ErrorState message="Não foi possível carregar as ações de melhoria." />
      )}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && (data?.items.length ?? 0) === 0 && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Nenhuma ação de melhoria aberta.
        </div>
      )}
      {!(error || loading) && data && data.items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.items.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
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
                }}
              >
                {a.title}
              </span>
              {a.competencyLabel && (
                <Badge tone="neutral">{a.competencyLabel}</Badge>
              )}
              <Badge tone={ACTION_STATUS_TONE[a.status] ?? "neutral"}>
                {a.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
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

function MeasureBody() {
  const modal = useModal();
  // Chave de recarga: useAction refaz a chamada quando as deps mudam, e é
  // assim que a tela reflete a avaliação que acabou de ser gravada.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const { data, loading, error } = useAction(listCompetencyScores, [reloadKey]);
  const actions = useAction(listImprovementActions, [reloadKey]);
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
      >
        <Button
          icon="plus"
          onClick={() =>
            modal.open(
              <NewAssessmentModal competencies={rows} onSaved={reload} />
            )
          }
          size="sm"
          variant="primary"
        >
          Registrar avaliação
        </Button>
      </PageHeader>
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

          <div style={{ marginTop: 14 }}>
            <ImprovementActionsCard
              data={actions.data}
              error={actions.error}
              loading={actions.loading}
              onNew={() =>
                modal.open(<NewImprovementActionModal onSaved={reload} />)
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function MeasureScreen() {
  return (
    <ModalProvider>
      <MeasureBody />
    </ModalProvider>
  );
}
