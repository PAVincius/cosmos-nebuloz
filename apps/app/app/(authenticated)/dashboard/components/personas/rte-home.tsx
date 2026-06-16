import Link from "next/link";
import {
  BentoCell,
  BentoGrid,
  CellEyebrow,
  CellLabel,
  CellSub,
  CellValue,
  ProgressBar,
  Sparkline,
  StatusBadge,
} from "../bento-cell";
import { NotificationsCell } from "../notifications-cell";

type OkrRow = {
  id: string;
  title: string;
  keyResults: Array<{ id: string; current: number; target: number }>;
};

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
  okrs?: OkrRow[];
  activeView?: string;
};

export default function RteHome({
  arts,
  risks,
  notifications,
  piObjectives,
  okrs = [],
}: RteHomeProps) {
  // Row 2 — derived values
  const unownedRisks = risks.filter((r) =>
    ["IDENTIFIED", "ROAM"].includes(r.status)
  ).length;

  // Row 3 — PI Objectives
  const total = piObjectives.length;
  const onTrack = piObjectives.filter(
    (o) => o.status === "COMMITTED" || (o.achievedValue ?? 0) > 0
  ).length;

  return (
    <BentoGrid>
      {/* ── Row 1 ── */}

      {/* 1. Flow Efficiency */}
      <BentoCell accentColor="#5e6ad2" priority="critical" span={1}>
        <CellEyebrow
          action={{ label: "Ver →", href: "/analytics/flow" }}
          label="Flow Efficiency"
        />
        <CellValue value="73%" />
        <StatusBadge variant="green">↑ +4% vs sprint anterior</StatusBadge>
        <Sparkline color="primary" data={[38, 52, 47, 63, 70, 73]} />
      </BentoCell>

      {/* 2. Riscos ROAM */}
      <BentoCell accentColor="#e54d4d" priority="critical" span={1}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              color: "#62666d",
              fontWeight: 500,
            }}
          >
            Riscos ROAM
          </span>
          <Link
            href="/risks"
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              color: "#e54d4d",
              textDecoration: "none",
            }}
          >
            Ver →
          </Link>
        </div>
        <CellValue color="#f87171" value={unownedRisks} />
        <CellLabel>sem owner atribuído</CellLabel>
        {unownedRisks > 0 && (
          <div style={{ marginTop: "8px" }}>
            <StatusBadge variant="red">⚠ Requer ação hoje</StatusBadge>
          </div>
        )}
      </BentoCell>

      {/* 3. PI Objectives */}
      <BentoCell span={1}>
        <CellEyebrow label="PI Objectives" />
        <CellValue value={total > 0 ? `${onTrack}/${total}` : "0/0"} />
        <ProgressBar color="primary" max={Math.max(total, 1)} value={onTrack} />
        <CellSub>Sprint atual</CellSub>
      </BentoCell>

      {/* 4. Dependências */}
      <BentoCell span={1}>
        <CellEyebrow label="Dependências" />
        <CellValue value="7" />
        <CellLabel>abertas no ART</CellLabel>
        <div style={{ marginTop: "8px" }}>
          <StatusBadge variant="amber">2 bloqueadas</StatusBadge>
        </div>
      </BentoCell>

      {/* ── Row 2 ── */}

      {/* 5. Notifications */}
      <BentoCell accentColor="#5e6ad2" priority="critical" span={2}>
        <CellEyebrow
          action={{ label: "Ver tudo →", href: "/notifications" }}
          label="Notificações"
        />
        <CellLabel>Inbox do ART</CellLabel>
        <NotificationsCell notifications={notifications} />
      </BentoCell>

      {/* 6. Team Health */}
      <BentoCell span={2}>
        <CellEyebrow
          action={{ label: "Ver ARTs →", href: "/arts" }}
          label="Saúde dos Times"
        />
        {arts.length === 0 ? (
          <CellSub>Nenhum ART configurado</CellSub>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "4px",
            }}
          >
            {arts.slice(0, 4).map((art) => (
              <div
                key={art.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#27a644",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "#d0d6e0" }}>
                    {art.name}
                  </span>
                </div>
                <Link
                  href={"/arts"}
                  style={{
                    fontSize: "11px",
                    color: "#5e6ad2",
                    textDecoration: "none",
                  }}
                >
                  Ver ART
                </Link>
              </div>
            ))}
          </div>
        )}
      </BentoCell>

      {/* ── Row 3 ── */}

      {/* 7. Riscos Ativos */}
      <BentoCell span={2}>
        <CellEyebrow label="Riscos Ativos" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "4px",
          }}
        >
          {risks.slice(0, 3).map((risk) => {
            const tagStyle = getRiskTagStyle(risk.status);
            return (
              <div
                key={risk.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "#d0d6e0",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {risk.title}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 500,
                    padding: "2px 7px",
                    borderRadius: "999px",
                    flexShrink: 0,
                    ...tagStyle,
                  }}
                >
                  {risk.status}
                </span>
              </div>
            );
          })}
          {risks.length === 0 && <CellSub>Nenhum risco ativo</CellSub>}
        </div>
      </BentoCell>

      {/* 8. Quick Actions */}
      <BentoCell span={1}>
        <CellEyebrow label="Ações Rápidas" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            marginTop: "8px",
          }}
        >
          {[
            { label: "Program Board", href: "/arts" },
            { label: "Flow", href: "/analytics/flow" },
            { label: "I&A", href: "/arts" },
            { label: "Deps", href: "/dependencies" },
          ].map((action) => (
            <Link
              href={action.href}
              key={action.href + action.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 4px",
                borderRadius: "8px",
                background: "#141516",
                border: "1px solid #23252a",
                fontSize: "11px",
                color: "#d0d6e0",
                textDecoration: "none",
                textAlign: "center",
                transition: "border-color 150ms ease",
              }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </BentoCell>

      {/* 9. OKRs ART */}
      <BentoCell span={1}>
        <CellEyebrow
          action={{ label: "Ver →", href: "/portfolio/okrs" }}
          label="OKRs do ART"
        />
        {okrs.length === 0 ? (
          <CellSub>Nenhum OKR ART ativo</CellSub>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "4px",
            }}
          >
            {okrs.map((okr) => {
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

      {/* 10. Eventos */}
      <BentoCell span={1}>
        <CellEyebrow label="Próximos Eventos" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "8px",
          }}
        >
          <div style={{ fontSize: "13px", color: "#d0d6e0" }}>
            Sprint Review
          </div>
          <div style={{ fontSize: "13px", color: "#d0d6e0" }}>Sync RTE+PMs</div>
          <div style={{ fontSize: "13px", color: "#f59e0b", fontWeight: 500 }}>
            PI Planning
          </div>
        </div>
      </BentoCell>
    </BentoGrid>
  );
}

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
