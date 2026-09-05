import type { ScaffoldPhase, ScaffoldPhaseState } from "@repo/database";

// Ordem canônica e rótulos das quatro fases.
//
// Vive aqui e não no enum do Prisma porque enum não garante ordem estável entre
// migrations, e a progressão de fase depende de ordem fixa para ser
// determinística — mesma razão pela qual `MeridianAxis` tem `lib/meridian/axes.ts`.

export const PHASE_ORDER: readonly ScaffoldPhase[] = [
  "ASSESS",
  "PILOT",
  "SCALE",
  "EMBED",
] as const;

export type PhaseMeta = {
  n: number;
  label: string;
  /** O que a fase faz. */
  desc: string;
  /** A condição que fecha a fase, em uma frase. */
  gate: string;
};

export const PHASE: Record<ScaffoldPhase, PhaseMeta> = {
  ASSESS: {
    n: 1,
    label: "Assess",
    desc: "Medir o processo como roda hoje",
    gate: "Baseline medido existe e o dono do processo assinou.",
  },
  PILOT: {
    n: 2,
    label: "Pilot",
    desc: "Rodar a versão assistida em paralelo, com rollback",
    gate: "Piloto vence o baseline na métrica acordada sem risco novo.",
  },
  SCALE: {
    n: 3,
    label: "Scale",
    desc: "Estender ao time inteiro com política do Charter aplicada",
    gate: "Maioria do volume do time roda no caminho novo.",
  },
  EMBED: {
    n: 4,
    label: "Embed",
    desc: "Aposentar o caminho antigo e entregar a posse",
    gate: "Processo sobrevive 30 dias sem envolvimento da Nebuloz.",
  },
};

export const PHASE_STATE: Record<
  ScaffoldPhaseState,
  {
    label: string;
    tone: "accent" | "amber" | "red" | "green" | "blue" | "neutral";
  }
> = {
  IDLE: { label: "Não iniciada", tone: "neutral" },
  OPEN: { label: "Em andamento", tone: "accent" },
  GATE_READY: { label: "Gate pronto", tone: "amber" },
  BLOCKED: { label: "Bloqueado", tone: "red" },
  CLOSED: { label: "Fechado", tone: "green" },
  OBSERVING: { label: "Observação 30d", tone: "blue" },
  REOPENED: { label: "Reaberto", tone: "amber" },
};

// A janela de observação (SG-06) vive em `observation.ts`, junto da regra que a
// usa. Reexportar daqui criaria um barrel file — e a constante sozinha não diz
// nada sem `observationVerdict`.

/** Próxima fase na progressão, ou null na última. Uma fase nunca pula. */
export function nextPhase(phase: ScaffoldPhase): ScaffoldPhase | null {
  const i = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[i + 1] ?? null;
}
