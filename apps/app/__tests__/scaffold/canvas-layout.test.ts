import { describe, expect, it } from "vitest";
import { CANVAS, layoutTrack } from "@/lib/scaffold/canvas-layout";

// Canvas da trilha (somente leitura): o desenho é função pura dos dados que
// `getTrack` e `listDeliverables` já entregam. Sem posição no banco — a ordem
// vem do método (fase, passo, código), nunca de arrasto.

const PHASES = [
  { id: "ph-assess", phase: "ASSESS" as const },
  { id: "ph-pilot", phase: "PILOT" as const },
  { id: "ph-scale", phase: "SCALE" as const },
  { id: "ph-embed", phase: "EMBED" as const },
];

const del = (
  id: string,
  phaseInstanceId: string,
  stepCode: string,
  code: string
) => ({ id, phaseInstanceId, stepCode, code });

const BLOCK_H = (n: number) =>
  CANVAS.STEP_HEAD +
  n * (CANVAS.CARD_H + CANVAS.CARD_GAP) -
  CANVAS.CARD_GAP +
  CANVAS.STEP_PAD * 2;

describe("layoutTrack — fases em colunas", () => {
  it("põe as quatro fases em colunas na ordem do método, qualquer que seja a ordem de entrada", () => {
    const shuffled = [PHASES[2], PHASES[0], PHASES[3], PHASES[1]] as never[];
    const L = layoutTrack(shuffled, []);
    expect(L.columns.map((c) => c.phase)).toEqual([
      "ASSESS",
      "PILOT",
      "SCALE",
      "EMBED",
    ]);
    expect(L.columns.map((c) => c.x)).toEqual(
      [0, 1, 2, 3].map((i) => i * (CANVAS.COL_W + CANVAS.GAP_X))
    );
  });

  it("fase sem entregável fica como coluna vazia, sem passo e sem nó", () => {
    const L = layoutTrack(PHASES, [del("d1", "ph-assess", "A1", "A1.1")]);
    const pilot = L.columns[1];
    expect(pilot?.steps).toEqual([]);
    expect(pilot?.h).toBe(CANVAS.HEAD_H);
    expect(L.nodes.map((n) => n.id)).toEqual(["d1"]);
  });

  it("ignora entregável de fase que a trilha não tem", () => {
    const L = layoutTrack(PHASES, [del("x", "ph-outra-trilha", "A1", "A1.1")]);
    expect(L.nodes).toEqual([]);
  });
});

describe("layoutTrack — passos e entregáveis", () => {
  const items = [
    del("d3", "ph-assess", "A2", "A2.1"),
    del("d2", "ph-assess", "A1", "A1.2"),
    del("d1", "ph-assess", "A1", "A1.1"),
    del("d4", "ph-assess", "A10", "A10.1"),
    del("d5", "ph-assess", "A1", "A1.10"),
  ];

  it("agrupa por código de passo, em ordem natural (A1, A2, A10)", () => {
    const L = layoutTrack(PHASES, items);
    expect(L.columns[0]?.steps.map((s) => s.stepCode)).toEqual([
      "A1",
      "A2",
      "A10",
    ]);
  });

  it("ordena os entregáveis do passo por código natural (A1.1, A1.2, A1.10)", () => {
    const L = layoutTrack(PHASES, items);
    expect(L.columns[0]?.steps[0]?.deliverableIds).toEqual(["d1", "d2", "d5"]);
  });

  it("empilha os blocos de passo com o espaço do método e dimensiona pela contagem de entregáveis", () => {
    const L = layoutTrack(PHASES, items);
    const [a1, a2, a10] = L.columns[0]?.steps ?? [];
    expect(a1?.y).toBe(CANVAS.HEAD_H + 16);
    expect(a1?.h).toBe(BLOCK_H(3));
    expect(a2?.y).toBe((a1?.y ?? 0) + BLOCK_H(3) + CANVAS.STEP_GAP);
    expect(a10?.y).toBe((a2?.y ?? 0) + BLOCK_H(1) + CANVAS.STEP_GAP);
    expect(L.columns[0]?.h).toBe((a10?.y ?? 0) + BLOCK_H(1));
  });

  it("posiciona cada nó dentro do bloco do seu passo, um abaixo do outro", () => {
    const L = layoutTrack(PHASES, items);
    const a1 = L.columns[0]?.steps[0];
    const nodes = ["d1", "d2", "d5"].map((id) =>
      L.nodes.find((n) => n.id === id)
    );
    for (const [k, n] of nodes.entries()) {
      expect(n?.x).toBe((a1?.x ?? 0) + CANVAS.STEP_PAD);
      expect(n?.w).toBe(CANVAS.COL_W - CANVAS.STEP_PAD * 2);
      expect(n?.h).toBe(CANVAS.CARD_H);
      expect(n?.y).toBe(
        (a1?.y ?? 0) +
          CANVAS.STEP_HEAD +
          CANVAS.STEP_PAD +
          k * (CANVAS.CARD_H + CANVAS.CARD_GAP)
      );
      expect(n?.stepId).toBe("ASSESS:A1");
    }
  });

  it("o nó guarda o entregável original, para a tela ler estado e título dele", () => {
    const L = layoutTrack(PHASES, items);
    expect(L.nodes.find((n) => n.id === "d3")?.deliverable).toBe(items[0]);
  });
});

