"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EpicNode } from "@/app/actions/strategy-map";

// ─── Constants ──────────────────────────────────────────────────────────────

const EPIC_STATUS_COLORS: Record<string, string> = {
  BACKLOG: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ACTIVE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  DONE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

// ─── Component ──────────────────────────────────────────────────────────────
// Re-skin of prototype's `.smap-epic` card (screens-analytics.js:152). The
// whole card cross-navigates to Epic detail (`go('epic/${id}')` in the
// prototype); the `✕` unlinks the epic from this theme and is only revealed
// on hover, matching `.smap-rm { opacity:0 } .smap-epic:hover .smap-rm`.

type EpicChipProps = {
  epic: EpicNode;
  onRemove: () => void;
};

export function EpicChip({ epic, onRemove }: EpicChipProps) {
  const router = useRouter();
  const statusClass =
    EPIC_STATUS_COLORS[epic.statusId] ?? EPIC_STATUS_COLORS.BACKLOG;

  function goToEpic() {
    router.push(`/portfolio/${epic.id}`);
  }

  return (
    <div className="group/epic hover:-translate-y-0.5 relative flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-left transition-all duration-150 hover:border-[rgba(var(--accent-rgb),.5)] hover:shadow-sm">
      <button
        aria-label="Remover do tema"
        className="absolute top-2 right-2 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-rose-500 group-hover/epic:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        title="Remover do tema"
        type="button"
      >
        <XIcon className="h-3 w-3" />
      </button>
      <div
        className="flex cursor-pointer flex-col gap-1.5"
        onClick={goToEpic}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            goToEpic();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-1.5 pr-5">
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {epic.id.slice(0, 8)}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-semibold text-[10px] ${statusClass}`}
          >
            {epic.statusId}
          </span>
        </div>
        <div className="truncate font-medium text-sm">{epic.title}</div>
        {epic.okrs.length > 0 && (
          <div className="font-mono text-[10px] text-muted-foreground">
            {epic.okrs.length} OKR{epic.okrs.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
