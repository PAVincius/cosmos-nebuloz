"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ToolInvocation } from "./copilot-types";

type Props = { invocation: ToolInvocation };

const TOOL_LABELS: Record<string, string> = {
  queryARTs: "Consultando ARTs",
  queryTeams: "Consultando Times",
  queryEpics: "Consultando Épicos",
  queryOKRs: "Consultando OKRs",
  queryFlowMetrics: "Analisando Flow Metrics",
  queryLeanBudget: "Verificando Budget",
  queryProgramBoard: "Consultando Program Board",
  queryRiskVectors: "Analisando Riscos",
  searchKnowledge: "Pesquisando Base de Conhecimento",
  createFeature: "Criando Feature",
  moveFeature: "Movendo Feature",
};

export function CopilotToolCallStep({ invocation }: Props) {
  const [open, setOpen] = useState(false);

  const dotClass =
    invocation.state === "result"
      ? "bg-green-400"
      : "bg-blue-400 animate-pulse";

  return (
    <div>
      <button
        className="flex w-full cursor-pointer items-center gap-2 py-1 text-left hover:opacity-80"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        <span className="font-medium text-muted-foreground text-xs">
          {TOOL_LABELS[invocation.toolName] ?? invocation.toolName}
        </span>
        {invocation.state === "result" && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400">
            concluído
          </span>
        )}
        <ChevronDown
          className="h-3 w-3 text-muted-foreground transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      <AnimatePresence initial={false}>
        {!!open && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden pl-4"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
          >
            <pre className="overflow-x-auto font-mono text-[11px] text-muted-foreground">
              {JSON.stringify(invocation.args, null, 2)}
            </pre>
            {invocation.state === "result" && (
              <>
                <hr className="my-1 border-border/30" />
                <pre className="overflow-x-auto font-mono text-[11px] text-foreground">
                  {JSON.stringify(invocation.result, null, 2)}
                </pre>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
