// O que o canvas lê da trilha além do desenho: a seleção e o resumo do gate.
// Puro (sem DOM), para o teste cobrir a regra sem montar a tela.

import type { TrackDetailPhase } from "@/app/(scaffold)/actions/tracks";
import { GATE_VIS, type GateVisual, gateVisualFor } from "./phase-stepper";

export type CanvasSel =
  | { type: "phase"; id: string }
  | { type: "step"; id: string }
  | { type: "dv"; id: string }
  | { type: "gate"; id: string };

export const isSame = (
  a: CanvasSel | null,
  type: CanvasSel["type"],
  id: string
) => a?.type === type && a.id === id;

/** A palavra do estado do gate, curta o bastante para caber sob o losango. */
export const GATE_WORD: Record<GateVisual, string> = {
  passed: "Fechado",
  ready: "Pronto",
  blocked: "Bloqueado",
  locked: "Futuro",
};

type SnapshotRow = {
  key: string;
  statement: string;
  met: boolean;
  note: string | null;
};

export type GateSummary = {
  visual: GateVisual;
  tone: (typeof GATE_VIS)[GateVisual]["tone"];
  word: string;
  /** Critérios do gate. Decidido: o snapshot congelado (SG-07), nunca o template
   *  de hoje sobre uma decisão passada. Em aberto: os critérios, sem veredito. */
  criteria: {
    key: string;
    statement: string;
    met: boolean | null;
    note: string | null;
  }[];
  decided: boolean;
  /** Atendidos; nulo quando o gate ainda não foi decidido — "—" na tela, não 0. */
  met: number | null;
};

export function gateSummary(phase: TrackDetailPhase): GateSummary {
  const visual = gateVisualFor(phase);
  const decided = visual === "passed" && phase.result !== null;
  const snapshot = decided
    ? (phase.result?.criteriaSnapshot as SnapshotRow[] | null)
    : null;
  const criteria = snapshot
    ? snapshot.map((c) => ({
        key: c.key,
        statement: c.statement,
        met: c.met,
        note: c.note,
      }))
    : phase.criteria.map((c) => ({
        key: c.key,
        statement: c.statement,
        met: null,
        note: null,
      }));
  return {
    visual,
    tone: GATE_VIS[visual].tone,
    word: GATE_WORD[visual],
    criteria,
    decided,
    met: snapshot ? criteria.filter((c) => c.met).length : null,
  };
}

/** Passo pelo código do método: o nome do bloco vem de `getTrack`, que o liga
 *  aos entregáveis por `stepCode`. Sem código na versão, o bloco mostra só o
 *  código. */
export function stepStatement(
  phase: TrackDetailPhase | undefined,
  code: string
): string | null {
  return phase?.steps.find((s) => s.code === code)?.statement ?? null;
}
