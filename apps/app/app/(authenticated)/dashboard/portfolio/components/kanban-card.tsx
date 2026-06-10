"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "@repo/design-system/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";
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

function epicVisualEqual(a: PortfolioEpic, b: PortfolioEpic): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.wsjfScore === b.wsjfScore &&
    a.featureCount === b.featureCount &&
    a.investScore === b.investScore &&
    a.governanceStatus === b.governanceStatus &&
    a.linkedOKRCount === b.linkedOKRCount &&
    a.themeColor === b.themeColor
  );
}

export const KanbanCard = memo(
  function KanbanCard({ epic, isDragging, onOpenDrawer }: KanbanCardProps) {
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
      transform,
    } = useDraggable({ id: epic.id });

    const style = transform
      ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
      : undefined;

    const isWarn = epic.investScore !== null && epic.investScore < 50;
    const isBlocked = epic.governanceStatus === "BLOCKED";
    const showExpand = hovered || focused;

    return (
      <div
        className={cn(
          "group select-none overflow-hidden rounded-lg border border-hairline bg-card",
          "shadow-[var(--card-shadow)] transition-all duration-200 ease-out",
          "hover:-translate-y-[2px] hover:border-hairline-strong hover:shadow-[var(--hover-shadow)]",
          "dark:bg-[var(--surface-3)]",
          isDragging === true && "rotate-1 opacity-50 shadow-lg",
          isWarn &&
            !isBlocked &&
            "border-amber-400/40 dark:border-amber-500/30",
          isBlocked && "cosmos-blocked"
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
          {/* Top color strip — theme color or accent on drag/hover */}
          <div
            className="h-[3px] w-full transition-colors duration-200"
            style={{
              backgroundColor: isDragging
                ? "var(--accent-c)"
                : hovered && epic.themeColor
                  ? `${epic.themeColor}60`
                  : hovered
                    ? "rgba(var(--accent-rgb),.25)"
                    : epic.themeColor
                      ? `${epic.themeColor}25`
                      : "transparent",
            }}
          />

          {/* Body */}
          <div className="px-3 pt-2.5 pb-2">
            {/* Title */}
            <button
              aria-label={`Abrir ${epic.title} no drawer`}
              className="line-clamp-2 w-full text-left font-medium text-[13px] text-foreground leading-[1.45] tracking-[-0.01em] transition-colors hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDrawer?.(epic.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              type="button"
            >
              {epic.title}
            </button>

            {/* Badges */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {!!epic.themeColor && (
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[10px]"
                  style={{
                    backgroundColor: `${epic.themeColor}18`,
                    color: epic.themeColor,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: epic.themeColor }}
                  />
                  {epic.epicType !== "EPIC" ? epic.epicType : "Épico"}
                </span>
              )}

              {epic.wsjfScore > 0 && (
                <span className="rounded border border-border/50 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:border-[rgba(251,191,36,.15)] dark:bg-[var(--amber-soft)] dark:text-[var(--amber-text)]">
                  WSJF {epic.wsjfScore.toFixed(1)}
                </span>
              )}

              {isBlocked && (
                <span
                  className="rounded px-1.5 py-0.5 font-semibold text-[9px]"
                  style={{
                    backgroundColor: "var(--red-soft, rgba(251,113,133,0.12))",
                    color: "var(--red-text, rgb(220,38,38))",
                  }}
                >
                  ⚠ BLOCKED
                </span>
              )}
            </div>

            {/* INVEST bar — revealed on hover */}
            {epic.investScore !== null && (
              <InvestScoreBar className="mt-2.5" score={epic.investScore} />
            )}

            {/* BV/TC/RR/JS breakdown — revealed on hover */}
            <AnimatePresence>
              {showExpand && epic.wsjfScore > 0 ? (
                <motion.div
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                  exit={{ opacity: 0, height: 0 }}
                  initial={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <div className="mt-2 grid grid-cols-4 gap-1 border-border/40 border-t pt-2">
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
                        <div className="font-mono font-semibold text-[11px]">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-border/30 border-t bg-muted/20 px-3 py-1.5 dark:bg-black/15">
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {epic.featureCount} feature{epic.featureCount !== 1 ? "s" : ""}
            {epic.linkedOKRCount > 0
              ? ` · ${epic.linkedOKRCount} OKR${epic.linkedOKRCount > 1 ? "s" : ""}`
              : ""}
          </span>
          <Link
            aria-label={`Ver épico ${epic.title}`}
            className="text-muted-foreground/30 transition-colors hover:text-primary"
            href={`/epics/${epic.id}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            prefetch={false}
          >
            <ExternalLink aria-hidden className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.isDragging === next.isDragging && epicVisualEqual(prev.epic, next.epic)
);
