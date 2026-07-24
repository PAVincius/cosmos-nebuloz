"use client";

// pillar-detail-client.tsx — per-StrategyPillar drilldown (design handoff
// screen-bundle-4.jsx PillarDetailScreen). Static SAFe 6.0 guidance panel
// (descriptive reference copy, not tenant data) plus the pillar's linked
// strategic themes and the epics rolled up through those themes
// (StrategicTheme -> Epic). Rollup numbers are computed from real data and
// are honestly empty when the pillar has no themes or the themes have no
// epics — never fabricated.
import type { PillarDetailView } from "@/app/(cosmos)/actions/strategy";
import { EmptyState } from "../empty-state";
import { Icon, type IconName } from "../icons";
import {
  Badge,
  KpiCard,
  PageHeader,
  SectionCard,
  type Tone,
  useNav,
} from "../kit";

const HEALTH_TONE: Record<string, "green" | "amber" | "red"> = {
  on: "green",
  watch: "amber",
  behind: "red",
};

// StrategyPillar.tone is a free-form Prisma String column (default "accent"),
// not a Tone enum — validate against the known set instead of trusting it.
const VALID_TONES = new Set<Tone>([
  "green",
  "red",
  "amber",
  "blue",
  "purple",
  "accent",
  "neutral",
]);
function toTone(value: string): Tone {
  return VALID_TONES.has(value as Tone) ? (value as Tone) : "accent";
}

// SAFe 6.0 (Full) guidance for keeping a Strategic Theme / pillar healthy —
// static reference copy from the design handoff, not tenant-derived data.
const GUIDANCE: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "compass",
    title: "Conecte à visão do portfólio",
    body: "Um Strategic Theme só existe para aproximar o portfólio da visão de longo prazo — se não conseguir explicar essa ligação em uma frase, o pilar está genérico demais.",
  },
  {
    icon: "dollar",
    title: "Financie-o via Lean Budget",
    body: "Cada tema deve ter uma alocação de orçamento com guardrails em Lean Budgets. Sem orçamento vinculado, o pilar é intenção, não investimento.",
  },
  {
    icon: "layers",
    title: "Desdobre em épicos executáveis",
    body: "Temas se traduzem em Épicos de Portfólio com hipótese de negócio e critério de sucesso (Lean Business Case) — não delegue direto para features soltas.",
  },
  {
    icon: "refresh",
    title: "Revise a cada PI Boundary",
    body: "Strategic Themes evoluem devagar (trimestral/semestral), mas devem ser revisitados a cada 1-2 PIs no Portfolio Sync para checar se ainda refletem a estratégia da empresa.",
  },
  {
    icon: "trendingUp",
    title: "Meça por outcome, não output",
    body: "Acompanhe o pilar por métricas de negócio (receita, retenção, custo evitado) além do % de épicos entregues — entrega não é o mesmo que valor realizado.",
  },
];

export default function PillarDetailClient({
  initial,
}: {
  initial: PillarDetailView;
}) {
  const { navigate } = useNav();
  const tone = toTone(initial.tone);

  return (
    <div className="fade-in">
      <button
        className="btn"
        onClick={() => navigate("strategy")}
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
        ← Strategy Map
      </button>

      <PageHeader
        eyebrow="Portfolio · Pilar Estratégico (SAFe 6.0)"
        meta={
          <>
            <Badge icon="tag" tone={tone}>
              {initial.themes.length} tema
              {initial.themes.length === 1 ? "" : "s"} vinculado
              {initial.themes.length === 1 ? "" : "s"}
            </Badge>
            <Badge tone="neutral">{initial.epicCount} épicos</Badge>
          </>
        }
        title={initial.name}
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
          hint="através dos temas vinculados"
          icon="layers"
          label="Épicos rolados"
          tone="purple"
          value={initial.epicCount}
        />
        <KpiCard
          hint={`de ${initial.epicCount} registrados`}
          icon="check"
          label="Épicos concluídos"
          tone="green"
          value={initial.doneEpicCount}
        />
        <KpiCard
          hint="média dos épicos"
          icon="trendingUp"
          label="Progresso do pilar"
          tone={tone}
          unit="%"
          value={initial.avgProgress}
        />
        <KpiCard
          hint="apostas de investimento"
          icon="tag"
          label="Temas vinculados"
          tone="accent"
          value={initial.themes.length}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard
            icon="book"
            subtitle="Práticas recomendadas pelo SAFe 6.0 (nível Full) para Strategic Themes"
            title="Como manter este pilar saudável"
            tone={tone}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {GUIDANCE.map((g) => (
                <div key={g.title} style={{ display: "flex", gap: 12 }}>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      background: `var(--${tone}-soft)`,
                      color: `var(--${tone}-text)`,
                    }}
                  >
                    <Icon name={g.icon} size={15} />
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--ink)",
                        marginBottom: 2,
                      }}
                    >
                      {g.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-muted)",
                        lineHeight: 1.55,
                      }}
                    >
                      {g.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            action={
              <Badge tone="neutral">
                {initial.doneEpicCount}/{initial.epicCount} concluídos
              </Badge>
            }
            icon="layers"
            subtitle="Trabalho real que entrega este pilar"
            title="Épicos vinculados"
            tone={tone}
          >
            {initial.epics.length === 0 ? (
              <EmptyState
                description="Nenhum épico foi vinculado aos temas deste pilar ainda."
                icon="layers"
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
                      gap: 12,
                      padding: "11px 14px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface)",
                    }}
                    type="button"
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {e.title}
                      </div>
                      <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                        {e.themeTitle}
                        {e.wsjf !== null ? ` · WSJF ${e.wsjf}` : ""}
                      </span>
                    </div>
                    <Badge tone="neutral">{e.progressPct}%</Badge>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          icon="tag"
          subtitle="Apostas de investimento deste pilar"
          title="Temas estratégicos"
          tone={tone}
        >
          {initial.themes.length === 0 ? (
            <EmptyState
              description="Nenhum tema estratégico está agrupado sob este pilar ainda."
              icon="tag"
              title="Nenhum tema vinculado"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {initial.themes.map((t) => {
                const healthTone = HEALTH_TONE[t.healthStatus] ?? "green";
                return (
                  <button
                    className="lift"
                    key={t.id}
                    onClick={() => navigate("theme", t.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      padding: 13,
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface)",
                    }}
                    type="button"
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--ink)",
                        }}
                      >
                        {t.title}
                      </span>
                      <Badge dot tone={healthTone}>
                        {t.healthStatus}
                      </Badge>
                    </div>
                    <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                      {t.epicCount} épicos · {t.avgProgress}% em média
                      {t.targetAllocationPct !== null
                        ? ` · alvo ${t.targetAllocationPct}%`
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
