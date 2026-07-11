"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { GaugeIcon, TrendingUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type {
  EpicWithFeatures,
  FeatureWSJF,
  WSJFConfig,
} from "@/app/actions/wsjf/schema";
import { ScorePicker } from "./score-picker";
import type { WSJFWeights } from "./rebalance-weights-dialog";

// ─── WSJF ranking table (screenWsjf, screens-portfolio.js:9) ──────────────
// Flat, sortable list of every feature ranked by (BV+TC+RR)/JS — one row per
// feature since that's where the real WSJF components live in this data model
// (the prototype scores at epic level; here epics only carry the aggregate).

type SortKey = "id" | "art" | "bv" | "tc" | "rr" | "js" | "wsjf";
type SortState = { key: SortKey; dir: 1 | -1 };

type WsjfRow = {
  feature: FeatureWSJF;
  epic: EpicWithFeatures;
  score: number;
};

type WsjfPriorityTableProps = {
  epics: EpicWithFeatures[];
  hasAnyFeatures: boolean;
  weights: WSJFWeights;
  weightsActive: boolean;
  scale: number[];
  labels: WSJFConfig["labels"];
  isPending: boolean;
  onUpdateFeature: (
    epicId: string,
    featureId: string,
    field: "bv" | "tc" | "rr" | "js",
    value: number
  ) => void;
  onOpenRebalance: () => void;
};

function costOfDelay(feature: FeatureWSJF, weights: WSJFWeights): number {
  return feature.bv * weights.bv + feature.tc * weights.tc + feature.rr * weights.rr;
}

function effectiveScore(feature: FeatureWSJF, weights: WSJFWeights): number {
  const js = feature.js > 0 ? feature.js : 1;
  const cod = costOfDelay(feature, weights);
  return Math.round((cod / js) * 100) / 100;
}

function RankBadge({ rank }: { rank: number }) {
  const isTop = rank === 1;
  return (
    <span
      className="inline-grid h-[22px] w-[22px] place-items-center rounded-md font-bold font-mono text-[11px]"
      style={
        isTop
          ? {
              background: "var(--accent-soft)",
              color: "var(--accent-text)",
              border: "1px solid rgba(var(--accent-rgb),.3)",
            }
          : { background: "var(--surface-3)", color: "var(--ink-muted)" }
      }
    >
      {rank}
    </span>
  );
}

function SortCaret({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) {
    return null;
  }
  return (
    <span className="ml-1 inline-block text-[9px]">{dir > 0 ? "▲" : "▼"}</span>
  );
}

type ThProps = {
  sortKey: SortKey | null;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  children: React.ReactNode;
};

