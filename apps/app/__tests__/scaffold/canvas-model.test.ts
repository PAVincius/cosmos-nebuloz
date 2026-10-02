import { describe, expect, it } from "vitest";
import type { TrackDetailPhase } from "@/app/(scaffold)/actions/tracks";
import {
  GATE_WORD,
  gateSummary,
  isSame,
  stepStatement,
} from "@/components/scaffold/track-canvas-model";

const phase = (over: Partial<TrackDetailPhase>): TrackDetailPhase =>
  ({
    id: "pi1",
    phase: "ASSESS",
    state: "OPEN",
    steps: [],
    criteria: [
      { key: "k1", statement: "Baseline medido", evaluationType: "MANUAL" },
      { key: "k2", statement: "Dono assinou", evaluationType: "MANUAL" },
    ],
    result: null,
    ...over,
  }) as TrackDetailPhase;

describe("gateSummary", () => {
  it("gate em aberto: critérios do método, sem veredito e sem contagem (— e não 0)", () => {
    const s = gateSummary(phase({ state: "GATE_READY" }));
    expect(s.visual).toBe("ready");
    expect(s.word).toBe(GATE_WORD.ready);
    expect(s.decided).toBe(false);
    expect(s.met).toBeNull();
    expect(s.criteria.map((c) => c.met)).toEqual([null, null]);
  });

  it("gate decidido: mostra o snapshot congelado, não os critérios de hoje", () => {
    const s = gateSummary(
      phase({
        state: "CLOSED",
        // O método de hoje tem outros critérios; a decisão foi tomada sobre estes.
        criteria: [
          { key: "novo", statement: "Critério novo", evaluationType: "MANUAL" },
        ],
        result: {
          outcome: "PASSED",
          decidedAt: new Date(),
          cycle: 0,
          override: null,
          criteriaSnapshot: [
            { key: "k1", statement: "Baseline medido", met: true, note: null },
            {
              key: "k2",
              statement: "Dono assinou",
              met: false,
              note: "waiver",
            },
          ],
        },
      })
    );
    expect(s.visual).toBe("passed");
    expect(s.decided).toBe(true);
    expect(s.criteria.map((c) => c.key)).toEqual(["k1", "k2"]);
    expect(s.met).toBe(1);
  });

  it("bloqueado e futuro têm palavra própria", () => {
    expect(gateSummary(phase({ state: "BLOCKED" })).word).toBe("Bloqueado");
    expect(gateSummary(phase({ state: "IDLE" })).word).toBe("Futuro");
  });
});

describe("stepStatement e isSame", () => {
  const p = phase({
    steps: [
      { id: "s1", seq: 1, code: "A1", statement: "Medir o processo" },
      { id: "s2", seq: 2, code: null, statement: "Sem código" },
    ] as TrackDetailPhase["steps"],
  });
  it("acha o passo pelo código do método", () => {
    expect(stepStatement(p, "A1")).toBe("Medir o processo");
    expect(stepStatement(p, "Z9")).toBeNull();
    expect(stepStatement(undefined, "A1")).toBeNull();
  });
  it("compara seleção por tipo e id", () => {
    expect(isSame({ type: "dv", id: "x" }, "dv", "x")).toBe(true);
    expect(isSame({ type: "dv", id: "x" }, "step", "x")).toBe(false);
    expect(isSame(null, "dv", "x")).toBe(false);
  });
});
