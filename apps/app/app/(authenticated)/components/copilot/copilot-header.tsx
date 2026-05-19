"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Bot, Sparkles, X } from "lucide-react";
import type { CopilotMode, CopilotSurface } from "./copilot-provider";

const MODE_LABELS: Record<CopilotMode, string> = {
  rte: "RTE Copilot",
  lpm: "LPM Copilot",
  pm: "PM/PO Copilot",
  team: "Team Copilot",
  spc: "SPC Copilot",
  global: "Cosmos Copilot",
};

const SURFACE_LABELS: Record<CopilotSurface, string> = {
  pi_workspace: "PI Workspace",
  portfolio_dashboard: "Portfolio",
  flow_dashboard: "Flow Metrics",
  lean_budget: "Lean Budget",
  risk_board: "Risk Board",
  global: "Global",
};

type CopilotHeaderProps = {
  mode: CopilotMode;
  surface: CopilotSurface;
  onClose: () => void;
};

export function CopilotHeader({ mode, surface, onClose }: CopilotHeaderProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-between border-white/[0.08] border-b px-4 py-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(124,108,255,0.10) 0%, rgba(0,212,255,0.05) 100%)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, #7c6cff 0%, #00D4FF 100%)",
          }}
        >
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-white leading-tight">
            {MODE_LABELS[mode]}
          </span>
          {surface !== "global" && (
            <span className="text-[11px] text-zinc-500">
              {SURFACE_LABELS[surface]}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 font-semibold text-[10px] text-cyan-400 uppercase tracking-wider">
          <Sparkles className="h-2.5 w-2.5" />
          AI
        </span>
        <Button
          className="h-7 w-7 text-zinc-500 hover:text-white"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
