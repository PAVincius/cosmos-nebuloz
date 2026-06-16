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

type LpmHomeProps = {
  leanBudgets: Array<{ id: string; name: string; amount: number }>;
  arts: Array<{ id: string; name: string }>;
  pendingEpics: Array<{
    id: string;
    sequenceNumber?: number | null;
    title: string;
    lifecycleStatus: string;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    read: boolean;
    createdAt: Date;
    metadata: unknown;
  }>;
  activeView?: string;
};

export default function LpmHome({
  leanBudgets,
  arts,
  pendingEpics,
  notifications,
}: LpmHomeProps) {
  // ── Budget summary ──────────────────────────────────────────────────────────
  const totalAllocated = leanBudgets.reduce((sum, b) => sum + b.amount, 0);
  const totalPct = leanBudgets.length > 0 ? Math.round(totalAllocated) : null;

  const visibleBudgets = leanBudgets.slice(0, 3);
  const visibleArts = arts.slice(0, 4);
  const visibleEpics = pendingEpics.slice(0, 3);

  // ── Static WSJF rows ────────────────────────────────────────────────────────
  const wsjfRows = [
    { title: "Migração Cloud Infra", score: 92 },
    { title: "Integração ERP SAP", score: 74 },
    { title: "Portal Self-Service", score: 61 },
  ];

  // ── Static agenda ───────────────────────────────────────────────────────────
  const agendaItems = [
    { time: "09:00", label: "PI Sync — RTE Review" },
    { time: "14:00", label: "Budget Review Board" },
    { time: "16:30", label: "Exec Steering Committee" },
  ];

  return (
    <BentoGrid>
      {/* ── Row 1 ─────────────────────────────────────────────────────────── */}

      {/* 1. Lean Budget */}
      <BentoCell
        accentColor="#f59e0b"
        eyebrow="Lean Budget Guardrails"
        eyebrowAction={{ label: "Ver budgets →", href: "/portfolio/budgets" }}
        priority="critical"
        span={2}
      >
        <CellEyebrow action={undefined} color="#f59e0b" label="" />
        {leanBudgets.length > 0 ? (
          <>
            <CellValue
              color="#fbbf24"
              suffix="alocado"
              value={totalPct !== null ? `${totalPct}%` : "—"}
            />
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {visibleBudgets.map((b) => {
                const pct =
                  totalAllocated > 0
                    ? Math.round((b.amount / totalAllocated) * 100)
                    : 0;
                return (
                  <div key={b.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: "#d0d6e0",
                        marginBottom: 2,
                      }}
                    >
                      <span>{b.name}</span>
                      <span style={{ color: "#f59e0b" }}>{pct}%</span>
                    </div>
                    <ProgressBar color="amber" max={100} value={pct} />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <CellSub>Nenhum budget configurado</CellSub>
        )}
      </BentoCell>

      {/* 2. Épicos Pendentes */}
      <BentoCell
        accentColor="#f59e0b"
        eyebrow="Épicos Pendentes"
        eyebrowAction={{ label: "Ver →", href: "/epics" }}
        priority="critical"
        span={1}
      >
        <CellValue color="#fbbf24" value={pendingEpics.length} />
        {pendingEpics.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <StatusBadge variant="amber">⚠ Requer decisão</StatusBadge>
          </div>
        )}
      </BentoCell>

      {/* 3. OKRs Portfolio */}
      <BentoCell eyebrow="OKRs Portfolio" span={1}>
        <CellValue value="3/5" />
        <CellLabel>KRs on track Q3</CellLabel>
        <ProgressBar color="primary" max={5} value={3} />
      </BentoCell>

      {/* ── Row 2 ─────────────────────────────────────────────────────────── */}

      {/* 4. Notifications */}
      <BentoCell
        accentColor="#f59e0b"
        eyebrow="Notificações Executivas"
        eyebrowAction={{ label: "Ver todas →", href: "/notifications" }}
        priority="critical"
        span={2}
      >
        <CellSub>Filtrado: riscos e sistema</CellSub>
        <div style={{ marginTop: 8 }}>
          <NotificationsCell
            href="/notifications"
            notifications={notifications}
          />
        </div>
      </BentoCell>

      {/* 5. Épicos pra Aprovar */}
      <BentoCell eyebrow="Épicos Aguardando Governança" span={2}>
        {pendingEpics.length === 0 ? (
          <CellSub>Nenhum épico aguardando</CellSub>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
            }}
          >
            {visibleEpics.map((epic) => (
              <div
                key={epic.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "#8a8f98",
                      fontWeight: 500,
                      letterSpacing: "0.3px",
                    }}
                  >
                    {epic.sequenceNumber != null
                      ? `E-${String(epic.sequenceNumber).padStart(3, "0")}`
                      : "E-???"}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#f7f8f8",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {epic.title}
                  </span>
                </div>
                <a
                  href={`/epics/${epic.id}`}
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                    background: "#23252a",
                    border: "1px solid #34343a",
                    color: "#f7f8f8",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Aprovar
                </a>
              </div>
            ))}
          </div>
        )}
      </BentoCell>

      {/* ── Row 3 ─────────────────────────────────────────────────────────── */}

      {/* 6. WSJF Portfolio */}
      <BentoCell eyebrow="WSJF Portfolio" span={2}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 4,
          }}
        >
          {wsjfRows.map((row) => (
            <div
              key={row.title}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, color: "#d0d6e0" }}>
                {row.title}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: "#f59e0b1a",
                  border: "1px solid #f59e0b33",
                  color: "#f59e0b",
                }}
              >
                {row.score}
              </span>
            </div>
          ))}
        </div>
      </BentoCell>

      {/* 7. ARTs Overview */}
      <BentoCell eyebrow="ARTs Overview" span={2}>
        {arts.length === 0 ? (
          <CellSub>Nenhuma ART configurada</CellSub>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
            }}
          >
            {visibleArts.map((art) => (
              <div
                key={art.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#27a644",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, color: "#d0d6e0" }}>
                    {art.name}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#62666d" }}>Flow —%</span>
              </div>
            ))}
          </div>
        )}
      </BentoCell>

      {/* 8. Ações Rápidas */}
      <BentoCell eyebrow="Ações Rápidas" span={1}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 4,
          }}
        >
          {[
            { label: "Budget", href: "/portfolio/budgets" },
            { label: "Épicos", href: "/epics" },
            { label: "WSJF", href: "/portfolio/wsjf" },
            { label: "OKRs", href: "/okrs" },
          ].map((action) => (
            <a
              href={action.href}
              key={action.href}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "7px 10px",
                borderRadius: 8,
                fontSize: 13,
                color: "#d0d6e0",
                background: "#141516",
                border: "1px solid #23252a",
                textDecoration: "none",
              }}
            >
              {action.label}
            </a>
          ))}
        </div>
      </BentoCell>

      {/* 9. Agenda */}
      <BentoCell eyebrow="Agenda Executiva" span={1}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 4,
          }}
        >
          {agendaItems.map((item) => (
            <div
              key={item.time}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "#5e6ad2",
                  fontWeight: 600,
                  minWidth: 36,
                }}
              >
                {item.time}
              </span>
              <span style={{ fontSize: 12, color: "#8a8f98" }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </BentoCell>
    </BentoGrid>
  );
}
