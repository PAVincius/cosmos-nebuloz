import { describe, expect, it } from "vitest";
import {
  computeOutcome,
  deltaPctOf,
  fmtDelta,
  outcomeTone,
} from "@/lib/signal/outcome";

const d = (iso: string) => new Date(iso);

describe("variação percentual", () => {
  it("calcula a queda de tempo por caso do handoff (46 min → 31 min)", () => {
    expect(Math.round(deltaPctOf(46, 31) as number)).toBe(-33);
  });

  it("calcula alta de conversão (18% → 21,4%)", () => {
    expect(Math.round(deltaPctOf(18, 21.4) as number)).toBe(19);
  });

  it("baseline zero devolve nulo, não Infinity", () => {
    expect(deltaPctOf(0, 10)).toBeNull();
  });

  it("valor ausente de qualquer lado devolve nulo", () => {
    // "8,2% de retrabalho" pode ser texto puro, sem par numérico limpo.
    expect(deltaPctOf(null, 10)).toBeNull();
    expect(deltaPctOf(10, undefined)).toBeNull();
  });
});

describe("direção da métrica", () => {
  it("cair é melhorar quando LOWER_IS_BETTER", () => {
    expect(outcomeTone(-33, "LOWER_IS_BETTER")).toBe("green");
    expect(outcomeTone(33, "LOWER_IS_BETTER")).toBe("red");
  });

  it("subir é melhorar quando HIGHER_IS_BETTER", () => {
    expect(outcomeTone(19, "HIGHER_IS_BETTER")).toBe("green");
    expect(outcomeTone(-19, "HIGHER_IS_BETTER")).toBe("red");
  });

  it("sem a direção, 'de 12 para 11' e 'de 18 para 21' não podem ser lidos pelo mesmo código", () => {
    expect(outcomeTone(-8, "LOWER_IS_BETTER")).not.toBe(
      outcomeTone(-8, "HIGHER_IS_BETTER")
    );
  });
});

describe("tom", () => {
  it("piorar é vermelho em qualquer magnitude", () => {
    expect(outcomeTone(0.5, "LOWER_IS_BETTER")).toBe("red");
    expect(outcomeTone(40, "LOWER_IS_BETTER")).toBe("red");
  });

  it("estagnar é vermelho — zero não é melhora", () => {
    expect(outcomeTone(0, "LOWER_IS_BETTER")).toBe("red");
  });

  it("melhorar menos de 10% é âmbar: existe, mas não sustenta escalar", () => {
    expect(outcomeTone(-8, "LOWER_IS_BETTER")).toBe("amber");
    expect(outcomeTone(-9.9, "LOWER_IS_BETTER")).toBe("amber");
  });

  it("melhorar 10% ou mais é verde, com a fronteira em >=", () => {
    expect(outcomeTone(-10, "LOWER_IS_BETTER")).toBe("green");
    expect(outcomeTone(-33, "LOWER_IS_BETTER")).toBe("green");
  });

  it("sem número comparável é neutro, nunca verde por omissão", () => {
    expect(outcomeTone(null, "LOWER_IS_BETTER")).toBe("neutral");
  });
});

describe("computeOutcome", () => {
  const series = [
    {
      periodStart: d("2026-06-01"),
      metricLabel: "Tempo por caso",
      baselineValue: "46 min",
      currentValue: "40 min",
      numericBaseline: 46,
      numericCurrent: 40,
    },
    {
      periodStart: d("2026-07-01"),
      metricLabel: "Tempo por caso",
      baselineValue: "46 min",
      currentValue: "31 min",
      numericBaseline: 46,
      numericCurrent: 31,
    },
  ];

  it("usa o período mais recente e monta a série", () => {
    const result = computeOutcome(series);
    expect(result?.currentValue).toBe("31 min");
    expect(result?.trend).toEqual([40, 31]);
    expect(Math.round(result?.deltaPct as number)).toBe(-33);
    expect(result?.improved).toBe(true);
    expect(result?.tone).toBe("green");
  });

  it("preserva o valor como foi assinado, não só o número", () => {
    // "46 min" precisa aparecer na tela exatamente assim.
    const result = computeOutcome(series);
    expect(result?.baselineValue).toBe("46 min");
  });

  it("sem snapshot devolve nulo — iniciativa em rascunho não tem resultado", () => {
    expect(computeOutcome([])).toBeNull();
  });

  it("assume LOWER_IS_BETTER quando a direção não vem", () => {
    expect(computeOutcome(series)?.direction).toBe("LOWER_IS_BETTER");
  });

  it("marca métrica secundária, a de guarda", () => {
    const guard = computeOutcome([
      {
        periodStart: d("2026-07-01"),
        metricLabel: "CSAT",
        baselineValue: "4,3",
        currentValue: "4,2",
        numericBaseline: 4.3,
        numericCurrent: 4.2,
        isSecondary: true,
        direction: "HIGHER_IS_BETTER" as const,
      },
    ]);
    expect(guard?.isSecondary).toBe(true);
    // CSAT caiu enquanto o tempo melhorava: é exatamente o que a métrica de
    // guarda existe para revelar.
    expect(guard?.tone).toBe("red");
  });
});

describe("formatação do delta", () => {
  it("usa sinal explícito nos dois sentidos", () => {
    expect(fmtDelta(-33.4)).toBe("−33%");
    expect(fmtDelta(19)).toBe("+19%");
  });

  it("mostra travessão sem número comparável", () => {
    expect(fmtDelta(null)).toBe("—");
  });
});
