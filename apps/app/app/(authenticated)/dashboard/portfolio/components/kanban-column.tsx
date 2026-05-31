"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@repo/design-system/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { ColumnSettings } from "./column-settings";
import { KanbanCard } from "./kanban-card";
import { WipLimitWarning } from "./wip-limit-warning";

type KanbanColumnProps = {
  id: string;
  label: string;
  color: string;
  epics: PortfolioEpic[];
  canConfigure: boolean;
  onOpenDrawer?: (epicId: string) => void;
  onQuickAdd?: () => void;
  wipLimit?: number;
};

function columnEpicsSignature(epics: PortfolioEpic[]): string {
  return epics
    .map((e) => `${e.id}:${e.order}:${e.wsjfScore}:${e.featureCount}`)
    .join("|");
}

function KanbanColumnInner({
  id,
  label,
  color,
  epics,
  canConfigure,
  onOpenDrawer,
  onQuickAdd,
  wipLimit,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={cn(
        "flex min-h-[480px] w-64 shrink-0 flex-col rounded-lg border border-border/70 bg-muted/20 transition-all duration-300 ease-out",
        "border-l-2",
        isOver === true && "border-primary/20 bg-primary/[0.06]"
      )}
      ref={setNodeRef}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center justify-between border-border/60 border-b px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
            {epics.length}
          </span>
          {wipLimit !== undefined && (
            <WipLimitWarning count={epics.length} limit={wipLimit} />
          )}
          {onQuickAdd !== undefined && (
            <button
              aria-label={`Adicionar épico em ${label}`}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={onQuickAdd}
              type="button"
            >
              <span aria-hidden className="text-[14px] leading-none">
                +
              </span>
            </button>
          )}
          {canConfigure === true && (
            <ColumnSettings color={color} columnId={id} label={label} />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {epics.map((epic) => (
          <KanbanCard epic={epic} key={epic.id} onOpenDrawer={onOpenDrawer} />
        ))}

        <AnimatePresence>
          {isOver === true && epics.length === 0 ? (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-20 items-center justify-center rounded-md border border-primary/30 border-dashed"
              exit={{ opacity: 0, scale: 0.96 }}
              initial={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <span className="font-mono text-[11px] text-muted-foreground">
                drop here
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const KanbanColumn = memo(
  KanbanColumnInner,
  (prev, next) =>
    prev.id === next.id &&
    prev.label === next.label &&
    prev.color === next.color &&
    prev.canConfigure === next.canConfigure &&
    prev.wipLimit === next.wipLimit &&
    prev.onQuickAdd === next.onQuickAdd &&
    columnEpicsSignature(prev.epics) === columnEpicsSignature(next.epics)
);
