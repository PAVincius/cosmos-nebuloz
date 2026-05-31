"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@repo/design-system/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";
import { InvestScoreBar } from "./invest-score-bar";

type KanbanCardProps = {
  epic: PortfolioEpic;
  isDragging?: boolean;
  onOpenDrawer?: (epicId: string) => void;
};

export function investColor(score: number | null): string {
  if (score === null) {
    return "text-muted-foreground bg-muted";
  }
  if (score >= 70) {
    return "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950";
  }
  if (score >= 50) {
    return "text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950";
  }
  return "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950";
}

export function investLabel(score: number | null): string {
  if (score === null) {
    return "INVEST?";
  }
  return `INVEST ${Math.round(score)}`;
}

export function KanbanCard({
  epic,
  isDragging,
  onOpenDrawer,
}: KanbanCardProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform } =
    useDraggable({ id: epic.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;

  return (
    <div
      className={cn(
        "group select-none rounded-lg border bg-card shadow-sm",
        "hover:-translate-y-px transition-all duration-300 ease-out hover:shadow-md",
        isDragging === true && "rotate-1 opacity-50 shadow-lg",
        epic.investScore !== null && epic.investScore < 50
          ? "border-yellow-400/60 dark:border-yellow-600/60"
          : "border-border"
      )}
      ref={setNodeRef}
      style={style}
    >
      {/* Drag handle — dnd-kit spreads role="button" + tabIndex via {...attributes} */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit attributes make this interactive */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: dnd-kit attributes make this interactive */}
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="cursor-grab touch-none active:cursor-grabbing"
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Theme color bar */}
        {!!epic.themeColor && (
          <div
            className="h-0.5 w-full rounded-t-lg"
            style={{ backgroundColor: epic.themeColor }}
          />
        )}

        <InvestScoreBar className="rounded-none" score={epic.investScore} />

        <div className="px-3 pt-2.5 pb-2">
          {/* Title — click opens drawer, drag handle wraps the rest */}
          <button
            aria-label={`Abrir ${epic.title} no drawer`}
            className="w-full text-left font-medium text-[13px] leading-snug tracking-[-0.01em] transition-colors hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrawer?.(epic.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            // Prevent the drag listeners from firing on click
            type="button"
          >
            {epic.title}
          </button>

          {/* Metadata row */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              {epic.featureCount}{" "}
              {epic.featureCount === 1 ? "feature" : "features"}
            </span>

            {!!epic.epicType && epic.epicType !== "EPIC" && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[9px] text-indigo-600 uppercase tracking-wide dark:bg-indigo-950 dark:text-indigo-400">
                {epic.epicType === "FEATURE" ? "Feature" : "Story"}
              </span>
            )}

            {epic.wsjfScore > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground">
                WSJF {epic.wsjfScore.toFixed(1)}
              </span>
            )}

            {epic.governanceStatus === "BLOCKED" && (
              <span className="font-semibold text-[9px] text-red-600">
                ⚠ BLOCKED
              </span>
            )}
          </div>

          {/* WSJF breakdown on hover or focus */}
          <AnimatePresence>
            {Boolean(hovered || focused) && epic.wsjfScore > 0 ? (
              <motion.div
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
                exit={{ opacity: 0, height: 0 }}
                initial={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <div className="mt-2 grid grid-cols-4 gap-1 border-border border-t pt-2">
                  {[
                    { label: "BV", value: epic.bv },
                    { label: "TC", value: epic.tc },
                    { label: "RR", value: epic.rr },
                    { label: "JS", value: epic.js },
                  ].map(({ label, value }) => (
                    <div className="text-center" key={label}>
                      <div className="text-[9px] text-muted-foreground">
                        {label}
                      </div>
                      <div className="font-medium font-mono text-[11px]">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* OKR indicator */}
          {epic.linkedOKRCount > 0 && (
            <div className="mt-1 text-[9px] text-indigo-500">
              ◆ {epic.linkedOKRCount} OKR{epic.linkedOKRCount > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
