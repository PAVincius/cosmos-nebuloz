"use client";

// roadmap.tsx — Roadmap, wired to listRoadmapItems(). Multi-PI Gantt-style
// timeline: ART lanes (rows) x period columns (across), each RoadmapItem
// positioned by its real startDate/endDate. RoadmapItem carries no PI/period
// foreign key (only startDate/endDate — see RoadmapItem in portfolio.prisma),
// and PIPlan windows aren't guaranteed aligned across ARTs, so the period
// columns here are calendar quarters computed directly from the items' own
// real dates, not a fabricated PI axis. Read-only: drag-to-edit / context-
// menu date editing needs a mutation this screen doesn't wire — see
// apps/app/app/actions/roadmap/index.ts for the full (unused-by-this-screen)
// CRUD layer that already exists for that. The handoff's per-theme filter is
// skipped: RoadmapItem has no theme linkage without an Epic→StrategicTheme
// join this screen doesn't fetch.
import { useEffect, useMemo, useState } from "react";
import {
  listRoadmapItems,
  type RoadmapItemView,
} from "@/app/(cosmos)/actions/roadmap";
import { EmptyState } from "../empty-state";
import { Icon } from "../icons";
import { Badge, ErrorState, PageHeader, type Tone } from "../kit";

const STATUS_INFO: Record<string, { tone: Tone; label: string }> = {
  PLANNED: { tone: "neutral", label: "Planejado" },
  IN_PROGRESS: { tone: "blue", label: "Em progresso" },
  DONE: { tone: "green", label: "Concluído" },
};

function statusInfo(status: string): { tone: Tone; label: string } {
  return STATUS_INFO[status] ?? { tone: "neutral", label: status };
}

function fmtRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  const start = new Date(startIso).toLocaleDateString("pt-BR", opts);
  const end = new Date(endIso).toLocaleDateString("pt-BR", opts);
  return `${start} → ${end}`;
}

// ── Period axis — calendar quarters derived from the items' own real dates ──

export type Period = {
  key: string;
  label: string;
  startMs: number;
  endMs: number;
};

function quarterOf(ms: number): { year: number; q: number } {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) + 1 };
}

function quarterBounds(
  year: number,
  q: number
): { startMs: number; endMs: number } {
  const startMs = Date.UTC(year, (q - 1) * 3, 1);
  const endMs = q === 4 ? Date.UTC(year + 1, 0, 1) : Date.UTC(year, q * 3, 1);
  return { startMs, endMs };
}

export function computePeriods(
  items: Pick<RoadmapItemView, "startDate" | "endDate">[]
): Period[] {
  if (items.length === 0) {
    return [];
  }
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    minMs = Math.min(minMs, Date.parse(item.startDate));
    maxMs = Math.max(maxMs, Date.parse(item.endDate));
  }
  const last = quarterOf(maxMs);
  const periods: Period[] = [];
  let { year, q } = quarterOf(minMs);
  // 40-quarter (10-year) safety cap — real roadmap horizons never approach it.
  for (let i = 0; i < 40; i++) {
    const bounds = quarterBounds(year, q);
    periods.push({
      key: `${year}-T${q}`,
      label: `T${q} ${year}`,
      ...bounds,
    });
    if (year === last.year && q === last.q) {
      break;
    }
    q += 1;
    if (q > 4) {
      q = 1;
      year += 1;
    }
  }
  return periods;
}

export function positionItem(
  item: Pick<RoadmapItemView, "startDate" | "endDate">,
  periods: Period[]
): { colStart: number; colSpan: number } | null {
  if (periods.length === 0) {
    return null;
  }
  const startMs = Date.parse(item.startDate);
  const rawEndMs = Date.parse(item.endDate);
  // Half-open interval overlap needs a non-empty span — nudge zero-duration
  // items (startDate === endDate) forward by 1ms so they still land somewhere.
  const endMs = rawEndMs > startMs ? rawEndMs : startMs + 1;
  const overlapping: number[] = [];
  for (const [i, period] of periods.entries()) {
    if (startMs < period.endMs && endMs > period.startMs) {
      overlapping.push(i);
    }
  }
  if (overlapping.length === 0) {
    const idx = startMs <= periods[0].startMs ? 0 : periods.length - 1;
    return { colStart: idx + 1, colSpan: 1 };
  }
  const first = Math.min(...overlapping);
  const last = Math.max(...overlapping);
  return { colStart: first + 1, colSpan: last - first + 1 };
}

function isCurrentPeriod(period: Period): boolean {
  const now = Date.now();
  return now >= period.startMs && now < period.endMs;
}

// ── ART lanes ──

type Lane = { key: string; label: string; items: RoadmapItemView[] };

const UNASSIGNED_LANE_KEY = "__unassigned__";

