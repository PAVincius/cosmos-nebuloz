"use client";

import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@repo/design-system/lib/utils";
import { ExternalLink, GripVertical, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

type KanbanCardProps = {
  epic: PortfolioEpic;
  isDragging?: boolean;
};

function epicVisualEqual(a: PortfolioEpic, b: PortfolioEpic): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.statusId === b.statusId &&
    a.order === b.order &&
    a.wsjfScore === b.wsjfScore &&
    a.featureCount === b.featureCount &&
    a.strategicThemeId === b.strategicThemeId &&
    a.themeTitle === b.themeTitle &&
    a.themeColor === b.themeColor
  );
}

export const KanbanCard = memo(
  function KanbanCard({ epic, isDragging }: KanbanCardProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
      transform,
      isDragging: localDrag,
    } = useDraggable({ id: epic.id });

    const style = transform
      ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
      : undefined;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group flex flex-col rounded-md border border-border bg-card transition-colors duration-150",
          "hover:border-border/80",
          (localDrag || isDragging) && "opacity-50 ring-1 ring-primary/40"
        )}
      >
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="flex items-center justify-center py-1 cursor-grab active:cursor-grabbing touch-none border-b border-border/40"
          aria-label="Arrastar para mudar de coluna"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <Link
            href={`/epics/${epic.id}`}
            className="flex flex-col gap-2 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={`Abrir épico: ${epic.title}`}
            prefetch={false}
          >
            <p className="line-clamp-2 text-[13px] font-medium leading-snug tracking-[-0.01em] text-foreground">
              {epic.title}
            </p>

            {epic.themeTitle && (
              <span
                className="inline-flex items-center gap-1 self-start rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${epic.themeColor ?? "#6366f1"}22`,
                  color:           epic.themeColor ?? "#6366f1",
                }}
                title={`Tema: ${epic.themeTitle}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: epic.themeColor ?? "#6366f1" }}
                  aria-hidden
                />
                {epic.themeTitle}
              </span>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                {epic.featureCount} feat{epic.featureCount !== 1 ? "s" : ""}
              </span>

              {epic.wsjfScore > 0 && (
                <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {epic.wsjfScore.toFixed(1)}
                </span>
              )}
            </div>
          </Link>

          <div className="flex items-center justify-between gap-2 border-t border-border/40 px-3 py-1.5">
            <Link
              href={`/epics/${epic.id}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              prefetch={false}
            >
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              Épico
            </Link>
            <Link
              href={`/epics/${epic.id}/features`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              prefetch={false}
            >
              <LayoutGrid className="h-3 w-3 shrink-0" aria-hidden />
              Features
            </Link>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.isDragging === next.isDragging && epicVisualEqual(prev.epic, next.epic)
);
