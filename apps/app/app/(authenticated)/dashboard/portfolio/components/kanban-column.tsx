"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@repo/design-system/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { type CardDisplayCfg, DEFAULT_CARD_CFG } from "./card-config-panel";
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
  cfg?: CardDisplayCfg;
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
  cfg = DEFAULT_CARD_CFG,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isCollapsed = epics.length === 0 && !isOver;

  return (
    <motion.div
      animate={{ width: isCollapsed ? 48 : 272 }}
      className={cn(
        "flex h-full flex-shrink-0 flex-col overflow-hidden rounded-[10px] border transition-colors duration-150 ease-out",
        "border-hairline bg-surface shadow-[var(--card-shadow)]",
        isOver === true ? "border-primary/30 bg-primary/[0.03]" : ""
      )}
      ref={setNodeRef}
      style={{ borderTop: `3px solid ${color}` }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <AnimatePresence mode="wait">
        {isCollapsed ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-start gap-3 py-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="collapsed"
            transition={{ duration: 0.15, delay: 0.1 }}
          >
            <span
              aria-hidden
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span
              className="flex-1 font-semibold text-[11px] text-muted-foreground tracking-wider"
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
            {onQuickAdd !== undefined && (
              <button
                aria-label={`Adicionar épico em ${label}`}
                className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                onClick={onQuickAdd}
                type="button"
              >
                <span aria-hidden className="text-[14px] leading-none">
                  +
                </span>
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="expanded"
            transition={{ duration: 0.15 }}
          >
            <div className="flex-shrink-0 border-hairline border-b bg-surface-2 px-[14px] pt-[11px] pb-[10px]">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 truncate font-semibold text-[12.5px] text-foreground tracking-[-0.01em]">
                  {label}
                </span>
                <span
                  className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 font-mono font-semibold text-[10px]"
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--ink-muted)",
                  }}
                >
                  {epics.length}
                </span>
                {wipLimit !== undefined && (
                  <WipLimitWarning count={epics.length} limit={wipLimit} />
                )}
                <div className="flex items-center gap-0.5">
                  {onQuickAdd !== undefined && (
                    <button
                      aria-label={`Adicionar épico em ${label}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
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
              {wipLimit !== undefined && wipLimit > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, (epics.length / wipLimit) * 100)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <span
                    className="flex-shrink-0 font-mono text-[10px]"
                    style={{ color: "var(--ink-muted)" }}
                  >
                    {epics.length}/{wipLimit}
                  </span>
                </div>
              )}
            </div>

            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-[10px]",
                isOver === true ? "rounded-md" : ""
              )}
            >
              {epics.map((epic) => (
                <KanbanCard
                  cfg={cfg}
                  epic={epic}
                  key={epic.id}
                  onOpenDrawer={onOpenDrawer}
                />
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
    prev.cfg === next.cfg &&
    columnEpicsSignature(prev.epics) === columnEpicsSignature(next.epics)
);
