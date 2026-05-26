"use client";

import { useState } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Progress } from "@repo/design-system/components/ui/progress";
import { Button } from "@repo/design-system/components/ui/button";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { OKRCardV2 } from "./okr-card-v2";
import type { OKRWithContext } from "@/app/actions/okrs";

type OKRStatus = "ON_TRACK" | "AT_RISK" | "BEHIND" | "ACHIEVED";

type KeyResultSnapshotItem = {
  id: string;
  keyResultId: string;
  value: number;
  note: string | null;
  recordedAt: Date;
};

type KeyResultWithProgress = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  metric?: string | null;
  baseline?: number | null;
  measurementType?: string | null;
  dataSource?: string | null;
  dueDate?: Date | null;
  progress: number;
  snapshots?: KeyResultSnapshotItem[];
};


const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  portfolio_theme: { label: "Tema", icon: "🎯" },
  portfolio_epic: { label: "Épico", icon: "🏔" },
  pi_art: { label: "PI / ART", icon: "🔄" },
  team_pi: { label: "Time / PI", icon: "👥" },
  improvement: { label: "Melhoria", icon: "⬆" },
};

const TYPE_ORDER = [
  "portfolio_theme",
  "portfolio_epic",
  "pi_art",
  "team_pi",
  "improvement",
] as const;

function averageProgress(okrs: OKRWithContext[]): number {
  if (okrs.length === 0) return 0;
  const total = okrs.reduce((sum, o) => sum + o.progress, 0);
  return Math.round(total / okrs.length);
}

interface OKRGroupHeaderProps {
  type: string;
  okrs: OKRWithContext[];
  expanded: boolean;
  onToggle: () => void;
}

function OKRGroupHeader({ type, okrs, expanded, onToggle }: OKRGroupHeaderProps) {
  const cfg = TYPE_CONFIG[type];
  const avg = averageProgress(okrs);
  const count = okrs.length;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
    >
      <span className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </span>

      <span className="text-sm font-semibold text-foreground">
        {cfg?.label ?? type}
      </span>

      <Badge variant="secondary" className="text-xs shrink-0">
        {count} objetivo{count !== 1 ? "s" : ""}
      </Badge>

      <div className="flex items-center gap-2 ml-auto">
        <Progress value={avg} className="h-1.5 w-24 shrink-0" />
        <span className="text-xs font-semibold tabular-nums text-muted-foreground w-8 text-right shrink-0">
          {avg}%
        </span>
      </div>
    </button>
  );
}

interface OKRTreeViewProps {
  okrs: OKRWithContext[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: OKRStatus) => void;
  onAddKeyResult: (okrId: string, kr: KeyResultWithProgress) => void;
  onDeleteKeyResult: (okrId: string, krId: string) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
  onOpenDetail: (okr: OKRWithContext) => void;
  onCheckIn: (okr: OKRWithContext) => void;
}

export function OKRTreeView({
  okrs,
  onDelete,
  onStatusChange,
  onAddKeyResult,
  onDeleteKeyResult,
  onUpdateKRCurrent,
  onOpenDetail,
  onCheckIn,
}: OKRTreeViewProps) {
  // Group OKRs by type
  const grouped = TYPE_ORDER.reduce<Record<string, OKRWithContext[]>>(
    (acc, type) => {
      const group = okrs.filter((o) => o.type === type);
      if (group.length > 0) {
        acc[type] = group;
      }
      return acc;
    },
    {}
  );

  // Also capture OKRs with unknown types not in TYPE_ORDER
  const knownTypes = new Set(TYPE_ORDER as readonly string[]);
  const unknownOkrs = okrs.filter((o) => !knownTypes.has(o.type));

  const allGroups = [
    ...TYPE_ORDER.filter((t) => grouped[t]),
    ...(unknownOkrs.length > 0 ? (["__other__"] as string[]) : []),
  ];

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(allGroups)
  );

  function toggleGroup(type: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  if (okrs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">
          Nenhum OKR encontrado. Crie seu primeiro objetivo para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {TYPE_ORDER.filter((type) => grouped[type]).map((type) => {
        const group = grouped[type];
        const isExpanded = expandedGroups.has(type);

        return (
          <div key={type} className="rounded-xl border border-border/60 overflow-hidden">
            <OKRGroupHeader
              type={type}
              okrs={group}
              expanded={isExpanded}
              onToggle={() => toggleGroup(type)}
            />
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2 bg-muted/10">
                {group.map((okr) => (
                  <OKRCardV2
                    key={okr.id}
                    okr={okr}
                    compact
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    onAddKeyResult={onAddKeyResult}
                    onDeleteKeyResult={onDeleteKeyResult}
                    onUpdateKRCurrent={onUpdateKRCurrent}
                    onOpenDetail={onOpenDetail}
                    onCheckIn={onCheckIn}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {unknownOkrs.length > 0 && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <OKRGroupHeader
            type="__other__"
            okrs={unknownOkrs}
            expanded={expandedGroups.has("__other__")}
            onToggle={() => toggleGroup("__other__")}
          />
          {expandedGroups.has("__other__") && (
            <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2 bg-muted/10">
              {unknownOkrs.map((okr) => (
                <OKRCardV2
                  key={okr.id}
                  okr={okr}
                  compact
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                  onAddKeyResult={onAddKeyResult}
                  onDeleteKeyResult={onDeleteKeyResult}
                  onUpdateKRCurrent={onUpdateKRCurrent}
                  onOpenDetail={onOpenDetail}
                  onCheckIn={onCheckIn}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
