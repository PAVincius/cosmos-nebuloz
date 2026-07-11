import { KanbanIcon } from "lucide-react";
import { SectionCard } from "@/app/(authenticated)/components/section-card";

type FeatureRow = {
  id: string;
  artScopedId: string | null;
  title: string;
  teamName: string | null;
  statusId: string;
  progressPct: number;
  wsjfScore: number;
  depsCount: number;
};

type FeaturesSectionProps = {
  features: FeatureRow[];
  epicId: string;
};

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; pillBg: string; pillText: string }> = {
  IMPLEMENTING: {
    label: "Em progresso",
    dotColor: "var(--accent-c)",
    pillBg: "rgba(124,135,255,.15)",
    pillText: "var(--accent-c)",
  },
  REVIEW: {
    label: "Em revisão",
    dotColor: "var(--amber)",
    pillBg: "rgba(251,191,36,.12)",
    pillText: "var(--amber-text)",
  },
  ANALYSIS: {
    label: "Em análise",
    dotColor: "var(--amber)",
    pillBg: "rgba(251,191,36,.12)",
    pillText: "var(--amber-text)",
  },
  DONE: {
    label: "Done",
    dotColor: "var(--green)",
    pillBg: "rgba(52,211,153,.12)",
    pillText: "var(--green-text)",
  },
  BACKLOG: {
    label: "Backlog",
    dotColor: "var(--ink-faint)",
    pillBg: "rgba(255,255,255,.06)",
    pillText: "var(--ink-subtle)",
  },
};

export function FeaturesSection({ features, epicId }: FeaturesSectionProps) {
  const done = features.filter((f) => f.statusId === "DONE").length;
  const total = features.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const action = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <a
        href={`/epics/${epicId}/features`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 12px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          background: "rgba(124,135,255,.18)",
          color: "var(--accent-c)",
          border: "1px solid rgba(124,135,255,.3)",
          textDecoration: "none",
        }}
      >
        + Story
      </a>
      {/* progress pill */}
      <div style={{ width: 64, height: 4, borderRadius: 2, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "rgba(124,135,255,.8)", borderRadius: 2 }} />
      </div>
    </div>
  );

  return (
    <SectionCard
      actions={action}
      icon={KanbanIcon}
      noPadding
      subtitle={`${done} de ${total} concluídas · ${pct}%`}
      title="Features & Breakdown"
    >
      {features.length === 0 ? (
        <p style={{ padding: "24px 18px", color: "var(--ink-faint)", fontSize: 13 }}>
          Nenhuma feature neste épico.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["ID", "FEATURE", "TIME", "ESTADO", "PROGRESSO", "WSJF", "DEPS"].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "8px 16px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--ink-faint)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f) => {
                const status = STATUS_CONFIG[f.statusId] ?? STATUS_CONFIG.BACKLOG;
                const wsjf = f.wsjfScore > 0 ? f.wsjfScore.toFixed(0) : "—";
                const prog = Math.round(f.progressPct);

                return (
                  <tr
                    key={f.id}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,.04)",
                    }}
                  >
                    {/* ID */}
                    <td style={{ padding: "12px 16px", fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>
                      {f.artScopedId ?? "F-???-???"}
                    </td>
                    {/* Feature */}
                    <td style={{ padding: "12px 16px", color: "var(--ink)", fontWeight: 500, maxWidth: 260 }}>
                      {f.title}
                    </td>
                    {/* Time */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      {f.teamName ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                          background: "rgba(255,255,255,.06)",
                          border: "1px solid rgba(255,255,255,.08)",
                          color: "var(--ink-subtle)",
                        }}>
                          {f.teamName}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    {/* Estado */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 500,
                        background: status.pillBg,
                        color: status.pillText,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.dotColor, flexShrink: 0 }} />
                        {status.label}
                      </span>
                    </td>
                    {/* Progresso */}
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 56, height: 4, borderRadius: 2, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${prog}%`, background: "rgba(96,165,250,.8)", borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--ink-muted)", fontFamily: "ui-monospace, monospace" }}>{prog}%</span>
                      </div>
                    </td>
                    {/* WSJF */}
                    <td style={{ padding: "12px 16px", fontFamily: "ui-monospace, monospace", fontSize: 13, color: "var(--ink-muted)", textAlign: "right" }}>
                      {wsjf}
                    </td>
                    {/* DEPS */}
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {f.depsCount > 0 ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: "rgba(251,113,133,.15)",
                          color: "var(--red-text)",
                          border: "1px solid rgba(251,113,133,.25)",
                        }}>
                          {f.depsCount} dep{f.depsCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-faint)", fontSize: 13 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
