"use client";

import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@repo/design-system/lib/utils";
import { memo } from "react";
import { KanbanCard } from "./kanban-card";
import { ColumnSettings } from "./column-settings";

type KanbanColumnProps = {
  id: string;
  label: string;
  color: string;
  epics: PortfolioEpic[];
  canConfigure: boolean;
};

function columnEpicsSignature(epics: PortfolioEpic[]): string {
  return epics.map((e) => `${e.id}:${e.order}:${e.wsjfScore}:${e.featureCount}`).join("|");
}

export const KanbanColumn = memo(
  function KanbanColumn({ id, label, color, epics, canConfigure }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
      <div
        className={cn(
          "flex min-h-[480px] w-64 shrink-0 flex-col rounded-lg border border-border/70 bg-muted/20 transition-colors duration-150",
          "border-l-2",
          isOver && "bg-primary/[0.03]"
        )}
        style={{ borderLeftColor: color }}
        ref={setNodeRef}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="truncate font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
              {epics.length}
            </span>
            {canConfigure && (
              <ColumnSettings columnId={id} label={label} color={color} />
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
          {epics.map((epic) => (
            <KanbanCard key={epic.id} epic={epic} />
          ))}

          {isOver && epics.length === 0 && (
            <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-primary/30">
              <span className="font-mono text-[11px] text-muted-foreground">drop here</span>
            </div>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.label === next.label &&
    prev.color === next.color &&
    prev.canConfigure === next.canConfigure &&
    columnEpicsSignature(prev.epics) === columnEpicsSignature(next.epics)
);
