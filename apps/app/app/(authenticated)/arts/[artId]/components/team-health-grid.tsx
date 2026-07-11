import Link from "next/link";

const AVATAR_COLORS = [
  { bg: "rgba(124,135,255,.18)", text: "#7c87ff" },
  { bg: "rgba(52,211,153,.18)", text: "#34d399" },
  { bg: "rgba(251,191,36,.18)", text: "#fbbf24" },
  { bg: "rgba(96,165,250,.18)", text: "#60a5fa" },
  { bg: "rgba(167,139,250,.18)", text: "#a78bfa" },
  { bg: "rgba(251,113,133,.18)", text: "#fb7185" },
];

type Team = {
  id: string;
  name: string;
  velocity: number | null;
  wip: number;
  members: unknown;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getMemberCount(members: unknown): number {
  if (Array.isArray(members)) return members.length;
  return 8; // default for demo
}

// deterministic mock flow efficiency based on team name
function mockFlowEfficiency(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return 49 + (hash % 40); // 49–88%
}

export function TeamHealthGrid({ teams }: { teams: Team[] }) {
  if (teams.length === 0) {
    return (
      <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>
        Nenhum time configurado nesta ART.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 16,
      }}
    >
      {teams.map((team, idx) => {
        const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
        const initials = getInitials(team.name);
        const memberCount = getMemberCount(team.members);
        const velocity = team.velocity ?? 0;
        const wip = team.wip;
        const flowEff = mockFlowEfficiency(team.name);
        const wipHigh = wip > 5;
        const effColor =
          flowEff >= 75 ? "var(--green)" : flowEff < 55 ? "var(--red)" : "var(--amber)";

        return (
          <Link
            key={team.id}
            href={`/teams/${team.id}/standup`}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
              borderRadius: 14,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {/* Avatar + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: color.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: color.text,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>
                  {team.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  {memberCount} membros
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <MetricRow
                label="Velocity"
                value={velocity > 0 ? `${velocity} SP` : "—"}
                valueColor="var(--green)"
              />
              <MetricRow
                label="Flow load (WIP)"
                value={String(wip)}
                valueColor={wipHigh ? "var(--amber)" : "var(--ink-muted)"}
              />
              <MetricRow
                label="Flow efficiency"
                value={`${flowEff}%`}
                valueColor={effColor}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function MetricRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 12,
        color: "var(--ink-subtle)",
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor }}>{value}</span>
    </div>
  );
}
