import {
  BentoCell,
  BentoGrid,
  CellLabel,
  CellSub,
  CellValue,
  ProgressBar,
  StatusBadge,
} from "../bento-cell";
import { NotificationsCell } from "../notifications-cell";

type PmHomeProps = {
  okrs: Array<{
    id: string;
    title: string;
    keyResults: Array<{
      id: string;
      title: string;
      current: number;
      target: number;
      unit?: string | null;
    }>;
  }>;
  piObjectives: Array<{ id: string; status?: string }>;
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

export default function PmHome({
  okrs,
  piObjectives,
  notifications,
}: PmHomeProps) {
  // ── OKRs: first okr's KRs, up to 3
  const firstOkr = okrs[0] ?? null;
  const visibleKrs = firstOkr ? firstOkr.keyResults.slice(0, 3) : [];

  // ── PI Objectives
  const onTrack = piObjectives.filter((o) => o.status === "COMMITTED").length;
  const total = piObjectives.length;

  return (
    <BentoGrid>
      {/* ── Row 1 ─────────────────────────────────────────────── */}

      {/* Cell 1: OKRs — span 2 */}
      <BentoCell
        accentColor="#8b5cf6"
        eyebrow="OKRs Q3"
        eyebrowAction={{ label: "Ver todos", href: "/portfolio/okrs" }}
        priority="critical"
        span={2}
      >
        {visibleKrs.length === 0 ? (
          <CellSub>Nenhum OKR configurado</CellSub>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "4px",
            }}
          >
            {visibleKrs.map((kr) => {
              const current = kr.current ?? 0;
              const max = kr.target ?? 100;
              const pct = max > 0 ? (current / max) * 100 : 0;
              const barColor = pct >= 70 ? "green" : "amber";
              return (
                <div key={kr.id}>
                  <CellLabel>{kr.title}</CellLabel>
                  <ProgressBar
                    color={barColor}
                    max={Math.max(max, 1)}
                    value={current}
                  />
                </div>
              );
            })}
          </div>
        )}
      </BentoCell>

      {/* Cell 2: PI Objectives — span 1 */}
      <BentoCell
        accentColor="#8b5cf6"
        eyebrow="PI Objectives"
        priority="critical"
        span={1}
      >
        <CellValue value={`${onTrack}/${total}`} />
        <ProgressBar color="green" max={Math.max(total, 1)} value={onTrack} />
        <CellSub>Committed</CellSub>
      </BentoCell>

      {/* Cell 3: Features em Risco — span 1 */}
      <BentoCell accentColor="#d97706" eyebrow="Features em Risco" span={1}>
        <CellValue color="#fbbf24" value="2" />
        <div style={{ marginTop: "8px" }}>
          <StatusBadge variant="amber">⚠ Ação necessária</StatusBadge>
        </div>
      </BentoCell>

      {/* ── Row 2 ─────────────────────────────────────────────── */}

      {/* Cell 4: Notifications — span 2 */}
      <BentoCell
        accentColor="#8b5cf6"
        eyebrow="Notificações"
        priority="critical"
        span={2}
      >
        <NotificationsCell notifications={notifications} />
      </BentoCell>

      {/* Cell 5: WSJF Top — span 2 */}
      <BentoCell
        eyebrow="WSJF — Top Prioridades"
        eyebrowAction={{ label: "Ver todos", href: "/portfolio/wsjf" }}
        span={2}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "4px",
          }}
        >
          {[
            { label: "Migração de autenticação SSO", score: "92" },
            { label: "Dashboard de métricas PI", score: "84" },
            { label: "Integração webhook Jira", score: "77" },
          ].map((item) => (
            <div
              key={item.label}
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
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
              <StatusBadge variant="purple">{item.score}</StatusBadge>
            </div>
          ))}
        </div>
      </BentoCell>

      {/* ── Row 3 ─────────────────────────────────────────────── */}

      {/* Cell 6: Backlog Health — span 2 */}
      <BentoCell eyebrow="Saúde do Backlog" span={2}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            marginTop: "4px",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#27a6441a",
              border: "1px solid #27a64433",
              borderRadius: "8px",
              padding: "10px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "22px",
                fontWeight: 600,
                color: "#27a644",
                lineHeight: 1,
              }}
            >
              14
            </div>
            <div
              style={{ fontSize: "11px", color: "#8a8f98", marginTop: "4px" }}
            >
              Ready
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: "#f59e0b1a",
              border: "1px solid #f59e0b33",
              borderRadius: "8px",
              padding: "10px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "22px",
                fontWeight: 600,
                color: "#f59e0b",
                lineHeight: 1,
              }}
            >
              8
            </div>
            <div
              style={{ fontSize: "11px", color: "#8a8f98", marginTop: "4px" }}
            >
              Refinando
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: "#23252a",
              border: "1px solid #34343a",
              borderRadius: "8px",
              padding: "10px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "22px",
                fontWeight: 600,
                color: "#8a8f98",
                lineHeight: 1,
              }}
            >
              22
            </div>
            <div
              style={{ fontSize: "11px", color: "#8a8f98", marginTop: "4px" }}
            >
              Bruto
            </div>
          </div>
        </div>
      </BentoCell>

      {/* Cell 7: Ações Rápidas — span 1 */}
      <BentoCell eyebrow="Ações Rápidas" span={1}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            marginTop: "4px",
          }}
        >
          {[
            { label: "Kanban", href: "/portfolio/kanban" },
            { label: "OKRs", href: "/portfolio/okrs" },
            { label: "WSJF", href: "/portfolio/wsjf" },
            { label: "Backlog", href: "/portfolio/backlog" },
          ].map((action) => (
            <a
              href={action.href}
              key={action.href}
              style={{
                display: "block",
                padding: "6px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#d0d6e0",
                background: "#141516",
                border: "1px solid #23252a",
                textDecoration: "none",
                transition: "border-color 150ms ease",
              }}
            >
              {action.label}
            </a>
          ))}
        </div>
      </BentoCell>

      {/* Cell 8: Agenda — span 1 */}
      <BentoCell eyebrow="Agenda" span={1}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "4px",
          }}
        >
          {[
            { time: "09:00", label: "PI Planning sync" },
            { time: "11:30", label: "Refinamento de backlog" },
            { time: "14:00", label: "Review de métricas" },
          ].map((event) => (
            <div
              key={event.time}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontSize: "11px",
                  color: "#62666d",
                  width: "36px",
                }}
              >
                {event.time}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  color: "#8a8f98",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {event.label}
              </span>
            </div>
          ))}
        </div>
      </BentoCell>
    </BentoGrid>
  );
}
