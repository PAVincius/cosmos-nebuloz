import { describe, expect, it } from "vitest";
import {
  assertWeightsSumTo100,
  bandOf,
  ConfidenceConfigError,
  computeConfidence,
  DEFAULT_CONFIDENCE_RULES,
} from "@/lib/signal/confidence";
import { byCode, INITIATIVES } from "../fixtures";

describe("score de confiança contra as fixtures do handoff", () => {
  it.each(
    INITIATIVES.map((i) => [i.code, i] as const)
  )("%s soma os fatores e cai na faixa certa", (_code, fixture) => {
    const result = computeConfidence(fixture.confidenceFactors);
    expect(result.score).toBe(fixture.expected.confidenceScore);
    expect(result.band).toBe(fixture.expected.confidenceBand);
  });

  it("expõe quanto cada fator perdeu, para a tela mostrar o desconto", () => {
    const result = computeConfidence(byCode("IN-014").confidenceFactors);
    const sources = result.factors.find((f) => f.key === "sources.fresh");
    expect(sources?.lost).toBe(7); // peso 25, obteve 18
    expect(sources?.note).toContain("Zendesk desconectado");
  });

  it("preserva a nota do desconto — score sem apelação é número autoritário", () => {
    const result = computeConfidence(byCode("IN-021").confidenceFactors);
    const withNotes = result.factors.filter((f) => f.lost > 0 && f.note);
    expect(withNotes.length).toBeGreaterThan(0);
  });
});

describe("faixas", () => {
  it("respeita as fronteiras exatas, com >=", () => {
    expect(bandOf(80)).toBe("HIGH");
    expect(bandOf(79)).toBe("MEDIUM");
    expect(bandOf(65)).toBe("MEDIUM");
    expect(bandOf(64)).toBe("LOW");
    expect(bandOf(1)).toBe("LOW");
    expect(bandOf(0)).toBe("NONE");
  });

  it("distingue 'sem dado' de 'baixa' — zero não é uma nota ruim, é ausência", () => {
    expect(computeConfidence([]).band).toBe("NONE");
    expect(computeConfidence(byCode("IN-042").confidenceFactors).band).toBe(
      "NONE"
    );
    expect(bandOf(0)).not.toBe("LOW");
  });

  it("dá tom e rótulo pt-BR junto do score", () => {
    const high = computeConfidence(byCode("IN-014").confidenceFactors);
    expect(high.bandLabel).toBe("Alta");
    expect(high.tone).toBe("green");
    const low = computeConfidence(byCode("IN-027").confidenceFactors);
    expect(low.bandLabel).toBe("Baixa");
    expect(low.tone).toBe("red");
  });
});

describe("configuração do catálogo", () => {
  it("aceita o catálogo padrão — os pesos do handoff somam 100", () => {
    expect(() =>
      assertWeightsSumTo100([...DEFAULT_CONFIDENCE_RULES])
    ).not.toThrow();
  });

  it("recusa pesos que não somam 100 e nomeia a regra", () => {
    expect(() =>
      computeConfidence([
        { key: "a", label: "A", weight: 30, got: 30 },
        { key: "b", label: "B", weight: 50, got: 10 },
      ])
    ).toThrowError(ConfidenceConfigError);

    try {
      assertWeightsSumTo100([{ weight: 30 }, { weight: 50 }]);
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect((e as ConfidenceConfigError).rule).toBe("confidence.weights.sum");
      expect((e as Error).message).toContain("80");
    }
  });

  it("recusa fator acima do próprio peso em vez de truncar", () => {
    // Truncar esconderia bug do avaliador e ainda inflaria o score até o teto.
    expect(() =>
      computeConfidence([
        { key: "a", label: "Baseline", weight: 30, got: 40 },
        { key: "b", label: "Fontes", weight: 70, got: 70 },
      ])
    ).toThrowError(/obteve 40 de um peso de 30/);
  });

  it("recusa fator negativo", () => {
    expect(() =>
      computeConfidence([
        { key: "a", label: "Baseline", weight: 30, got: -1 },
        { key: "b", label: "Fontes", weight: 70, got: 70 },
      ])
    ).toThrowError(ConfidenceConfigError);
  });

  it("catálogo vazio não exige soma 100 — tenant recém-criado ainda não configurou", () => {
    expect(() => computeConfidence([])).not.toThrow();
    expect(computeConfidence([]).score).toBe(0);
  });
});

describe("divergência conhecida do mock", () => {
  it("IN-014: os fatores somam 93 e o headline do handoff dizia 86", () => {
    const fixture = byCode("IN-014");
    expect(computeConfidence(fixture.confidenceFactors).score).toBe(93);
    // O alerta AL-30 do mesmo mock tratava 93 como o estado JÁ CORRIGIDO,
    // enquanto a lista de fatores já vinha com o desconto do Zendesk aplicado.
    // Os dois não podiam ser verdade ao mesmo tempo.
    expect(fixture.mockHeadline?.confidenceScore).toBe(86);
  });
});
