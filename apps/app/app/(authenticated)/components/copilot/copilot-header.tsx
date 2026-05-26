"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Bot, Maximize2, X } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  return (
    <div
      className="flex shrink-0 items-center justify-between border-black/[0.08] border-b px-4 py-3 dark:border-white/[0.08]"
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
          <span className="font-semibold text-gray-900 text-sm leading-tight dark:text-white">
            {MODE_LABELS[mode]}
          </span>
          {surface !== "global" && (
            <span className="text-[11px] text-gray-500 dark:text-zinc-500">
              {SURFACE_LABELS[surface]}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          className="h-7 w-7 text-gray-400 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-white"
          onClick={() => router.push("/copilot")}
          size="icon"
          title="Abrir em tela cheia"
          variant="ghost"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          className="h-7 w-7 text-gray-400 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-white"
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