function Th({ sortKey, sort, onSort, align = "left", children }: ThProps) {
  const active = sortKey !== null && sort.key === sortKey;
  const alignClass = align === "right" ? "text-right" : "text-left";
  if (sortKey === null) {
    return (
      <th
        className={`px-3 py-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider ${alignClass}`}
      >
        {children}
      </th>
    );
  }
  return (
    <th
      className={`cursor-pointer select-none px-3 py-2.5 font-medium text-[10px] uppercase tracking-wider transition-colors ${alignClass} ${
        active ? "text-[var(--accent-text)]" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={() => onSort(sortKey)}
    >
      {children}
      <SortCaret active={active} dir={sort.dir} />
    </th>
  );
}

export function WsjfPriorityTable({
  epics,
  hasAnyFeatures,
  weights,
  weightsActive,
  scale,
  labels,
  isPending,
  onUpdateFeature,
  onOpenRebalance,
}: WsjfPriorityTableProps) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>({ key: "wsjf", dir: -1 });

  const rows = useMemo<WsjfRow[]>(
    () =>
      epics.flatMap((epic) =>
        epic.features.map((feature) => ({
          feature,
          epic,
          score: effectiveScore(feature, weights),
        }))
      ),
    [epics, weights]
  );

  const maxScore = useMemo(
    () => Math.max(1, ...rows.map((row) => row.score)),
    [rows]
  );

  const sortedRows = useMemo(() => {
    const list = [...rows];
    const { key, dir } = sort;
    list.sort((a, b) => {
      if (key === "wsjf") {
        return (a.score - b.score) * dir;
      }
      if (key === "id") {
        return a.feature.id < b.feature.id ? -dir : a.feature.id > b.feature.id ? dir : 0;
      }
      if (key === "art") {
        const av = a.epic.themeTitle ?? "";
        const bv = b.epic.themeTitle ?? "";
        return av < bv ? -dir : av > bv ? dir : 0;
      }
      return (a.feature[key] - b.feature[key]) * dir;
    });
    return list;
  }, [rows, sort]);

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: (prev.dir * -1) as 1 | -1 }
        : { key, dir: key === "id" ? 1 : -1 }
    );
  };

  const subtitle = weightsActive
    ? `CoD (BV+TC+RR) ÷ Job Size · pesos BV×${weights.bv} TC×${weights.tc} RR×${weights.rr}`
    : "CoD (BV+TC+RR) ÷ Job Size";

  return (
    <SectionCard
      accentRgb="0,212,255"
      actions={
        <Button
          className="gap-1.5 text-xs"
          onClick={onOpenRebalance}
          size="sm"
          variant="outline"
        >
          <GaugeIcon className="h-3.5 w-3.5" />
          Rebalance
        </Button>
      }
      icon={TrendingUpIcon}
      noPadding
      subtitle={subtitle}
      title="Ranking WSJF"
    >
      {sortedRows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">
            {hasAnyFeatures
              ? "Nenhuma feature para o tema selecionado."
              : "Nenhuma feature encontrada. Adicione features aos épicos no Portfolio Kanban para começar a priorizar."}
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-border border-b bg-muted/40">
                <Th onSort={handleSort} sort={sort} sortKey={null}>
                  #
                </Th>
                <Th onSort={handleSort} sort={sort} sortKey="id">
                  Feature
                </Th>
                <Th onSort={handleSort} sort={sort} sortKey={null}>
                  Título
                </Th>
                <Th onSort={handleSort} sort={sort} sortKey="art">
                  Tema
                </Th>
                <Th align="right" onSort={handleSort} sort={sort} sortKey="bv">
                  {labels.bv}
                </Th>
                <Th align="right" onSort={handleSort} sort={sort} sortKey="tc">
                  {labels.tc}
                </Th>
                <Th align="right" onSort={handleSort} sort={sort} sortKey="rr">
                  {labels.rr}
                </Th>
                <Th align="right" onSort={handleSort} sort={sort} sortKey={null}>
                  CoD
                </Th>
                <Th align="right" onSort={handleSort} sort={sort} sortKey="js">
                  {labels.js}
                </Th>
                <Th align="right" onSort={handleSort} sort={sort} sortKey="wsjf">
                  WSJF
                </Th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr
                  className="cursor-pointer border-border/50 border-b transition-colors last:border-0 hover:bg-muted/30"
                  key={row.feature.id}
                  onClick={() => router.push(`/epics/${row.epic.id}`)}
                >
                  <td className="py-2.5 pr-2 pl-3">
                    <RankBadge rank={i + 1} />
                  </td>
                  <td className="py-2.5 pr-4 pl-2 font-mono text-[11px] text-muted-foreground">
                    FT-{row.feature.id.slice(-4).toUpperCase()}
                  </td>
                  <td className="py-2.5 pr-4 pl-2 font-medium text-sm">
                    {row.feature.title}
                  </td>
                  <td className="py-2.5 pr-4 pl-2">
                    {row.epic.themeTitle ? (
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]"
                        style={
                          row.epic.themeColor
                            ? {
                                background: `${row.epic.themeColor}18`,
                                borderColor: `${row.epic.themeColor}55`,
                                color: row.epic.themeColor,
                              }
                            : {}
                        }
                      >
                        {row.epic.themeTitle}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  {(["bv", "tc", "rr"] as const).map((field) => (
                    <td
                      className="py-2.5 pr-4 pl-2 text-right"
                      key={field}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ScorePicker
                        disabled={isPending}
                        label={labels[field]}
                        onSelect={(v) => onUpdateFeature(row.epic.id, row.feature.id, field, v)}
                        scale={scale}
                        value={row.feature[field]}
                      />
                    </td>
                  ))}
                  <td className="py-2.5 pr-4 pl-2 text-right font-mono text-muted-foreground text-xs">
                    {costOfDelay(row.feature, weights).toFixed(0)}
                  </td>
                  <td
                    className="py-2.5 pr-4 pl-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ScorePicker
                      disabled={isPending}
                      label={labels.js}
                      onSelect={(v) => onUpdateFeature(row.epic.id, row.feature.id, "js", v)}
                      scale={scale}
                      value={row.feature.js}
                    />
                  </td>
                  <td className="py-2.5 pr-4 pl-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className="font-bold font-mono text-[14px]"
                        style={{ color: "var(--accent-text)" }}
                      >
                        {row.score.toFixed(1)}
                      </span>
                      <div
                        className="h-1 w-16 overflow-hidden rounded-full"
                        style={{ background: "var(--hairline)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            background: "var(--accent-c)",
                            width: `${Math.min(100, (row.score / maxScore) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
