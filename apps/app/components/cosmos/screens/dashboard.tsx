// dashboard.tsx — Visão Geral (portfolio executive summary), ported from the
// cosmos handoff. KPI row, velocity area chart, predictability bars, theme
// allocation bars, and in-flight epics list. Every number on this screen is
// wired to a real tenant-scoped server action — see the commit body for the
// per-KPI/chart data source.

import {
  Badge,
  CopyId,
  ErrorState,
  KpiCard,
  NavButton,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { listLeanBudgets } from "@/app/(cosmos)/actions/budgets";
import { getCloudCostSummary } from "@/app/(cosmos)/actions/finops";
import { listEpics } from "@/app/(cosmos)/actions/kanban";
import {
  getActiveArtCount,
  getActivePiPlanning,
  listRecentPiPredictability,
} from "@/app/(cosmos)/actions/piplanning";
import { listRecentSprints } from "@/app/(cosmos)/actions/velocity";
import { EmptyState } from "../empty-state";
import {
  AnomaliesCopilotBar,
  AreaChart,
  EpicRow,
  OrbitButton,
  VBars,
} from "./dashboard-client";

// ── HBars — horizontal bar chart ──
function HBars({
  rows,
}: {
  rows: { label: string; v: number; tone: string }[];
}) {
  // `v` é o montante já arredondado para milhares: um portfólio só com
  // budgets abaixo de US$ 500 zera todas as linhas, e 0/0 viraria scaleX(NaN).
  const max = Math.max(...rows.map((r) => r.v), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
              fontSize: "var(--fs-base)",
            }}
          >
            <span
              style={{
                color: "var(--ink-muted)",
                fontWeight: 600,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={r.label}
            >
              {r.label}
            </span>
            <span
              className="mono"
              style={{
                color: "var(--ink-subtle)",
                flexShrink: 0,
                fontWeight: 700,
                paddingLeft: 10,
              }}
            >
              US$ {formatThousands(r.v)}k
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 99,
              background: "var(--surface-3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 99,
                background: `var(--${r.tone})`,
                boxShadow: `0 0 10px rgba(var(--${r.tone}-rgb),.5)`,
                transform: `scaleX(${r.v / max})`,
                transformOrigin: "left",
                transition: "transform .7s cubic-bezier(.2,.8,.3,1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── epic WSJF priority tone — mirrors kanban.tsx's epicPriority thresholds ──
function wsjfTone(wsjf: number): Tone {
  if (wsjf >= 18) {
    return "red";
  }
  return wsjf >= 13 ? "amber" : "green";
}

const THEME_ALLOC_TONES = ["accent", "blue", "purple", "green", "amber"];

const THOUSANDS_FORMAT = new Intl.NumberFormat("pt-BR");

function formatThousands(value: number): string {
  return THOUSANDS_FORMAT.format(value);
}

// A lista é um resumo, não o Kanban: sem teto, um portfólio com 200 épicos em
// implementação faz a tela crescer sem limite. O excedente vira uma linha com
// contagem, e o botão "Ver Kanban" do cabeçalho já é a saída.
const MAX_EPIC_ROWS = 8;

export default async function DashboardScreen(_props?: { param?: string }) {
  const [
    epicsResult,
    sprintsResult,
    predictabilityResult,
    budgetsResult,
    cloudCostResult,
    piHeaderResult,
    artCountResult,
  ] = await Promise.all([
    listEpics(),
    listRecentSprints(),
    listRecentPiPredictability(),
    listLeanBudgets(),
    getCloudCostSummary(),
    getActivePiPlanning(),
    getActiveArtCount(),
  ]);

  // Cada uma das 7 actions caía em `ok ? data : vazio`, então uma falha ficava
  // indistinguível de "não há dados" — a tela afirmava zero anomalias e nenhum
  // PI ativo quando na verdade não tinha conseguido ler nada. ErrorState é o
  // padrão que as outras 20+ telas do Cosmos já usam para isso.
  const epicsFailed = !epicsResult.ok;
  const sprintsFailed = !sprintsResult.ok;
  const predictabilityFailed = !predictabilityResult.ok;
  const budgetsFailed = !budgetsResult.ok;
  const cloudCostFailed = !cloudCostResult.ok;
  const piHeaderFailed = !piHeaderResult.ok;
  const artCountFailed = !artCountResult.ok;

  const epics = epicsResult.ok ? epicsResult.data : [];
  const inProgress = epics.filter((e) => e.column === "implementing");
  const visibleEpics = inProgress.slice(0, MAX_EPIC_ROWS);
  const hiddenEpicCount = inProgress.length - visibleEpics.length;

  // ── Velocity — SP delivered per closed sprint, oldest→newest ──
  const closedSprints = (sprintsResult.ok ? sprintsResult.data : []).filter(
    (s) => s.velocity !== null
  );
  const recentSprints = closedSprints.slice(0, 6).reverse();
  const velocity = recentSprints.map((s) => s.velocity ?? 0);
  const velocityLabels = recentSprints.map((s) => s.name);
  const latestSprint = closedSprints[0];
  const prevSprint = closedSprints[1];
  const latestSprintVelocity = latestSprint?.velocity ?? null;
  const prevSprintVelocity = prevSprint?.velocity ?? null;
  const throughputDeltaPct =
    latestSprintVelocity !== null &&
    prevSprintVelocity !== null &&
    prevSprintVelocity > 0
      ? Math.round(
          ((latestSprintVelocity - prevSprintVelocity) / prevSprintVelocity) *
            100
        )
      : null;

  // ── Predictability — PIPlan.ppm per closed PI, oldest→newest ──
  const predict = predictabilityResult.ok ? predictabilityResult.data : [];
  const latestPi = predict.at(-1);
  const prevPi = predict.length >= 2 ? predict.at(-2) : undefined;
  const predictabilityDelta =
    latestPi && prevPi ? latestPi.ppmPct - prevPi.ppmPct : null;

  // ── Theme allocation — committed Lean Budget amount, grouped by theme ──
  const budgets = budgetsResult.ok ? budgetsResult.data : [];
  const themeTotals = new Map<string, number>();
  for (const b of budgets) {
    if (!b.themeName) {
      continue;
    }
    themeTotals.set(
      b.themeName,
      (themeTotals.get(b.themeName) ?? 0) + b.amount
    );
  }
  const themeAlloc = [...themeTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount], i) => ({
      label,
      v: Math.round(amount / 1000),
      tone: THEME_ALLOC_TONES[i % THEME_ALLOC_TONES.length],
    }));

  // ── Cloud cost — CostSnapshot/CostAnomaly, current calendar month ──
  const cloudCost = cloudCostResult.ok ? cloudCostResult.data : null;
  const openAnomalyCount = cloudCost?.openAnomalyCount ?? 0;
  const cloudCostUsd = cloudCost?.currentMonthCostUsd ?? null;
  const cloudCostDeltaPct = cloudCost?.deltaPct ?? null;

  // ── Header badges — active PIPlan/Sprint and running-ART count ──
  const piHeader = piHeaderResult.ok ? piHeaderResult.data : null;
  const artCount = artCountResult.ok ? artCountResult.data : 0;
  const artCountLabel =
    artCount === 1 ? "1 ART ativo" : `${artCount} ARTs ativos`;
  const artCountHint = artCountFailed
    ? "ARTs indisponíveis"
    : artCount === 1
      ? "1 ART"
      : `${artCount} ARTs`;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Resumo executivo"
        meta={
          <>
            {piHeaderFailed && <Badge tone="red">PI indisponível</Badge>}
            {!piHeaderFailed &&
              (piHeader ? (
                <Badge dot pulse tone="green">
                  {piHeader.activeSprintName
                    ? `${piHeader.piPlanName} · ${piHeader.activeSprintName}`
                    : piHeader.piPlanName}
                </Badge>
              ) : (
                <Badge tone="neutral">Sem PI ativo</Badge>
              ))}
            <Badge tone={artCountFailed ? "red" : "neutral"}>
              {artCountFailed ? "ARTs indisponíveis" : artCountLabel}
            </Badge>
          </>
        }
        subtitle="Saúde do portfólio SAFe em um olhar — predictability, throughput, custo e épicos em execução ao longo dos ARTs."
        title="Visão Geral"
      >
        <OrbitButton />
      </PageHeader>

      <AnomaliesCopilotBar>
        <strong style={{ color: "var(--accent-text)", fontWeight: 700 }}>
          ORBIT
        </strong>{" "}
        ·{" "}
        {cloudCostFailed ? (
          "não foi possível ler o custo de nuvem agora — os guardrails de FinOps não estão sendo verificados nesta visão."
        ) : openAnomalyCount > 0 ? (
          <>
            custo de nuvem
            {cloudCostDeltaPct !== null
              ? ` ${cloudCostDeltaPct >= 0 ? "subiu" : "caiu"} ${Math.abs(cloudCostDeltaPct)}% no mês`
              : ""}{" "}
            com {openAnomalyCount}{" "}
            {openAnomalyCount === 1 ? "anomalia aberta" : "anomalias abertas"} —
            revise os guardrails de FinOps antes do próximo checkpoint.
          </>
        ) : (
          "nenhuma anomalia de custo em aberto no momento — guardrails de FinOps dentro do esperado."
        )}
      </AnomaliesCopilotBar>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          delta={
            predictabilityDelta !== null
              ? `${predictabilityDelta >= 0 ? "+" : ""}${predictabilityDelta} pts`
              : undefined
          }
          deltaTone={
            predictabilityDelta !== null && predictabilityDelta >= 0
              ? "green"
              : "red"
          }
          hint={
            predictabilityFailed
              ? "dados indisponíveis"
              : prevPi
                ? `vs. ${prevPi.label}`
                : "PI mais recente encerrado"
          }
          icon="target"
          label="PI Predictability"
          tone={latestPi ? "green" : "neutral"}
          unit={latestPi ? "%" : undefined}
          value={latestPi ? latestPi.ppmPct : "—"}
        />
        <KpiCard
          hint={epicsFailed ? "dados indisponíveis" : artCountHint}
          icon="layers"
          label="Épicos em progresso"
          tone={epicsFailed ? "neutral" : "accent"}
          value={epicsFailed ? "—" : inProgress.length}
        />
        <KpiCard
          delta={
            throughputDeltaPct !== null
              ? `${throughputDeltaPct >= 0 ? "+" : ""}${throughputDeltaPct}%`
              : undefined
          }
          deltaTone={
            throughputDeltaPct !== null && throughputDeltaPct >= 0
              ? "green"
              : "amber"
          }
          hint={
            sprintsFailed
              ? "dados indisponíveis"
              : prevSprint
                ? `vs. ${prevSprint.name}`
                : "sem sprint anterior"
          }
          icon="activity"
          label="Throughput por Sprint"
          tone={sprintsFailed ? "neutral" : "blue"}
          unit={latestSprintVelocity !== null ? "SP" : undefined}
          value={latestSprintVelocity !== null ? latestSprintVelocity : "—"}
        />
        <KpiCard
          decimals={1}
          delta={
            cloudCostDeltaPct !== null
              ? `${cloudCostDeltaPct >= 0 ? "+" : ""}${cloudCostDeltaPct}%`
              : undefined
          }
          deltaTone={
            cloudCostDeltaPct !== null && cloudCostDeltaPct > 0
              ? "amber"
              : "green"
          }
          hint={
            cloudCostFailed
              ? "dados indisponíveis"
              : openAnomalyCount > 0
                ? `${openAnomalyCount} ${openAnomalyCount === 1 ? "anomalia" : "anomalias"}`
                : "sem anomalias"
          }
          icon="dollar"
          label="Custo de nuvem · MTD"
          tone={cloudCostUsd !== null ? "amber" : "neutral"}
          unit={cloudCostUsd !== null ? "k" : undefined}
          value={cloudCostUsd !== null ? cloudCostUsd / 1000 : "—"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <SectionCard
          bodyStyle={{ overflow: "visible" }}
          icon="activity"
          subtitle="Story points entregues por sprint encerrado"
          title="Velocity do Programa"
          tone="accent"
        >
          {sprintsFailed && (
            <ErrorState message="Não foi possível carregar os sprints encerrados." />
          )}
          {!sprintsFailed &&
            (velocity.length >= 2 ? (
              <AreaChart
                data={velocity}
                labels={velocityLabels}
                tone="accent"
              />
            ) : (
              <EmptyState
                description="Histórico de sprints encerrados insuficiente para exibir a tendência de velocity."
                icon="activity"
                title="Sem dados de velocity"
              />
            ))}
        </SectionCard>
        <SectionCard
          bodyStyle={{ overflow: "visible" }}
          icon="target"
          subtitle="Program Predictability Measure (PPM) por PI encerrado"
          title="Predictability por PI"
          tone="green"
        >
          {predictabilityFailed && (
            <ErrorState message="Não foi possível carregar a predictability dos PIs." />
          )}
          {!predictabilityFailed &&
            (predict.length > 0 ? (
              <VBars
                data={predict.map((p) => ({ label: p.label, v: p.ppmPct }))}
              />
            ) : (
              <EmptyState
                description="Nenhum PI encerrado com PPM calculado ainda."
                icon="target"
                title="Sem dados de predictability"
              />
            ))}
        </SectionCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
          gap: 16,
        }}
      >
        <SectionCard
          icon="compass"
          subtitle="Investimento comprometido (US$ k)"
          title="Alocação por Tema Estratégico"
          tone="purple"
        >
          {budgetsFailed && (
            <ErrorState message="Não foi possível carregar os Lean Budgets." />
          )}
          {!budgetsFailed &&
            (themeAlloc.length > 0 ? (
              <HBars rows={themeAlloc} />
            ) : (
              <EmptyState
                description="Nenhum Lean Budget com tema estratégico associado ainda."
                icon="compass"
                title="Sem alocação por tema"
              />
            ))}
        </SectionCard>
        <SectionCard
          action={
            <NavButton
              iconRight="arrowRight"
              size="sm"
              to="kanban"
              variant="ghost"
            >
              Ver Kanban
            </NavButton>
          }
          icon="layers"
          subtitle={
            epicsFailed ? "indisponível" : `${inProgress.length} em execução`
          }
          title="Épicos em Implementação"
          tone="blue"
        >
          {epicsFailed && (
            <ErrorState message="Não foi possível carregar os épicos do portfólio." />
          )}
          {!epicsFailed && inProgress.length === 0 && (
            <EmptyState
              description="Nenhum épico na coluna Implementando. Os que entrarem aparecem aqui."
              icon="layers"
              title="Sem épicos em execução"
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleEpics.map((e) => {
              const artTone = e.artTone;
              return (
                <EpicRow id={e.id} key={e.id}>
                  <CopyId value={e.id}>
                    <span
                      className="mono"
                      style={{
                        fontSize: "var(--fs-nota)",
                        fontWeight: 800,
                        color: `var(--${artTone}-text)`,
                        background: `rgba(var(--${artTone}-rgb),.14)`,
                        border: `1px solid rgba(var(--${artTone}-rgb),.28)`,
                        borderRadius: 5,
                        padding: "1px 6px",
                      }}
                    >
                      {e.id}
                    </span>
                  </CopyId>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <Badge
                      tone={wsjfTone(e.wsjf)}
                    >{`WSJF ${e.wsjf.toFixed(1)}`}</Badge>
                    {e.hot && (
                      <Badge icon="zap" tone="red">
                        Quente
                      </Badge>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "var(--fs-base)",
                        fontWeight: 600,
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {e.title}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <Progress height={5} tone={artTone} value={e.progress} />
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--fs-base)",
                      fontWeight: 700,
                      color: "var(--ink-subtle)",
                      flexShrink: 0,
                    }}
                  >
                    {e.progress}%
                  </span>
                </EpicRow>
              );
            })}
            {hiddenEpicCount > 0 && (
              <span
                style={{
                  color: "var(--ink-subtle)",
                  fontSize: "var(--fs-base)",
                  paddingTop: 2,
                }}
              >
                {hiddenEpicCount === 1
                  ? "+1 épico em execução — abra o Kanban para ver todos."
                  : `+${formatThousands(hiddenEpicCount)} épicos em execução — abra o Kanban para ver todos.`}
              </span>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
