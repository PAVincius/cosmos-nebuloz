import {
  BentoCell,
  BentoGrid,
  CellEyebrow,
  CellLabel,
  CellSub,
  CellValue,
  ProgressBar,
  StatusBadge,
} from "../bento-cell";
import { NotificationsCell } from "../notifications-cell";

type OkrRow = {
  id: string;
  title: string;
  keyResults: Array<{ id: string; current: number; target: number }>;
};

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
  teamOkrs?: OkrRow[];
  activeView?: string;
};

const STATUS_PILL_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: "#e54d4d22", text: "#e54d4d" },
  in_progress: { bg: "#f59e0b22", text: "#f59e0b" },
  resolved: { bg: "#27a64422", text: "#27a644" },
};

const MEMBERS = [
  { initials: "AL", name: "Ana Lima", tasks: 4 },
  { initials: "CR", name: "Carlos Reis", tasks: 6 },
  { initials: "BF", name: "Beatriz Farias", tasks: 3 },
];

const GOALS = [
  { label: "Meta A", value: 60 },
  { label: "Meta B", value: 90 },
  { label: "Meta C", value: 45 },
];

const ACTIONS = [
  { label: "Board", href: "/board", icon: "▦" },
  { label: "Impedimentos", href: "/impediments", icon: "⚠" },
  { label: "Retro", href: "/retro", icon: "↺" },
  { label: "Burndown", href: "/burndown", icon: "↘" },
];

const AGENDA = [
  { label: "Daily Standup", time: "09:00", badge: null },
  { label: "Sprint Review", time: "Amanhã", badge: "amber" as const },
  { label: "Retrospectiva", time: "Sexta", badge: null },
];

export default function SmHome({
  team: _team,
  impediments,
  notifications,
  activeSprint,
  teamOkrs = [],
  activeView: _activeView,
}: SmHomeProps) {
  return (
    <BentoGrid>
      {/* ── Row 1 ── */}

      {/* Impedimentos */}
      <BentoCell
        accentColor="#e54d4d"
        eyebrow="Impedimentos"
        eyebrowAction={{ label: "Ver todos", href: "/teams" }}
        priority="critical"
        span={2}
      >
        <CellValue color="#f87171" value={impediments.length} />
        <CellLabel>bloqueadores ativos</CellLabel>

        {impediments.length > 0 && (
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {impediments.slice(0, 2).map((imp) => {
              const pill =
                STATUS_PILL_COLORS[imp.status] ?? STATUS_PILL_COLORS.open;
              return (
                <div
                  key={imp.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                    color: "#d0d6e0",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "70%",
                    }}
                  >
                    {imp.title}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 7px",
                      borderRadius: "999px",
                      background: pill.bg,
                      color: pill.text,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {imp.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </BentoCell>

      {/* WIP do Time */}
      <BentoCell accentColor="#d97706" priority="critical" span={1}>
        <CellEyebrow label="WIP do Time" />
        <CellValue color="#fbbf24" value="6" />
        <CellSub>limite: 5</CellSub>
        <div style={{ marginTop: "10px" }}>
          <StatusBadge variant="amber">⚠ Revisar hoje</StatusBadge>
        </div>
      </BentoCell>

      {/* Velocidade Sprint */}
      <BentoCell span={1}>
        <CellEyebrow label="Velocidade Sprint" />
        <CellValue
          suffix="pts"
          value={activeSprint?.velocity?.toString() ?? "—"}
        />
        <CellLabel>sprint atual</CellLabel>
        <ProgressBar
          color="green"
          max={35}
          value={activeSprint?.velocity ?? 0}
        />
      </BentoCell>

      {/* ── Row 2 ── */}

      {/* Notificações */}
      <BentoCell
        accentColor="#27a644"
        eyebrow="Notificações"
        eyebrowAction={{ label: "Ver todas", href: "/notifications" }}
        priority="critical"
        span={2}
      >
        <NotificationsCell notifications={notifications} />
      </BentoCell>

      {/* Membros do Time */}
      <BentoCell span={2}>
        <CellEyebrow label="Membros do Time" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "4px",
          }}
        >
          {MEMBERS.map((m) => (
            <div
              key={m.initials}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: "#23252a",
                  border: "1px solid #34343a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#d0d6e0",
                  flexShrink: 0,
                }}
              >
                {m.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#f7f8f8",
                    fontWeight: 500,
                  }}
                >
                  {m.name}
                </div>
                <div style={{ fontSize: "11px", color: "#62666d" }}>
                  {m.tasks} tasks abertas
                </div>
              </div>
            </div>
          ))}
        </div>
      </BentoCell>

      {/* ── Row 3 ── */}

      {/* OKRs do Time */}
      <BentoCell span={2}>
        <CellEyebrow
          action={{ label: "Ver →", href: "/portfolio/okrs" }}
          label="OKRs do Time"
        />
        {teamOkrs.length === 0 ? (
          <CellSub>Nenhum OKR de time ativo</CellSub>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "4px",
            }}
          >
            {teamOkrs.map((okr) => {
              const total = okr.keyResults.reduce((s, kr) => s + kr.target, 0);
              const current = okr.keyResults.reduce(
                (s, kr) => s + kr.current,
                0
              );
              const pct =
                total > 0
                  ? Math.min(100, Math.round((current / total) * 100))
                  : 0;
              return (
                <div key={okr.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      color: "#8a8f98",
                      marginBottom: "3px",
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
                  <ProgressBar
                    color={pct >= 70 ? "green" : "primary"}
                    max={100}
                    value={pct}
                  />
                </div>
              );
            })}
          </div>
        )}
      </BentoCell>

      {/* Sprint Goals */}
      <BentoCell span={2}>
        <CellEyebrow label="Sprint Goals" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "4px",
          }}
        >
          {GOALS.map((g) => (
            <div key={g.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#8a8f98",
                  marginBottom: "4px",
                }}
              >
                <span>{g.label}</span>
                <span>{g.value}%</span>
              </div>
              <ProgressBar color="primary" max={100} value={g.value} />
            </div>
          ))}
        </div>
      </BentoCell>

      {/* Ações Rápidas */}
      <BentoCell span={1}>
        <CellEyebrow label="Ações Rápidas" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          {ACTIONS.map((a) => (
            <a
              href={a.href}
              key={a.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                padding: "10px 4px",
                borderRadius: "8px",
                background: "#141516",
                border: "1px solid #23252a",
                fontSize: "11px",
                color: "#8a8f98",
                textDecoration: "none",
                textAlign: "center",
                transition: "border-color 150ms ease, color 150ms ease",
              }}
            >
              <span style={{ fontSize: "16px" }}>{a.icon}</span>
              {a.label}
            </a>
          ))}
        </div>
      </BentoCell>

      {/* Agenda do Time */}
      <BentoCell span={1}>
        <CellEyebrow label="Agenda do Time" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "4px",
          }}
        >
          {AGENDA.map((ev) => (
            <div
              key={ev.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#d0d6e0" }}>{ev.label}</span>
              {ev.badge ? (
                <StatusBadge variant={ev.badge}>{ev.time}</StatusBadge>
              ) : (
                <span style={{ fontSize: "11px", color: "#62666d" }}>
                  {ev.time}
                </span>
              )}
            </div>
          ))}
        </div>
      </BentoCell>
    </BentoGrid>
  );
}
