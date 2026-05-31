"use client";

import { motion } from "framer-motion";
import type { CopilotMode } from "./copilot-provider";

const MODE_PROMPTS: Record<CopilotMode, string[]> = {
  rte: [
    "Resuma o PI atual para o board em 5 bullets",
    "Liste dependências críticas que ameaçam objetivos",
    "Quais gargalos de fluxo preciso endereçar?",
  ],
  lpm: [
    "Quais épicos têm pior combinação de Flow Time e budget?",
    "Gere briefing de portfólio para comitê de investimento",
    "Qual VS está com maior risco de estouro de budget?",
  ],
  pm: [
    "Sugira 4 objetivos de PI com base nestas features",
    "Identifique riscos relevantes para meu conjunto de features",
    "Gere KRs alinhados ao tema estratégico ativo",
  ],
  team: [
    "Quais itens estão bloqueados no sprint atual?",
    "Sugira mudanças de WIP baseadas no Flow Load",
    "Resuma impedimentos em aberto com proposta de ação",
  ],
  spc: [
    "Compare Flow Metrics entre PI anterior e PI atual",
    "Sugira 3 ações de melhoria com base nos dados",
    "Prepare síntese para Inspect & Adapt",
  ],
  global: [
    "Como está a saúde geral do ART?",
    "Quais são as principais prioridades desta semana?",
    "Mostre um resumo do portfólio",
  ],
};

type CopilotPromptChipsProps = {
  mode: CopilotMode;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

export function CopilotPromptChips({
  mode,
  onSelect,
  disabled,
}: CopilotPromptChipsProps) {
  const prompts = MODE_PROMPTS[mode] ?? MODE_PROMPTS.global;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2">
      {prompts.map((prompt, i) => (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full border bg-muted/50 px-3 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          initial={{ opacity: 0, y: 6 }}
          key={prompt}
          onClick={() => onSelect(prompt)}
          transition={{ duration: 0.2, delay: i * 0.06, ease: "easeOut" }}
          type="button"
          whileTap={{ scale: 0.95 }}
        >
          {prompt}
        </motion.button>
      ))}
    </div>
  );
}
