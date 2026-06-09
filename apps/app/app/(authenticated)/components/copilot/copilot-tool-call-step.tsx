"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { ToolInvocation } from "./copilot-types";
import { useCopilotDrawer } from "./use-copilot-drawer";

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
  const { openDrawer } = useCopilotDrawer();

  const dotClass =
    invocation.state === "result"
      ? "bg-green-400"
      : "bg-blue-400 animate-pulse";

  const handleOpenDrawer = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDrawer({
      title: TOOL_LABELS[invocation.toolName] ?? invocation.toolName,
      renderContent: () => (
        <div className="space-y-3">
          <div>
            <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Parâmetros
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-[11px]">
              {JSON.stringify(invocation.args, null, 2)}
            </pre>
          </div>
          {invocation.state === "result" ? (
            <div>
              <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Resultado
              </p>
              <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-[11px]">
                {JSON.stringify(invocation.result, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ),
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 py-1">
        <button
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left hover:opacity-80"
          onClick={() => setOpen((prev) => !prev)}
          type="button"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <span className="font-medium text-muted-foreground text-xs">
            {TOOL_LABELS[invocation.toolName] ?? invocation.toolName}
          </span>
          {invocation.state === "result" ? (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400">
              concluído
            </span>
          ) : null}
          <ChevronDown
            className="ml-auto h-3 w-3 text-muted-foreground transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
        {invocation.state === "result" ? (
          <button
            className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            onClick={handleOpenDrawer}
            title="Ver detalhes"
            type="button"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        ) : null}
      </div>
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
            {invocation.state === "result" ? (
              <>
                <hr className="my-1 border-border/30" />
                <pre className="overflow-x-auto font-mono text-[11px] text-foreground">
                  {JSON.stringify(invocation.result, null, 2)}
                </pre>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
