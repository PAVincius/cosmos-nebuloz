import { Check, Users } from "lucide-react";
import Link from "next/link";
import { KpiCard, KpiGrid } from "../../../components/kpi-card";
import { RelationChip } from "../../../components/relation-chip";
import { BentoCell, BentoGrid, CellSub } from "../bento-cell";

// Lucide path data flattened to a single `d` string (multiple `M` subpaths are
// valid SVG) so it can cross the Server → Client boundary as a plain string.
const ICON_ALERT =
  "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01";
const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_KANBAN = "M4 4h16v16H4zM9 4v16M15 4v16";
const ICON_CLOCK =
  "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2";

// Placeholder figures for fields not yet wired to a backend source (WIP and
// Flow Efficiency have no persisted metric today — see task deviations note).
const PLACEHOLDER_WIP = 6;
const PLACEHOLDER_FLOW_EFF = 64;
const PLACEHOLDER_CYCLE_TIME = 4.2;

type SmHomeProps = {
  team: { id: string; name: string } | null;
  impediments: Array<{ id: string; title: string; status: string }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    read: boolean;
    createdAt: Date;
    metadata: unknown;
  }>;
  activeSprint: {
    id: string;
    name: string;
    velocity: number | null;
    status: string;
  } | null;
  teamOkrs?: Array<{
    id: string;
    title: string;
    keyResults: Array<{ id: string; current: number; target: number }>;
  }>;
  activeView?: string;
};

function flowEffTone(pct: number): "green" | "amber" | "red" {
  if (pct >= 70) {
    return "green";
  }
  if (pct >= 55) {
    return "amber";
  }
  return "red";
}

const FLOW_EFF_TEXT_VAR: Record<"green" | "amber" | "red", string> = {
  green: "var(--green-text)",
  amber: "var(--amber-text)",
  red: "var(--red-text)",
};

export default function SmHome({
  team,
  impediments,
  notifications: _notifications,
  activeSprint,
  teamOkrs: _teamOkrs = [],
  activeView: _activeView,
}: SmHomeProps) {
  const standupHref = team ? `/teams/${team.id}/standup` : "/teams";
  const flowEffPct = PLACEHOLDER_FLOW_EFF;
  const flowTone = flowEffTone(flowEffPct);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <div
            className="font-mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--amber-text)",
            }}
          >
            <Users aria-hidden size={12} />
            Scrum Master · SAFe 6.0
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 4,
            }}
          >
            <h2
              className="font-display"
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.3px",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              Dashboard · SM
            </h2>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 999,
                color: "var(--amber-text)",
                background: "rgba(var(--amber-rgb),.12)",
                border: "1px solid rgba(var(--amber-rgb),.25)",
              }}
            >
              <Users aria-hidden size={11} />
              Scrum Master
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "4px 0 0" }}>
            Saúde dos times, impedimentos, WIP e flow efficiency em um painel
            operacional.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <RelationChip
            eyebrow="Squads"
            href="/teams"
            icon={<Users />}
            label="Todos os times"
            tone="neutral"
          />
          <RelationChip
            eyebrow="Ritual"
            href={standupHref}
            icon={<Check />}
            label="Standup"
            tone="amber"
          />
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      <KpiGrid>
        <KpiCard
          badge={
            impediments.length > 0
              ? "— Bloqueando agora"
              : "↗ Nenhum ativo"
          }
          iconPath={ICON_ALERT}
          label="Impedimentos"
          tone={impediments.length > 0 ? "red" : "green"}
          value={impediments.length}
        />
        <KpiCard
          badge="— Por sprint"
          iconPath={ICON_ACTIVITY}
          label="Velocity média"
          tone="green"
          unit="SP"
          value={activeSprint?.velocity ?? "—"}
        />
        <KpiCard
          badge="— No time mais carregado"
          iconPath={ICON_KANBAN}
          label="WIP máximo"
          tone="amber"
          value={PLACEHOLDER_WIP}
        />
        <KpiCard
          badge="↘ Melhorando"
          iconPath={ICON_CLOCK}
          label="Cycle Time"
          tone="accent"
          unit="d"
          value={PLACEHOLDER_CYCLE_TIME}
        />
      </KpiGrid>

      {/* ── Saúde dos Times ────────────────────────────────────────────────── */}
      <BentoGrid>
        <BentoCell accentColor="#f59e0b" eyebrow="Saúde dos Times" span={4}>
          <CellSub>Velocity · WIP · Flow efficiency</CellSub>

          {team ? (
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 10,
              }}
            >
              <Link
                className="motion-safe:transition-all motion-safe:duration-150 hover:border-[var(--hairline-strong)] motion-safe:hover:-translate-y-0.5"
                href={standupHref}
                style={{
                  display: "block",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--hairline)",
                  background: "var(--surface-2)",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 10,
                    color: "var(--amber-text)",
                  }}
                >
                  {team.name}
                  {impediments.length > 0 && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        color: "var(--red-text)",
                        fontSize: 11,
                      }}
                    >
                      <svg
                        aria-hidden
                        fill="none"
                        height="11"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                        width="11"
                      >
                        <path d={ICON_ALERT} />
                      </svg>
                      {impediments.length}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 6,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--green-text)",
                      }}
                    >
                      {activeSprint?.velocity ?? "—"}
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--ink-faint)",
                        marginTop: 2,
                      }}
                    >
                      SP/sprint
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color:
                          PLACEHOLDER_WIP > 6
                            ? "var(--red-text)"
                            : "var(--ink)",
                      }}
                    >
                      {PLACEHOLDER_WIP}
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--ink-faint)",
                        marginTop: 2,
                      }}
                    >
                      WIP
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: FLOW_EFF_TEXT_VAR[flowTone],
                      }}
                    >
                      {flowEffPct}%
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--ink-faint)",
                        marginTop: 2,
                      }}
                    >
                      Flow eff
                    </div>
                  </div>
                </div>

                {activeSprint?.name && (
                  <div
                    style={{
                      marginTop: 9,
                      paddingTop: 9,
                      borderTop: "1px solid var(--hairline)",
                      fontSize: 11.5,
                      lineHeight: 1.4,
                      color: "var(--ink-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Sprint: {activeSprint.name}
                  </div>
                )}
              </Link>
            </div>
          ) : (
            <div
              style={{
                marginTop: 10,
                padding: "20px",
                textAlign: "center",
                color: "var(--ink-faint)",
                fontSize: 13,
              }}
            >
              Nenhum time atribuído a este Scrum Master.
            </div>
          )}
        </BentoCell>
      </BentoGrid>
    </div>
  );
}

/**
 * Loading skeleton — matches the KPI row + Saúde dos Times shapes above.
 * Not yet wired: this route has no persona-specific Suspense boundary, and
 * `dashboard/page.tsx` (shared across all persona homes) is out of scope for
 * this atomic task. Ready to be used by a future `dashboard/loading.tsx`.
 */
export function SmHomeSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        className="motion-safe:animate-pulse"
        style={{
          height: 62,
          borderRadius: 10,
          background: "var(--surface-2)",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
        }}
      >
        {["a", "b", "c", "d"].map((slot) => (
          <div
            className="motion-safe:animate-pulse"
            key={`kpi-skeleton-${slot}`}
            style={{
              height: 92,
              borderRadius: 10,
              background: "var(--surface-2)",
            }}
          />
        ))}
      </div>
      <div
        className="motion-safe:animate-pulse"
        style={{
          height: 140,
          borderRadius: 10,
          background: "var(--surface-2)",
        }}
      />
    </div>
  );
}
