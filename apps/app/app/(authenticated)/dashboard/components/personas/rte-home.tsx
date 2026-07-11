import { Activity, Bell, Gauge as GaugeIcon, Link2, ShieldAlert, Target } from "lucide-react";
import Link from "next/link";
import { KpiCard, KpiGrid } from "../../../components/kpi-card";
import { SectionCard } from "../../../components/section-card";
import { NotificationsCell } from "../notifications-cell";

const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_TARGET =
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z";
const ICON_SHIELD_ALERT =
  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01";
const ICON_LINK =
  "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71";

type RteHomeProps = {
  arts: Array<{
    id: string;
    name: string;
    piPlans?: Array<{ id: string; status?: string }>;
  }>;
  risks: Array<{ id: string; title: string; status: string }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    read: boolean;
    createdAt: Date;
    metadata: unknown;
  }>;
  piObjectives: Array<{
    id: string;
    status?: string;
    achievedValue?: number;
  }>;
  okrs?: Array<{
    id: string;
    title: string;
    keyResults: Array<{ id: string; current: number; target: number }>;
  }>;
  activeView?: string;
};

function getRiskTagStyle(status: string): React.CSSProperties {
  switch (status) {
    case "IDENTIFIED":
      return {
        background: "#8b5cf61a",
        border: "1px solid #8b5cf633",
        color: "#8b5cf6",
      };
    case "ROAM":
      return {
        background: "#f59e0b1a",
        border: "1px solid #f59e0b33",
        color: "#f59e0b",
      };
    default:
      return {
        background: "#62666d1a",
        border: "1px solid #62666d33",
        color: "#8a8f98",
      };
  }
}

/** Small horizontal progress bar — mirrors the prototype's `.progress > i`. */
function MiniProgress({ pct, tone }: { pct: number; tone: string }) {
  return (
    <div
      style={{
        height: 7,
        borderRadius: 999,
        background: "var(--surface-3)",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,.5) inset",
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 999,
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: tone,
        }}
      />
    </div>
  );
}

/** mkpi2-style stat tile — matches the prototype's PI health mini-KPIs. */
function StatTile({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1,
          color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ padding: "20px 12px", textAlign: "center", color: "var(--ink-faint)", fontSize: 12.5 }}
    >
      {children}
    </div>
  );
}

