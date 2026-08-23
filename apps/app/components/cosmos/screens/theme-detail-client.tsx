"use client";

import {
  Badge,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "@repo/design-system/cosmos/kit";
// theme-detail-client.tsx — per-StrategicTheme drilldown (design handoff
// screen-bundle-5.jsx ThemeDetailScreen). Real vs. target allocation, linked
// pillar, and the theme's epics. actualAllocationPct comes from getTheme()
// (BillingEntry.themeId + effectiveCost — see NEB-185) and is null, never
// fabricated, when the tenant has no themed cost data yet.
import type { ThemeDetailView } from "@/app/(cosmos)/actions/themes";
import { EmptyState } from "../empty-state";

const HEALTH_TONE: Record<string, "green" | "amber" | "red"> = {
  on: "green",
  watch: "amber",
  behind: "red",
};

export default function ThemeDetailClient({
  initial,
}: {
  initial: ThemeDetailView;
}) {
  const { navigate } = useNav();
  const tone = HEALTH_TONE[initial.healthStatus] ?? "green";
  const hasDrift =
    initial.actualAllocationPct !== null &&
    initial.targetAllocationPct !== null;
  const drift = hasDrift
    ? Math.round(
        (initial.actualAllocationPct as number) -
          (initial.targetAllocationPct as number)
      )
    : null;

  return (
    <div className="fade-in">
      <button
        className="btn"
        onClick={() => navigate("themes")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--ink-muted)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 14,
          padding: 0,
        }}
        type="button"
      >
        ← Temas Estratégicos
      </button>

      <PageHeader
        eyebrow="Portfolio · Tema Estratégico"
        meta={
          <>
            <Badge dot tone={tone}>
              {initial.healthStatus}
            </Badge>
            {initial.horizon && (
              <Badge icon="calendar" tone="accent">
                {initial.horizon}
              </Badge>
            )}
            {initial.pillar && (
              <button
                onClick={() => navigate("pillar", initial.pillar?.id)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                type="button"
              >
                <Badge icon="trend" tone="amber">
                  {initial.pillar.name}
                </Badge>
              </button>
            )}
          </>
        }
        subtitle={initial.description ?? undefined}
        title={initial.title}
        tone={tone}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <KpiCard
          hint={
            initial.targetAllocationPct !== null
              ? `alvo ${initial.targetAllocationPct}%`
              : undefined
          }
          icon="compass"
          label="Alocação de investimento"
          tone={tone}
          unit="%"
          value={initial.actualAllocationPct ?? "—"}
        />
        <KpiCard
          hint={
            drift === null
              ? "sem dados de alocação real"
              : drift === 0
                ? "no alvo"
                : drift > 0
                  ? "acima do alvo"
                  : "abaixo do alvo"
          }
          icon="gauge"
          label="Drift vs. alvo"
          tone={
            drift === null || drift === 0
              ? "green"
              : drift > 0
                ? "amber"
                : "blue"
          }
          unit={drift === null ? undefined : "pp"}
          value={drift === null ? "—" : Math.abs(drift)}
        />
        <KpiCard
          hint={`de ${initial.epics.length} registrados`}
          icon="layers"
          label="Épicos vinculados"
          tone="purple"
          value={initial.epics.length}
        />
        <KpiCard
          hint="média dos épicos"
          icon="trendingUp"
          label="Progresso do tema"
          tone={tone}
          unit="%"
          value={initial.avgProgress}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 16,
        }}
      >
        <SectionCard
          icon="compass"
          subtitle="Real vs. alvo de orçamento do portfólio"
          title="Alocação de investimento"
          tone={tone}
        >
          {initial.actualAllocationPct === null ? (
            <EmptyState
              description="Nenhum custo de nuvem foi mapeado para este tema ainda — apenas o alvo é exibido."
              icon="compass"
              title="Sem dados de alocação real"
            />
          ) : (
            <>
              <div style={{ marginBottom: 4 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                    marginBottom: 8,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontWeight: 700, color: "var(--ink-muted)" }}
                  >
                    {initial.actualAllocationPct}% real
                  </span>
                  {initial.targetAllocationPct !== null && (
                    <span
                      className="mono"
                      style={{ fontWeight: 700, color: "var(--ink-faint)" }}
                    >
                      alvo {initial.targetAllocationPct}%
                    </span>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <Progress tone={tone} value={initial.actualAllocationPct} />
                  {initial.targetAllocationPct !== null && (
                    <span
                      style={{
                        position: "absolute",
                        top: -3,
                        bottom: -3,
                        left: `${initial.targetAllocationPct}%`,
                        width: 2,
                        background: "var(--ink-faint)",
                        borderRadius: 2,
                      }}
                    />
                  )}
                </div>
              </div>
              {drift !== null && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "13px 14px",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    display: "flex",
                    gap: 11,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      color: "var(--ink-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {drift === 0
                      ? "Este tema está exatamente no alvo de investimento definido."
                      : drift > 0
                        ? `Este tema está recebendo ${drift}pp a mais que o planejado — considere revisar no próximo Portfolio Sync.`
                        : `Este tema está ${Math.abs(drift)}pp abaixo do alvo — pode estar subfinanciado frente à prioridade estratégica.`}
                  </span>
                </div>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard
          icon="trend"
          subtitle="Aposta de longo prazo que este tema executa"
          title="Pilar estratégico"
          tone="amber"
        >
          {initial.pillar ? (
            <button
              className="lift"
              onClick={() => navigate("pillar", initial.pillar?.id)}
              style={{
                width: "100%",
                textAlign: "left",
                fontFamily: "inherit",
                cursor: "pointer",
                padding: 14,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
              }}
              type="button"
            >
              <div
                style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}
              >
                {initial.pillar.name}
              </div>
            </button>
          ) : (
            <EmptyState
              description="Este tema não está agrupado sob nenhum pilar estratégico."
              icon="trend"
              title="Nenhum pilar vinculado"
            />
          )}
        </SectionCard>
      </div>

      <div style={{ marginTop: 16 }}>
        <SectionCard
          icon="kanban"
          subtitle={`${initial.epics.length} épicos vinculados`}
          title="Épicos deste tema"
          tone={tone}
        >
          {initial.epics.length === 0 ? (
            <EmptyState
              description="Nenhum épico foi vinculado a este tema ainda."
              icon="kanban"
              title="Nenhum épico vinculado"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {initial.epics.map((e) => (
                <button
                  className="lift"
                  key={e.id}
                  onClick={() => navigate("epic", e.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface)",
                  }}
                  type="button"
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                      }}
                    >
                      {e.title}
                    </div>
                    {e.wsjf !== null && (
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: "var(--ink-faint)" }}
                      >
                        WSJF {e.wsjf}
                      </span>
                    )}
                  </div>
                  <Badge tone="neutral">{e.progressPct}%</Badge>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
