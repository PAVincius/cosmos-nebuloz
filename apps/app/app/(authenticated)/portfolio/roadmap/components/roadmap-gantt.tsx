"use client";

import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import type { RoadmapItemWithRelations } from "@/app/actions/roadmap/schema";
import { RoadmapBar } from "./roadmap-bar";
import {
  buildFixedQuarterColumns,
  buildLanes,
  getItemQuarterSpan,
  STATUS_TONE,
  TONE_RGB,
  type Tone,
} from "./roadmap-gantt-utils";

type RoadmapGanttProps = {
  items: RoadmapItemWithRelations[];
  arts: { id: string; name: string }[];
  onDelete: (item: RoadmapItemWithRelations) => void;
};

function getBarTone(item: RoadmapItemWithRelations, laneTone: Tone): Tone {
  if (item.status === "PLANNED") {
    return laneTone;
  }
  return STATUS_TONE[item.status as keyof typeof STATUS_TONE];
}

function computeProgress(item: RoadmapItemWithRelations, today: Date): number {
  if (item.status === "DONE") {
    return 100;
  }
  if (item.status !== "IN_PROGRESS") {
    return 0;
  }
  const start = new Date(item.startDate).getTime();
  const end = new Date(item.endDate).getTime();
  if (end <= start) {
    return 50;
  }
  const pct = ((today.getTime() - start) / (end - start)) * 100;
  return Math.min(96, Math.max(4, Math.round(pct)));
}

/** Greedy interval-packing so overlapping items in the same ART stack into extra rows. */
function packLaneRows(
  entries: { item: RoadmapItemWithRelations; startIdx: number; endIdx: number }[]
): { rowById: Map<string, number>; rowCount: number } {
  const rowEndByRow: number[] = [];
  const rowById = new Map<string, number>();
  const sorted = [...entries].sort((a, b) => a.startIdx - b.startIdx);
  for (const entry of sorted) {
    let row = rowEndByRow.findIndex((endIdx) => endIdx < entry.startIdx);
    if (row === -1) {
      row = rowEndByRow.length;
      rowEndByRow.push(entry.endIdx);
    } else {
      rowEndByRow[row] = entry.endIdx;
    }
    rowById.set(entry.item.id, row);
  }
  return { rowById, rowCount: Math.max(1, rowEndByRow.length) };
}

export function RoadmapGantt({ items, arts, onDelete }: RoadmapGanttProps) {
  const reduceMotion = useReducedMotion();
  const today = useMemo(() => new Date(), []);
  const columns = useMemo(() => buildFixedQuarterColumns(4), []);
  const artMap = useMemo(
    () => new Map(arts.map((art) => [art.id, art.name])),
    [arts]
  );
  const lanes = useMemo(() => buildLanes(items, artMap), [items, artMap]);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--cosmos-r-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px repeat(4, 1fr)",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid var(--hairline)",
            borderRight: "1px solid var(--hairline)",
            color: "var(--ink-subtle)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".04em",
            padding: "10px 14px",
            textTransform: "uppercase",
          }}
        >
          ART
        </div>
        {columns.map((col, i) => (
          <div
            key={col.key}
            style={{
              background: i === 1 ? "rgba(var(--accent-rgb),.08)" : "transparent",
              borderBottom: "1px solid var(--hairline)",
              borderRight: "1px solid var(--hairline)",
              color: i === 1 ? "var(--accent-text)" : "var(--ink-muted)",
              fontSize: 12,
              fontWeight: 700,
              padding: "10px 14px",
              textAlign: "center",
            }}
          >
            {col.label}
            {i === 1 && (
              <span style={{ display: "block", fontSize: 10, fontWeight: 600 }}>
                PI atual
              </span>
            )}
          </div>
        ))}
      </div>

      {lanes.length === 0 && (
        <div
          style={{
            color: "var(--ink-muted)",
            fontSize: 12.5,
            padding: "32px 14px",
            textAlign: "center",
          }}
        >
          Nenhum item de roadmap posicionado nas 4 PIs em exibição.
        </div>
      )}

      {lanes.map((lane) => {
        const entries = lane.items
          .map((item) => {
            const span = getItemQuarterSpan(item, columns);
            return span
              ? { endIdx: span.endIdx, item, startIdx: span.startIdx }
              : null;
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);
        const { rowById, rowCount } = packLaneRows(entries);
        const rgb = TONE_RGB[lane.tone];

        return (
          <div
            key={lane.key}
            style={{
              borderBottom: "1px solid var(--hairline)",
              display: "grid",
              gridTemplateColumns: "180px repeat(4, 1fr)",
            }}
          >
            <div
              style={{
                alignItems: "center",
                borderRight: "1px solid var(--hairline)",
                display: "flex",
                gap: 8,
                padding: "12px 14px",
              }}
            >
              <span
                aria-hidden
                style={{
                  background: `rgb(${rgb})`,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 3px rgba(${rgb},.18)`,
                  flexShrink: 0,
                  height: 8,
                  width: 8,
                }}
              />
              <span style={{ color: "var(--ink)", fontSize: 12.5, fontWeight: 600 }}>
                {lane.label}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridColumn: "2 / -1",
                gridTemplateColumns: "repeat(4, 1fr)",
                gridTemplateRows: `repeat(${rowCount}, minmax(54px, auto))`,
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridColumn: "1 / -1",
                  gridRow: "1 / -1",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  inset: 0,
                  position: "absolute",
                }}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    style={{ borderRight: "1px solid var(--hairline)" }}
                  />
                ))}
              </div>
              {entries.map(({ item, startIdx, endIdx }) => (
                <RoadmapBar
                  gridColumn={`${startIdx + 1} / ${endIdx + 2}`}
                  item={item}
                  key={item.id}
                  onDelete={onDelete}
                  progress={computeProgress(item, today)}
                  reduceMotion={!!reduceMotion}
                  row={rowById.get(item.id) ?? 0}
                  tone={getBarTone(item, lane.tone)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
