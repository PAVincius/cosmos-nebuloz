"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";
import type { SessionPreview } from "@/app/actions/safe-copilot/sessions";

type SessionSidebarProps = {
  sessions: SessionPreview[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isCreating: boolean;
};

const SURFACE_LABELS: Record<string, string> = {
  pi_workspace: "PI Workspace",
  portfolio_dashboard: "Portfolio",
  flow_dashboard: "Flow",
  lean_budget: "Budget",
  risk_board: "Riscos",
  global: "Global",
};

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  isCreating,
}: SessionSidebarProps) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-black/[0.06] border-r bg-gray-50/80 dark:border-white/[0.06] dark:bg-zinc-900/60">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="font-semibold text-gray-700 text-sm dark:text-zinc-300">
          Conversas
        </span>
        <Button
          className="h-7 w-7"
          disabled={isCreating}
          onClick={onNew}
          size="icon"
          title="Nova conversa"
          variant="ghost"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 [scrollbar-width:thin]">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-center text-gray-400 text-xs dark:text-zinc-600">
            Nenhuma conversa ainda
          </p>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((s) => (
              <button
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                  s.id === activeSessionId
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                }`}
                key={s.id}
                onClick={() => onSelect(s.id)}
                type="button"
              >
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                <div className="min-w-0">
                  <p className="truncate text-xs leading-snug">{s.preview}</p>
                  <p className="mt-0.5 text-[10px] opacity-50">
                    {SURFACE_LABELS[s.surface ?? "global"] ?? s.surface}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
