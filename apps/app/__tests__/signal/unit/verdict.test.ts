import { describe, expect, it } from "vitest";
import { adoptionPct } from "@/lib/signal/adoption";
import { computeRoi } from "@/lib/signal/roi";
import {
  AT_RISK_VERDICTS,
  DEFAULT_BARS,
  isAtRisk,
  VERDICT_META,
  verdictOf,
  verdictWithMeta,
} from "@/lib/signal/verdict";
import { INITIATIVES } from "../fixtures";

describe("os quatro quadrantes", () => {
  it("adoção alta + valor alto = Provado", () => {
    expect(verdictOf({ adoptionPct: 78, multiple: 4.2 })).toBe("PROVEN");
  });

  it("adoção alta + valor baixo = Uso sem valor", () => {
    expect(verdictOf({ adoptionPct: 84, multiple: 0.9 })).toBe("VANITY");
  });

  it("adoção baixa + valor alto = Promessa parada", () => {
    expect(verdictOf({ adoptionPct: 34, multiple: 3.1 })).toBe("PROMISE");
  });

  it("adoção baixa + valor baixo = Candidata a parada", () => {
    expect(verdictOf({ adoptionPct: 22, multiple: 0.6 })).toBe("STOP");
  });
});

describe("fronteiras", () => {
  it("o valor exatamente na régua CONTA como acima — a regra é >=, não >", () => {
    expect(verdictOf({ adoptionPct: 60, multiple: 1.5 })).toBe("PROVEN");
    expect(verdictOf({ adoptionPct: 60, multiple: 1.5 }, DEFAULT_BARS)).toBe(
      "PROVEN"
    );
  });

  it("um décimo abaixo da régua muda o veredito", () => {
    expect(verdictOf({ adoptionPct: 59.9, multiple: 1.5 })).toBe("PROMISE");
    expect(verdictOf({ adoptionPct: 60, multiple: 1.49 })).toBe("VANITY");
  });

  it("compara valor CRU: 59,96% não vira adotada por arredondar para 60", () => {
    // Se o motor arredondasse antes de comparar, a mesma iniciativa teria
    // veredito diferente conforme a casa decimal exibida na tela.
    expect(verdictOf({ adoptionPct: 59.96, multiple: 4 })).toBe("PROMISE");
  });

  it("múltiplo nulo (custo não informado) NÃO conta como acima da régua", () => {
    // Nulo é ausência de dado, não retorno infinito. Conceder o benefício da
    // dúvida justamente onde falta o custo inverteria o produto.
    expect(verdictOf({ adoptionPct: 90, multiple: null })).toBe("VANITY");
    expect(verdictOf({ adoptionPct: 10, multiple: null })).toBe("STOP");
  });
});

describe("limiares por tenant", () => {
  it("subir a régua de valor rebaixa o veredito sem tocar no dado", () => {
    const initiative = { adoptionPct: 71, multiple: 1.8 };
    expect(verdictOf(initiative, { adoptionBar: 60, valueBar: 1.5 })).toBe(
      "PROVEN"
    );
    // O comitê endureceu a régua para 2,0×: mesma iniciativa, outro veredito.
    // É por isso que veredito não é coluna no banco.
    expect(verdictOf(initiative, { adoptionBar: 60, valueBar: 2.0 })).toBe(
      "VANITY"
    );
  });

  it("subir a régua de adoção também", () => {
    const initiative = { adoptionPct: 66, multiple: 2.4 };
    expect(verdictOf(initiative, { adoptionBar: 60, valueBar: 1.5 })).toBe(
      "PROVEN"
    );
    expect(verdictOf(initiative, { adoptionBar: 70, valueBar: 1.5 })).toBe(
      "PROMISE"
    );
  });
});

describe("veredito das fixtures do handoff", () => {
  it.each(
    INITIATIVES.map((i) => [i.code, i] as const)
  )("%s recebe o veredito esperado a partir de adoção e ROI derivados", (_code, fixture) => {
    const roi = computeRoi(fixture.roiEntries);
    const pct = adoptionPct(fixture.adoption);
    expect(verdictOf({ adoptionPct: pct, multiple: roi.multiple })).toBe(
      fixture.expected.verdict
    );
  });
});

describe("metadados", () => {
  it("todo veredito carrega ação sugerida — diagnóstico sem encaminhamento é ruído", () => {
    for (const meta of Object.values(VERDICT_META)) {
      expect(meta.action.length).toBeGreaterThan(0);
      expect(meta.why.length).toBeGreaterThan(0);
      expect(meta.label.length).toBeGreaterThan(0);
    }
  });

  it("entrega veredito e metadados de uma vez", () => {
    const result = verdictWithMeta({ adoptionPct: 84, multiple: 0.9 });
    expect(result.verdict).toBe("VANITY");
    expect(result.label).toBe("Uso sem valor");
    expect(result.action).toBe("Investigar método");
    expect(result.tone).toBe("red");
  });

  it("classifica como em risco só uso sem valor e candidata a parada", () => {
    expect(AT_RISK_VERDICTS).toEqual(["VANITY", "STOP"]);
    expect(isAtRisk("VANITY")).toBe(true);
    expect(isAtRisk("STOP")).toBe(true);
    // Promessa parada NÃO é dinheiro em risco: o retorno existe, falta escala.
    expect(isAtRisk("PROMISE")).toBe(false);
    expect(isAtRisk("PROVEN")).toBe(false);
  });
});
