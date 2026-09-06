// maturidade.test.ts — a rubrica de readiness e a média ponderada dela.
//
// O que estes testes guardam: (1) "tudo em nível N" tem que resultar no nível
// N — é o motivo de os cortes serem 12,5/37,5/62,5/87,5 e não 20/40/60/80;
// (2) faltando uma resposta o score é nulo, nunca parcial — "sem número, sem
// chute", a mesma regra do CAC; (3) resposta corrompida não pontua como 0 nem
// como 4, porque as duas leituras mentem em direções opostas.
import { describe, expect, it } from "vitest";
import {
  CRITERIOS,
  DIMENSOES,
  INFO_DIMENSAO,
  nivelDoScore,
  pesosSomam100,
  pontuar,
  type Resposta,
  RUBRICA_ATUAL,
  RUBRICA_V1,
  rubricaDe,
} from "../lib/growth/maturidade";

/** Todos os critérios no mesmo nível. */
function tudoEm(nivel: number): Resposta[] {
  return CRITERIOS.map((c) => ({ criterioId: c.id, nivel }));
}

describe("rubrica", () => {
  it("os pesos somam 100 — média ponderada com outra soma mente", () => {
    expect(pesosSomam100(RUBRICA_V1)).toBe(true);
  });

  it("toda dimensão tem critério, e todo critério tem dimensão conhecida", () => {
    for (const d of DIMENSOES) {
      expect(CRITERIOS.filter((c) => c.dimensao === d).length).toBeGreaterThan(
        0
      );
    }
    for (const c of CRITERIOS) {
      expect(INFO_DIMENSAO[c.dimensao]).toBeDefined();
    }
  });

  it("não há id de critério repetido — repetido some no Map de `pontuar`", () => {
    expect(new Set(CRITERIOS.map((c) => c.id)).size).toBe(CRITERIOS.length);
  });

  it("a versão atual é resolvível — é a que a action carimba na avaliação", () => {
    expect(rubricaDe(RUBRICA_ATUAL)).toBe(RUBRICA_V1);
    expect(rubricaDe("v0")).toBeUndefined();
  });
});

describe("nivelDoScore", () => {
  it("tudo em nível N resulta no nível N", () => {
    // 0 → 0, 1 → 25, 2 → 50, 3 → 75, 4 → 100.
    expect(nivelDoScore(0)).toBe(0);
    expect(nivelDoScore(25)).toBe(1);
    expect(nivelDoScore(50)).toBe(2);
    expect(nivelDoScore(75)).toBe(3);
    expect(nivelDoScore(100)).toBe(4);
  });

  it("os cortes ficam no meio da faixa", () => {
    expect(nivelDoScore(12)).toBe(0);
    expect(nivelDoScore(13)).toBe(1);
    expect(nivelDoScore(62)).toBe(2);
    expect(nivelDoScore(63)).toBe(3);
  });
});

describe("pontuar", () => {
  it("avaliação vazia não pontua nada", () => {
    const r = pontuar([]);
    expect(r.scoreGeral).toBeNull();
    expect(r.nivelGeral).toBeNull();
    expect(r.elo).toBeNull();
    expect(r.proximoDegrau).toBeNull();
    expect(r.respondidos).toBe(0);
    expect(r.total).toBe(CRITERIOS.length);
  });

  it("tudo em nível 4 dá 100 e Otimizado", () => {
    const r = pontuar(tudoEm(4));
    expect(r.scoreGeral).toBe(100);
    expect(r.nivelGeral).toBe("OTIMIZADO");
    expect(r.respondidos).toBe(CRITERIOS.length);
  });

  it("tudo em nível 1 dá 25 e Adotado — o corte em 20 diria Definido", () => {
    const r = pontuar(tudoEm(1));
    expect(r.scoreGeral).toBe(25);
    expect(r.nivelGeral).toBe("ADOTADO");
  });

  it("falta uma resposta, o geral é nulo — parcial não é score", () => {
    const r = pontuar(tudoEm(3).slice(0, CRITERIOS.length - 1));
    expect(r.scoreGeral).toBeNull();
    expect(r.respondidos).toBe(CRITERIOS.length - 1);
    // As dimensões completas continuam pontuando; só a incompleta é nula.
    expect(r.porDimensao.filter((d) => d.score === null).length).toBe(1);
    expect(r.porDimensao.filter((d) => d.score === 75).length).toBe(
      DIMENSOES.length - 1
    );
  });

  it("critério desconhecido não conta como resposta", () => {
    const r = pontuar([...tudoEm(2), { criterioId: "inexistente", nivel: 4 }]);
    expect(r.respondidos).toBe(CRITERIOS.length);
    expect(r.scoreGeral).toBe(50);
  });

  it("nível fora da escala não pontua — nem como 0, nem como 4", () => {
    const [primeiro, ...resto] = CRITERIOS;
    const r = pontuar([
      { criterioId: primeiro.id, nivel: 9 },
      ...resto.map((c) => ({ criterioId: c.id, nivel: 4 })),
    ]);
    expect(r.scoreGeral).toBeNull();
    expect(r.respondidos).toBe(CRITERIOS.length - 1);
  });

  it("o elo é a dimensão de menor score, e ele escolhe o degrau", () => {
    // Tudo em 4, menos Governança em 0.
    const respostas = CRITERIOS.map((c) => ({
      criterioId: c.id,
      nivel: c.dimensao === "GOVERNANCA" ? 0 : 4,
    }));
    const r = pontuar(respostas);
    expect(r.elo).toBe("GOVERNANCA");
    expect(r.proximoDegrau).toBe(INFO_DIMENSAO.GOVERNANCA.degrau);
    // 100 em tudo menos os 15 pontos de peso de Governança.
    expect(r.scoreGeral).toBe(85);
  });

  it("o peso da dimensão muda o geral — não é média simples", () => {
    // Cultura (peso 10) zerada custa menos que Estratégia (peso 20) zerada.
    const zerar = (alvo: string) =>
      pontuar(
        CRITERIOS.map((c) => ({
          criterioId: c.id,
          nivel: c.dimensao === alvo ? 0 : 4,
        }))
      ).scoreGeral;
    expect(zerar("CULTURA")).toBe(90);
    expect(zerar("ESTRATEGIA")).toBe(80);
  });
});