describe("layoutTrack — gates", () => {
  it("há um gate por fase, entre a coluna e a seguinte, todos na mesma altura", () => {
    const L = layoutTrack(PHASES, [del("d1", "ph-assess", "A1", "A1.1")]);
    expect(L.gates.map((g) => g.phase)).toEqual([
      "ASSESS",
      "PILOT",
      "SCALE",
      "EMBED",
    ]);
    for (const [i, g] of L.gates.entries()) {
      const col = L.columns[i];
      expect(g.x).toBe((col?.x ?? 0) + CANVAS.COL_W + CANVAS.GAP_X / 2);
      expect(g.y).toBe(L.gates[0]?.y);
      expect(g.phaseId).toBe(PHASES[i]?.id);
      expect(g.id).toBe(`gate:${g.phase}`);
    }
  });

  it("o gate mora no trilho, na altura dos cabeçalhos, qualquer que seja a altura das colunas", () => {
    const tall = layoutTrack(
      PHASES,
      Array.from({ length: 12 }, (_, i) =>
        del(`d${i}`, "ph-assess", "A1", `A1.${i + 1}`)
      )
    );
    const empty = layoutTrack(PHASES, []);
    for (const L of [tall, empty]) {
      for (const g of L.gates) {
        expect(g.y).toBe(CANVAS.HEAD_H / 2);
      }
    }
  });
});

describe("layoutTrack — arestas", () => {
  it("liga passos consecutivos da mesma fase por uma aresta vertical", () => {
    const L = layoutTrack(PHASES, [
      del("d1", "ph-assess", "A1", "A1.1"),
      del("d2", "ph-assess", "A2", "A2.1"),
    ]);
    const steps = L.columns[0]?.steps ?? [];
    const edge = L.edges.find((e) => e.id === "e-ASSESS:A2");
    expect(edge?.gate).toBe(false);
    expect(edge?.phase).toBe("ASSESS");
    expect(edge?.d).toBe(
      `M${(steps[0]?.x ?? 0) + CANVAS.COL_W / 2},${(steps[0]?.y ?? 0) + (steps[0]?.h ?? 0)} L${(steps[1]?.x ?? 0) + CANVAS.COL_W / 2},${steps[1]?.y}`
    );
  });

  it("o trilho liga o fim de cada coluna ao gate e o gate ao início da fase seguinte, em linha reta", () => {
    const L = layoutTrack(PHASES, [del("d1", "ph-assess", "A1", "A1.1")]);
    const gate = L.gates[0];
    const rail = CANVAS.HEAD_H / 2;
    expect(L.edges.find((e) => e.id === "g-in-ASSESS")?.d).toBe(
      `M${CANVAS.COL_W},${rail} L${(gate?.x ?? 0) - 20},${rail}`
    );
    const out = L.edges.find((e) => e.id === "g-out-ASSESS");
    expect(out?.d).toBe(
      `M${(gate?.x ?? 0) + 20},${rail} L${CANVAS.COL_W + CANVAS.GAP_X},${rail}`
    );
    // a aresta de saída pertence à fase que ela alcança
    expect(out?.phase).toBe("PILOT");
    expect(out?.gate).toBe(true);
    // EMBED é a última: só entrada.
    expect(L.edges.some((e) => e.id === "g-out-EMBED")).toBe(false);
  });

  it("o cabeçalho abre para o primeiro passo da fase", () => {
    const L = layoutTrack(PHASES, [del("d1", "ph-assess", "A1", "A1.1")]);
    const first = L.columns[0]?.steps[0];
    expect(L.edges.find((e) => e.id === "e-head-ASSESS")?.d).toBe(
      `M${CANVAS.COL_W / 2},${CANVAS.HEAD_H} L${(first?.x ?? 0) + (first?.w ?? 0) / 2},${first?.y}`
    );
  });

  it("fase vazia não tem passo nem aresta de passo, mas o trilho segue passando por ela", () => {
    const L = layoutTrack(PHASES, []);
    expect(L.edges.some((e) => !e.gate)).toBe(false);
    expect(L.edges.find((e) => e.id === "g-in-ASSESS")).toBeDefined();
    expect(L.edges.find((e) => e.id === "g-out-ASSESS")).toBeDefined();
  });
});

describe("layoutTrack — tamanho", () => {
  it("a largura cobre as quatro colunas, os vãos e o último gate", () => {
    const L = layoutTrack(PHASES, []);
    expect(L.w).toBeGreaterThanOrEqual(
      4 * CANVAS.COL_W + 3 * CANVAS.GAP_X + CANVAS.GAP_X / 2
    );
  });

  it("a altura cobre a coluna mais alta", () => {
    const L = layoutTrack(PHASES, [
      del("d1", "ph-assess", "A1", "A1.1"),
      del("d2", "ph-assess", "A1", "A1.2"),
    ]);
    expect(L.h).toBeGreaterThanOrEqual(L.columns[0]?.h ?? 0);
  });
});