export function buildLanes(items: RoadmapItemView[]): Lane[] {
  const byKey = new Map<string, Lane>();
  for (const item of items) {
    const key = item.artId ?? UNASSIGNED_LANE_KEY;
    const label = item.artName ?? "Sem ART atribuído";
    const lane = byKey.get(key);
    if (lane) {
      lane.items.push(item);
    } else {
      byKey.set(key, { key, label, items: [item] });
    }
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.key === UNASSIGNED_LANE_KEY) {
      return 1;
    }
    if (b.key === UNASSIGNED_LANE_KEY) {
      return -1;
    }
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

// ── Screen ──

export default function RoadmapScreen() {
  const [items, setItems] = useState<RoadmapItemView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRoadmapItems().then((r) => {
      if (r.ok) {
        setItems(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  const periods = useMemo(() => computePeriods(items), [items]);
  const lanes = useMemo(() => buildLanes(items), [items]);
  const milestoneCount = useMemo(
    () => items.filter((i) => i.milestone).length,
    [items]
  );

  const gridCols = `200px repeat(${periods.length}, 1fr)`;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Planejamento"
        meta={
          <>
            <Badge icon="route" tone="accent">
              {items.length} itens no horizonte
            </Badge>
            {milestoneCount > 0 && (
              <Badge icon="flag" tone="amber">
                {milestoneCount} marcos
              </Badge>
            )}
          </>
        }
        subtitle="Épicos e marcos do portfólio por ART, ao longo dos períodos do roadmap."
        title="Roadmap"
      />
      {error && <ErrorState />}

      {!(loading || error) && items.length === 0 && (
        <EmptyState
          description="Nenhum item de roadmap foi registrado para este tenant ainda."
          icon="calendar"
          title="Nenhum item de roadmap"
        />
      )}

      {items.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 14,
            }}
          >
            {Object.entries(STATUS_INFO).map(([status, info]) => (
              <span
                key={status}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: "var(--ink-muted)",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    background:
                      info.tone === "neutral"
                        ? "var(--ink-faint)"
                        : `var(--${info.tone})`,
                  }}
                />
                {info.label}
              </span>
            ))}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--ink-muted)",
                fontWeight: 500,
              }}
            >
              <Icon
                name="flag"
                size={13}
                strokeWidth={2.3}
                style={{ color: "var(--amber)" }}
              />
              Marco
            </span>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--card-shadow)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--hairline)",
                display: "grid",
                gridTemplateColumns: gridCols,
              }}
            >
              <div
                style={{
                  borderRight: "1px solid var(--hairline)",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".06em",
                  padding: "12px 16px",
                  textTransform: "uppercase",
                }}
              >
                ART
              </div>
              {periods.map((period, i) => {
                const current = isCurrentPeriod(period);
                return (
                  <div
                    key={period.key}
                    style={{
                      alignItems: "center",
                      background: current
                        ? "var(--accent-soft)"
                        : "transparent",
                      borderRight:
                        i < periods.length - 1
                          ? "1px solid var(--hairline)"
                          : "none",
                      display: "flex",
                      gap: 7,
                      padding: "12px 14px",
                    }}
                  >
                    <span
                      style={{
                        color: current ? "var(--accent)" : "var(--ink)",
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "-.01em",
                      }}
                    >
                      {period.label}
                    </span>
                    {current && (
                      <Badge dot tone="accent">
                        agora
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {lanes.map((lane, li) => (
              <div
                key={lane.key}
                style={{
                  borderBottom:
                    li < lanes.length - 1
                      ? "1px solid var(--hairline)"
                      : "none",
                  display: "grid",
                  gridTemplateColumns: gridCols,
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: "var(--surface-2)",
                    borderRight: "1px solid var(--hairline)",
                    display: "flex",
                    padding: 16,
                  }}
                >
                  <span
                    style={{
                      color: "var(--ink)",
                      fontSize: 12.5,
                      fontWeight: 700,
                      letterSpacing: "-.01em",
                    }}
                  >
                    {lane.label}
                  </span>
                </div>
                <div
                  style={{
                    gridColumn: `2 / span ${periods.length}`,
                    minHeight: 68,
                    padding: 10,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${periods.length}, 1fr)`,
                      inset: 0,
                      pointerEvents: "none",
                      position: "absolute",
                    }}
                  >
                    {periods.map((period, i) => (
                      <div
                        key={period.key}
                        style={{
                          background: isCurrentPeriod(period)
                            ? "rgba(var(--accent-rgb),.05)"
                            : "transparent",
                          borderRight:
                            i < periods.length - 1
                              ? "1px solid var(--hairline)"
                              : "none",
                        }}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      alignContent: "start",
                      display: "grid",
                      gap: 8,
                      gridTemplateColumns: `repeat(${periods.length}, 1fr)`,
                      position: "relative",
                    }}
                  >
                    {lane.items.map((item) => {
                      const pos = positionItem(item, periods);
                      if (!pos) {
                        return null;
                      }
                      const info = statusInfo(item.status);
                      return (
                        <div
                          key={item.id}
                          style={{
                            alignItems: "center",
                            background: "var(--surface-2)",
                            border: "1px solid var(--hairline)",
                            borderLeft: `3px solid ${item.color}`,
                            borderRadius: "var(--r-sm)",
                            display: "flex",
                            gap: 6,
                            gridColumn: `${pos.colStart} / span ${pos.colSpan}`,
                            minWidth: 0,
                            padding: "8px 10px",
                          }}
                          title={`${item.title} · ${fmtRange(item.startDate, item.endDate)}`}
                        >
                          {item.milestone && (
                            <Icon
                              name="flag"
                              size={11}
                              strokeWidth={2.3}
                              style={{ color: "var(--amber)", flexShrink: 0 }}
                            />
                          )}
                          <span
                            style={{
                              color: "var(--ink)",
                              flex: 1,
                              fontSize: 12.5,
                              fontWeight: 600,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.title}
                          </span>
                          <Badge tone={info.tone}>{info.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
