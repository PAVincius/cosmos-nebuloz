import type { ScaffoldPhase } from "@repo/database";
import { PHASE_ORDER } from "./phases";

// Desenho da trilha em canvas (somente leitura).
//
// Função pura dos dados que `getTrack` e `listDeliverables` já entregam: fases
// em colunas, passos em blocos, entregáveis como nós e um gate entre cada fase
// e a seguinte. Não existe posição gravada em lugar nenhum — a ordem é a do
// método (fase, depois código do passo, depois código do entregável), e é por
// isso que o canvas não precisa de migration nem de permissão própria.

export const CANVAS = {
  COL_W: 248,
  GAP_X: 120,
  CARD_H: 56,
  CARD_GAP: 8,
  /** 44px: o alvo de toque do passo, que é um botão (WCAG 2.5.8, SN-10). */
  STEP_HEAD: 44,
  STEP_PAD: 10,
  STEP_GAP: 22,
  HEAD_H: 64,
} as const;

/** Respiro entre o cabeçalho da coluna e o primeiro bloco de passo. */
const HEAD_GAP = 16;
/** Meia largura do losango (alvo de 44px) — onde a aresta encosta nele. */
const GATE_HALF = 20;
const BOTTOM_PAD = 20;
const RIGHT_PAD = 40;

export type LayoutPhase = { id: string; phase: ScaffoldPhase };
export type LayoutDeliverable = {
  id: string;
  phaseInstanceId: string;
  stepCode: string;
  code: string;
};

export type StepBlock = {
  id: string;
  phase: ScaffoldPhase;
  stepCode: string;
  x: number;
  y: number;
  w: number;
  h: number;
  deliverableIds: string[];
};

export type LayoutColumn = {
  phase: ScaffoldPhase;
  phaseId: string;
  index: number;
  x: number;
  /** Onde a coluna termina (base do último bloco, ou o cabeçalho se vazia). */
  h: number;
  steps: StepBlock[];
};

export type LayoutNode<D> = {
  id: string;
  deliverable: D;
  phase: ScaffoldPhase;
  stepId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LayoutGate = {
  id: string;
  phase: ScaffoldPhase;
  phaseId: string;
  x: number;
  y: number;
};

export type LayoutEdge = {
  id: string;
  d: string;
  /** Aresta do trilho (entra ou sai de um gate). */
  gate: boolean;
  /** Fase a que a aresta "pertence" — a tela a esmaece quando a fase não abriu. */
  phase: ScaffoldPhase;
};

export type CanvasLayout<D> = {
  columns: LayoutColumn[];
  nodes: LayoutNode<D>[];
  gates: LayoutGate[];
  edges: LayoutEdge[];
  w: number;
  h: number;
};

const natural = (a: string, b: string) =>
  a.localeCompare(b, "pt", { numeric: true });

const blockHeight = (count: number) =>
  CANVAS.STEP_HEAD +
  count * (CANVAS.CARD_H + CANVAS.CARD_GAP) -
  CANVAS.CARD_GAP +
  CANVAS.STEP_PAD * 2;

export function layoutTrack<D extends LayoutDeliverable>(
  phases: readonly LayoutPhase[],
  deliverables: readonly D[]
): CanvasLayout<D> {
  const ordered = PHASE_ORDER.flatMap((p) => {
    const found = phases.find((x) => x.phase === p);
    return found ? [found] : [];
  });

  const columns: LayoutColumn[] = [];
  const nodes: LayoutNode<D>[] = [];
  const edges: LayoutEdge[] = [];

  for (const [index, ph] of ordered.entries()) {
    const x = index * (CANVAS.COL_W + CANVAS.GAP_X);
    const own = deliverables.filter((d) => d.phaseInstanceId === ph.id);
    const stepCodes = [...new Set(own.map((d) => d.stepCode))].sort(natural);

    let y = CANVAS.HEAD_H + HEAD_GAP;
    const steps: StepBlock[] = stepCodes.map((stepCode) => {
      const inStep = own
        .filter((d) => d.stepCode === stepCode)
        .sort((a, b) => natural(a.code, b.code));
      const h = blockHeight(inStep.length);
      const block: StepBlock = {
        id: `${ph.phase}:${stepCode}`,
        phase: ph.phase,
        stepCode,
        x,
        y,
        w: CANVAS.COL_W,
        h,
        deliverableIds: inStep.map((d) => d.id),
      };
      for (const [k, d] of inStep.entries()) {
        nodes.push({
          id: d.id,
          deliverable: d,
          phase: ph.phase,
          stepId: block.id,
          x: x + CANVAS.STEP_PAD,
          y:
            y +
            CANVAS.STEP_HEAD +
            CANVAS.STEP_PAD +
            k * (CANVAS.CARD_H + CANVAS.CARD_GAP),
          w: CANVAS.COL_W - CANVAS.STEP_PAD * 2,
          h: CANVAS.CARD_H,
        });
      }
      y += h + CANVAS.STEP_GAP;
      return block;
    });

    for (const [k, s] of steps.entries()) {
      const prev = steps[k - 1];
      if (prev) {
        edges.push({
          id: `e-${s.id}`,
          d: `M${s.x + s.w / 2},${prev.y + prev.h} L${s.x + s.w / 2},${s.y}`,
          gate: false,
          phase: ph.phase,
        });
      }
    }

    const last = steps.at(-1);
    columns.push({
      phase: ph.phase,
      phaseId: ph.id,
      index,
      x,
      h: last ? last.y + last.h : CANVAS.HEAD_H,
      steps,
    });
  }

  const tallest = Math.max(CANVAS.HEAD_H, ...columns.map((c) => c.h));
  // O gate mora no trilho: na altura dos cabeçalhos, entre uma fase e a seguinte
  // (cabeçalho, gate, cabeçalho, gate — o mesmo desenho do PhaseStepper), e não
  // solto no meio da coluna. Os passos penduram abaixo do cabeçalho.
  const railY = CANVAS.HEAD_H / 2;

  const gates: LayoutGate[] = columns.map((c) => ({
    id: `gate:${c.phase}`,
    phase: c.phase,
    phaseId: c.phaseId,
    x: c.x + CANVAS.COL_W + CANVAS.GAP_X / 2,
    y: railY,
  }));

  for (const [i, c] of columns.entries()) {
    const gate = gates[i];
    const next = columns[i + 1];
    const first = c.steps[0];
    // Cabeçalho -> primeiro passo: a fase "abre" para os passos dela.
    if (first) {
      edges.push({
        id: `e-head-${c.phase}`,
        d: `M${c.x + CANVAS.COL_W / 2},${CANVAS.HEAD_H} L${first.x + first.w / 2},${first.y}`,
        gate: false,
        phase: c.phase,
      });
    }
    if (!gate) {
      continue;
    }
    edges.push({
      id: `g-in-${c.phase}`,
      d: `M${c.x + CANVAS.COL_W},${railY} L${gate.x - GATE_HALF},${railY}`,
      gate: true,
      phase: c.phase,
    });
    if (next) {
      edges.push({
        id: `g-out-${c.phase}`,
        d: `M${gate.x + GATE_HALF},${railY} L${next.x},${railY}`,
        gate: true,
        phase: next.phase,
      });
    }
  }

  return {
    columns,
    nodes,
    gates,
    edges,
    w:
      columns.length * (CANVAS.COL_W + CANVAS.GAP_X) -
      CANVAS.GAP_X / 2 +
      RIGHT_PAD,
    h: tallest + BOTTOM_PAD,
  };
}
