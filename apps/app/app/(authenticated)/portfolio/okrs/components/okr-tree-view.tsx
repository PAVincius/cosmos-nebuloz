"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Progress } from "@repo/design-system/components/ui/progress";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import type {
  KeyResultWithProgress,
  OKRWithContext,
} from "@/app/actions/okrs/schema";
import { OKRCardV2 } from "./okr-card-v2";

type OKRStatus = "ON_TRACK" | "AT_RISK" | "BEHIND" | "ACHIEVED";

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
  if (okrs.length === 0) {
    return 0;
  }
  const total = okrs.reduce((sum, o) => sum + o.progress, 0);
  return Math.round(total / okrs.length);
}

type OKRGroupHeaderProps = {
  type: string;
  okrs: OKRWithContext[];
  expanded: boolean;
  onToggle: () => void;
};

function OKRGroupHeader({
  type,
  okrs,
  expanded,
  onToggle,
}: OKRGroupHeaderProps) {
  const cfg = TYPE_CONFIG[type];
  const avg = averageProgress(okrs);
  const count = okrs.length;

  return (
    <button
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
      onClick={onToggle}
      type="button"
    >
      <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </span>

      <span className="font-semibold text-foreground text-sm">
        {cfg?.label ?? type}
      </span>

      <Badge className="shrink-0 text-xs" variant="secondary">
        {count} objetivo{count !== 1 ? "s" : ""}
      </Badge>

      <div className="ml-auto flex items-center gap-2">
        <Progress className="h-1.5 w-24 shrink-0" value={avg} />
        <span className="w-8 shrink-0 text-right font-semibold text-muted-foreground text-xs tabular-nums">
          {avg}%
        </span>
      </div>
    </button>
  );
}

type OKRTreeViewProps = {
  okrs: OKRWithContext[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: OKRStatus) => void;
  onAddKeyResult: (okrId: string, kr: KeyResultWithProgress) => void;
  onDeleteKeyResult: (okrId: string, krId: string) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
  onOpenDetail: (okr: OKRWithContext) => void;
  onCheckIn: (okr: OKRWithContext) => void;
};

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
          <div
            className="overflow-hidden rounded-xl border border-border/60"
            key={type}
          >
            <OKRGroupHeader
              expanded={isExpanded}
              okrs={group}
              onToggle={() => toggleGroup(type)}
              type={type}
            />
            {isExpanded && (
              <div className="space-y-2 border-border/40 border-t bg-muted/10 px-3 pt-2 pb-3">
                {group.map((okr) => (
                  <OKRCardV2
                    compact
                    key={okr.id}
                    okr={okr}
                    onAddKeyResult={onAddKeyResult}
                    onCheckIn={onCheckIn}
                    onDelete={onDelete}
                    onDeleteKeyResult={onDeleteKeyResult}
                    onOpenDetail={onOpenDetail}
                    onStatusChange={onStatusChange}
                    onUpdateKRCurrent={onUpdateKRCurrent}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {unknownOkrs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <OKRGroupHeader
            expanded={expandedGroups.has("__other__")}
            okrs={unknownOkrs}
            onToggle={() => toggleGroup("__other__")}
            type="__other__"
          />
          {expandedGroups.has("__other__") && (
            <div className="space-y-2 border-border/40 border-t bg-muted/10 px-3 pt-2 pb-3">
              {unknownOkrs.map((okr) => (
                <OKRCardV2
                  compact
                  key={okr.id}
                  okr={okr}
                  onAddKeyResult={onAddKeyResult}
                  onCheckIn={onCheckIn}
                  onDelete={onDelete}
                  onDeleteKeyResult={onDeleteKeyResult}
                  onOpenDetail={onOpenDetail}
                  onStatusChange={onStatusChange}
                  onUpdateKRCurrent={onUpdateKRCurrent}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