export default function RteHome({
  arts,
  risks,
  notifications,
  piObjectives,
  okrs = [],
}: RteHomeProps) {
  // PI Objectives — commitment ratio drives both Program Predictability and Completion PI
  // (the prototype surfaces the same PPM/completion pair in the KPI row and in the PI
  // Health card; we only have one real signal — objective commitment — so both reuse it).
  const total = piObjectives.length;
  const onTrack = piObjectives.filter(
    (o) => o.status === "COMMITTED" || (o.achievedValue ?? 0) > 0
  ).length;
  const predictabilityPct = total > 0 ? Math.round((onTrack / total) * 100) : 0;
  const predictabilityTone = predictabilityPct >= 80 ? "green" : "amber";

  // Riscos — open = not yet resolved (ROAM board still tracking it)
  const openRisksList = risks.filter((r) => r.status !== "RESOLVED");
  const openRisksCount = openRisksList.length;
  const riskTone =
    openRisksCount > 2 ? "red" : openRisksCount > 0 ? "amber" : "green";

  // Dependências bloqueadas: sem fonte de dados real conectada a este dashboard ainda
  // (nenhuma prop de dependências é passada por getRteHomeData) — placeholders preservados
  // 1:1 do arquivo anterior até a API expor a contagem real.
  const depsTotal = 7;
  const depsBlocked = 2;
  const depsTone = depsBlocked > 0 ? "red" : "green";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <KpiGrid cols={4}>
        <KpiCard
          badge={
            total > 0
              ? `— ${onTrack} de ${total} objetivos comprometidos`
              : "— Sem PI Objectives"
          }
          iconPath={ICON_TARGET}
          label="Program Predictability"
          tone={total > 0 ? predictabilityTone : "blue"}
          unit="%"
          value={predictabilityPct}
        />
        <KpiCard
          badge={`— Semana atual · ${total} objetivos`}
          iconPath={ICON_ACTIVITY}
          label="Completion do PI"
          tone="accent"
          value={total > 0 ? `${onTrack}/${total}` : "0/0"}
        />
        <KpiCard
          badge={depsBlocked > 0 ? "— Requer atenção" : "↗ Fluindo"}
          iconPath={ICON_LINK}
          label="Dependências bloqueadas"
          tone={depsTone}
          value={depsBlocked}
        />
        <KpiCard
          badge={openRisksCount > 0 ? "— Requer acompanhamento" : "↗ Nenhum risco ativo"}
          iconPath={ICON_SHIELD_ALERT}
          label="Riscos críticos abertos"
          tone={riskTone}
          value={openRisksCount}
        />
      </KpiGrid>

      {/* ── Bento — cards no padrão do protótipo (screenDashRTE) ──────────── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        style={{ gap: "var(--cosmos-gap, 16px)" }}
      >
        {/* 1. Confidence Vote por ART */}
        <SectionCard
          icon={GaugeIcon}
          subtitle="Escala 1–5 · threshold 3.0"
          title="Confidence Vote por ART"
        >
          {arts.length === 0 ? (
            <EmptyState>Nenhum ART configurado ainda</EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {arts.slice(0, 6).map((art, i) => (
                <Link
                  key={art.id}
                  href={`/arts/${art.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom:
                      i < Math.min(arts.length, 6) - 1
                        ? "1px solid var(--hairline)"
                        : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      {art.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                      {art.piPlans?.length ?? 0} PI(s) vinculado(s)
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-jetbrains-mono, monospace)",
                      color: "var(--ink-faint)",
                      background: "var(--surface-3)",
                      border: "1px solid var(--hairline)",
                      borderRadius: 999,
                      padding: "3px 9px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Sem voto
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 2. PI Health */}
        <SectionCard icon={Activity} subtitle="Objectives do PI atual" title="PI Health">
          {total === 0 ? (
            <EmptyState>Nenhum PI Objective registrado nesta PI</EmptyState>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                gap: 8,
              }}
            >
              <StatTile
                color={`var(--${predictabilityTone}-text)`}
                label="PPM"
                value={`${predictabilityPct}%`}
              />
              <StatTile
                color="var(--accent-text)"
                label="Completion"
                value={`${onTrack}/${total}`}
              />
              <StatTile
                color="var(--blue-text)"
                label="Objectives"
                value={`${onTrack}/${total}`}
              />
            </div>
          )}
        </SectionCard>

        {/* 3. Riscos ROAM abertos */}
        <SectionCard
          icon={ShieldAlert}
          subtitle={`${openRisksCount} ativos · ${risks.length} total`}
          title="Riscos ROAM abertos"
        >
          {openRisksList.length === 0 ? (
            <EmptyState>Sem riscos abertos ✓</EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {openRisksList.slice(0, 5).map((risk) => {
                const tagStyle = getRiskTagStyle(risk.status);
                return (
                  <Link
                    href="/risks"
                    key={risk.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 11px",
                      borderRadius: 8,
                      background: "var(--surface-2)",
                      border: "1px solid var(--hairline)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: tagStyle.color as string,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {risk.title}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: "2px 7px",
                        borderRadius: 999,
                        flexShrink: 0,
                        ...tagStyle,
                      }}
                    >
                      {risk.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* 4. Dependências Bloqueadas */}
        <SectionCard
          icon={Link2}
          subtitle={`${depsBlocked} features paradas`}
          title="Dependências Bloqueadas"
        >
          <StatTile
            color="var(--red-text)"
            label={`de ${depsTotal} dependências abertas no ART`}
            value={String(depsBlocked)}
          />
        </SectionCard>

        {/* 5. Notificações */}
        <SectionCard
          actions={
            <Link href="/notifications" style={{ fontSize: 11, color: "var(--accent-text)" }}>
              Ver tudo →
            </Link>
          }
          icon={Bell}
          subtitle="Inbox do ART"
          title="Notificações"
        >
          {notifications.length === 0 ? (
            <EmptyState>Nenhuma notificação</EmptyState>
          ) : (
            <NotificationsCell notifications={notifications} />
          )}
        </SectionCard>

        {/* 6. OKRs do ART */}
        <SectionCard
          actions={
            <Link href="/portfolio/okrs" style={{ fontSize: 11, color: "var(--accent-text)" }}>
              Ver →
            </Link>
          }
          icon={Target}
          title="OKRs do ART"
        >
          {okrs.length === 0 ? (
            <EmptyState>Nenhum OKR ART ativo</EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {okrs.map((okr) => {
                const targetSum = okr.keyResults.reduce((s, kr) => s + kr.target, 0);
                const currentSum = okr.keyResults.reduce((s, kr) => s + kr.current, 0);
                const pct =
                  targetSum > 0 ? Math.min(100, Math.round((currentSum / targetSum) * 100)) : 0;
                const tone = pct >= 70 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)";
                return (
                  <div key={okr.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: "var(--ink-subtle)",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "75%",
                        }}
                      >
                        {okr.title}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <MiniProgress pct={pct} tone={tone} />
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
