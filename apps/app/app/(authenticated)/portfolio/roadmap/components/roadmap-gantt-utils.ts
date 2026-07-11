import type {
  RoadmapItemWithRelations,
  RoadmapStatus,
} from "@/app/actions/roadmap/schema";

// ─── Tone palette (mirrors KpiCard's TONES rgb constants for visual parity) ─

export type Tone = "green" | "blue" | "purple" | "amber" | "red";

export const TONE_RGB: Record<Tone, string> = {
  green: "52,211,153",
  blue: "91,141,239",
  purple: "167,139,250",
  amber: "251,191,36",
  red: "251,113,133",
};

export const TONE_TEXT_VAR: Record<Tone, string> = {
  green: "var(--green-text)",
  blue: "var(--blue-text)",
  purple: "var(--purple-text)",
  amber: "var(--amber-text)",
  red: "var(--red-text)",
};

// Prototype fixes one tone per ART name (Payments=blue, Platform=purple,
// Growth=green, Data & AI=amber). Unknown ART names fall back to a stable
// cycle through the same 4-tone palette used for lanes.
const KNOWN_ART_TONE: Record<string, Tone> = {
  Payments: "blue",
  Platform: "purple",
  Growth: "green",
  "Data & AI": "amber",
};
const LANE_TONE_CYCLE: Tone[] = ["blue", "purple", "green", "amber"];

export const STATUS_TONE: Record<RoadmapStatus, Tone> = {
  PLANNED: "purple",
  IN_PROGRESS: "blue",
  DONE: "green",
  CANCELLED: "red",
};

export const STATUS_LABEL: Record<RoadmapStatus, string> = {
  PLANNED: "Planejado",
  IN_PROGRESS: "Em execução",
  DONE: "Entregue",
  CANCELLED: "Cancelado",
};

export const LEGEND: { tone: Tone; label: string }[] = [
  { tone: "green", label: "Entregue" },
  { tone: "blue", label: "Em execução" },
  { tone: "purple", label: "Planejado" },
  { tone: "red", label: "Cancelado" },
];

// ─── PI (quarter) columns ───────────────────────────────────────────────────

export type QuarterCol = {
  year: number;
  quarter: number;
  label: string;
  key: string;
};

export function totalQuarter(date: Date): number {
  return date.getFullYear() * 4 + Math.floor(date.getMonth() / 3);
}

function colFromTotalQuarter(totalQ: number): QuarterCol {
  const year = Math.floor(totalQ / 4);
  const quarter = ((totalQ % 4) + 4) % 4;
  return {
    year,
    quarter,
    label: `${year}-Q${quarter + 1}`,
    key: `${year}-${quarter}`,
  };
}

export function buildQuarterColumns(items: RoadmapItemWithRelations[]): QuarterCol[] {
  if (items.length === 0) {
    const start = totalQuarter(new Date());
    return Array.from({ length: 4 }, (_, i) => colFromTotalQuarter(start + i));
  }

  const startQ = Math.min(
    ...items.map((i) => totalQuarter(new Date(i.startDate)))
  );
  const endQ = Math.max(...items.map((i) => totalQuarter(new Date(i.endDate))));

  const cols: QuarterCol[] = [];
  for (let q = startQ; q <= endQ; q++) {
    cols.push(colFromTotalQuarter(q));
  }
  return cols;
}

/**
 * Fixed Multi-PI window (screen-roadmap.jsx contract): always exactly
 * `count` PI columns anchored one quarter before today, so "today" always
 * falls inside the window (index 1 of 4 by default) regardless of data.
 */
export function buildFixedQuarterColumns(count = 4): QuarterCol[] {
  const start = totalQuarter(new Date()) - 1;
  return Array.from({ length: count }, (_, i) => colFromTotalQuarter(start + i));
}

/** [startColIndex, endColIndex] (inclusive) for an item's overlap with the PI columns. */
export function getItemQuarterSpan(
  item: RoadmapItemWithRelations,
  cols: QuarterCol[]
): { startIdx: number; endIdx: number } | null {
  const startQ = totalQuarter(new Date(item.startDate));
  const endQ = totalQuarter(new Date(item.endDate));

  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < cols.length; i++) {
    const colQ = cols[i].year * 4 + cols[i].quarter;
    if (startQ <= colQ && endQ >= colQ) {
      if (startIdx === -1) {
        startIdx = i;
      }
      endIdx = i;
    }
  }
  return startIdx === -1 ? null : { startIdx, endIdx };
}

// ─── ART lanes ──────────────────────────────────────────────────────────────

export type Lane = {
  key: string;
  label: string;
  tone: Tone;
  items: RoadmapItemWithRelations[];
};

export function buildLanes(
  items: RoadmapItemWithRelations[],
  artMap: Map<string, string>
): Lane[] {
  const groups = new Map<string, RoadmapItemWithRelations[]>();
  for (const item of items) {
    const key = item.artId ?? "__unassigned__";
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const keys = [...groups.keys()].sort((a, b) => {
    if (a === "__unassigned__") {
      return 1;
    }
    if (b === "__unassigned__") {
      return -1;
    }
    return (artMap.get(a) ?? "").localeCompare(artMap.get(b) ?? "");
  });

  return keys.map((key, idx) => {
    const label = key === "__unassigned__" ? "Sem ART" : (artMap.get(key) ?? key);
    return {
      key,
      label,
      tone: KNOWN_ART_TONE[label] ?? LANE_TONE_CYCLE[idx % LANE_TONE_CYCLE.length],
      items: groups.get(key) ?? [],
    };
  });
}
