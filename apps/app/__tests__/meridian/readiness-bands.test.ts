import { describe, expect, it } from "vitest";
import {
  ARCHETYPE_LABEL,
  type AxisReading,
  assessReadiness,
  BAND_LABEL,
  bandOf,
  PILOT_FLOOR_MIN,
  RELIABILITY_MIN,
  SIGNAL_CODES,
  signalsFromAnswers,
} from "@/lib/meridian/readiness-bands";

// Faixas por eixo e arquétipos (briefing do Andaime, itens 1 e 2). O score é
// instrução de sequência, não nota: a faixa diz onde começar, o arquétipo diz
// qual padrão entre os eixos pede qual trilha.

const read = (
  [data, process, people, governance, infra]: [
    number,
    number,
    number,
    number,
    number,
  ],
  conf: Partial<Record<AxisReading["axis"], number>> = {}
): AxisReading[] => [
  { axis: "DATA", score: data, confidence: conf.DATA ?? 0.9 },
  { axis: "PROCESS", score: process, confidence: conf.PROCESS ?? 0.9 },
  { axis: "PEOPLE", score: people, confidence: conf.PEOPLE ?? 0.9 },
  { axis: "GOVERNANCE", score: governance, confidence: conf.GOVERNANCE ?? 0.9 },
  {
    axis: "INFRASTRUCTURE",
    score: infra,
    confidence: conf.INFRASTRUCTURE ?? 0.9,
  },
];

describe("bandOf — faixas iguais nos cinco eixos", () => {
  it.each([
    [0, "INITIAL"],
    [39, "INITIAL"],
    [40, "FORMING"],
    [59, "FORMING"],
    [60, "STRUCTURED"],
    [79, "STRUCTURED"],
    [80, "MATURE"],
    [100, "MATURE"],
  ] as const)("score %i → %s", (score, band) => {
    expect(bandOf(score)).toBe(band);
  });

  it("scores fracionários caem na faixa de baixo até o limite (39,9 é Inicial)", () => {
    expect(bandOf(39.9)).toBe("INITIAL");
    expect(bandOf(59.9)).toBe("FORMING");
    expect(bandOf(79.9)).toBe("STRUCTURED");
  });

  it("nomes em português", () => {
    expect(BAND_LABEL).toEqual({
      INITIAL: "Inicial",
      FORMING: "Em formação",
      STRUCTURED: "Estruturado",
      MATURE: "Maduro",
    });
  });
});

describe("confiança — abaixo de 0,6 a faixa é 'não confiável'", () => {
  it("o limite é 0,6", () => {
    expect(RELIABILITY_MIN).toBe(0.6);
  });

  it("confiança 0,59 ACRESCENTA a marca; a faixa continua; 0,6 já confia", () => {
    const p = assessReadiness(
      read([70, 70, 70, 70, 70], { DATA: 0.59, PROCESS: 0.6 })
    );
    const data = p.axes.find((a) => a.axis === "DATA");
    const process = p.axes.find((a) => a.axis === "PROCESS");
    expect(data?.reliable).toBe(false);
    // A marca não substitui a faixa (spec framework-no-scaffold, US1 cenário 2).
    expect(data?.display).toBe("Estruturado");
    expect(data?.unreliableMark).toBe("Não confiável");
    expect(process?.reliable).toBe(true);
    expect(process?.display).toBe("Estruturado");
    expect(process?.unreliableMark).toBeNull();
  });

  it("o eixo não confiável guarda a faixa calculada e aparece em unreliableAxes", () => {
    const p = assessReadiness(read([70, 70, 70, 70, 70], { DATA: 0.3 }));
    expect(p.axes[0]?.band).toBe("STRUCTURED");
    expect(p.unreliableAxes).toEqual(["DATA"]);
  });
});

describe("arquétipos — os sete padrões", () => {
  it("Uniformemente baixo: todos < 40", () => {
    expect(assessReadiness(read([10, 20, 30, 39, 5])).dominant).toBe(
      "UNIFORMLY_LOW"
    );
  });

  it("Piloto sem chão: Pessoas e Processo ≥ 40, Dados e Infra < 40", () => {
    const p = assessReadiness(read([30, 50, 45, 20, 35]));
    expect(p.dominant).toBe("PILOT_NO_GROUND");
  });

  it("o piso do Piloto é 40 (D-24 do Norte; constante única)", () => {
    expect(PILOT_FLOOR_MIN).toBe(40);
    // 39 em Pessoas: fora do Piloto.
    expect(assessReadiness(read([30, 50, 39, 20, 35])).dominant).not.toBe(
      "PILOT_NO_GROUND"
    );
  });

  it("Dado sem uso: Dados e Infra ≥ 60, Processo e Pessoas < 40", () => {
    expect(assessReadiness(read([70, 30, 20, 50, 65])).dominant).toBe(
      "DATA_UNUSED"
    );
  });

  it("Cautela travada: Governança ≥ 60, o resto < 40", () => {
    expect(assessReadiness(read([20, 30, 10, 65, 35])).dominant).toBe(
      "STALLED_CAUTION"
    );
  });

  it("Pronto para escalar: todos ≥ 60", () => {
    expect(assessReadiness(read([60, 75, 82, 90, 60])).dominant).toBe(
      "READY_TO_SCALE"
    );
  });

  it("Governança de papel: política alta, comitê e controle de acesso baixos (sinais de pergunta)", () => {
    const p = assessReadiness(read([50, 50, 50, 50, 50]), {
      governancePolicy: 85,
      governanceCommittee: 20,
      governanceAccessControl: 25,
    });
    expect(p.dominant).toBe("PAPER_GOVERNANCE");
  });

  it("Campeão isolado: Pessoas baixo na pergunta de distribuição", () => {
    const p = assessReadiness(read([50, 50, 50, 50, 50]), {
      peopleDistribution: 20,
    });
    expect(p.dominant).toBe("ISOLATED_CHAMPION");
  });

  it("Campeão isolado: Pessoas com confiança < 0,6, sem sinal de pergunta", () => {
    const p = assessReadiness(read([50, 50, 50, 50, 50], { PEOPLE: 0.5 }));
    expect(p.dominant).toBe("ISOLATED_CHAMPION");
  });

  it("sem sinal de pergunta, Governança de papel e distribuição não disparam", () => {
    const p = assessReadiness(read([50, 50, 50, 50, 50]));
    expect(p.dominant).toBeNull();
    expect(p.secondary).toBeNull();
  });

  it("perfil misto sem padrão nem traço: sem arquétipo dominante", () => {
    expect(assessReadiness(read([45, 65, 30, 55, 70])).dominant).toBeNull();
  });
});

describe("dominante + traço secundário", () => {
  it("os cinco padrões de score são mutuamente exclusivos (nunca dois dominantes)", () => {
    // Varre uma grade de perfis; nenhum pode satisfazer dois padrões de score.
    const valores = [10, 35, 40, 59, 60, 85];
    let casos = 0;
    for (const d of valores)
      for (const pr of valores)
        for (const pe of valores)
          for (const g of valores)
            for (const i of valores) {
              const p = assessReadiness(read([d, pr, pe, g, i]));
              casos += 1;
              // `dominant` é único por construção; aqui provamos que a
              // detecção por score encontra no máximo um.
              expect(p.scorePatternMatches.length).toBeLessThanOrEqual(1);
            }
    expect(casos).toBe(valores.length ** 5);
  });

  it("padrão de score domina e o traço vira secundário", () => {
    const p = assessReadiness(read([30, 50, 45, 20, 35]), {
      peopleDistribution: 10,
    });
    expect(p.dominant).toBe("PILOT_NO_GROUND");
    expect(p.secondary).toBe("ISOLATED_CHAMPION");
  });

  it("sem padrão de score, o traço de maior prioridade domina e o outro é secundário", () => {
    const p = assessReadiness(read([50, 50, 50, 50, 50]), {
      peopleDistribution: 10,
      governancePolicy: 90,
      governanceCommittee: 10,
      governanceAccessControl: 10,
    });
    expect(p.dominant).toBe("ISOLATED_CHAMPION");
    expect(p.secondary).toBe("PAPER_GOVERNANCE");
  });

  it("um padrão sem traço não tem secundário", () => {
    expect(assessReadiness(read([10, 20, 30, 39, 5])).secondary).toBeNull();
  });
});

describe("caso Atlas (briefing §6)", () => {
  // Dados 32 (0,72) · Processo 58 (0,65) · Pessoas 47 (0,55) ·
  // Governança 41 (0,61) · Infra 36 (0,80)
  const atlas: AxisReading[] = [
    { axis: "DATA", score: 32, confidence: 0.72 },
    { axis: "PROCESS", score: 58, confidence: 0.65 },
    { axis: "PEOPLE", score: 47, confidence: 0.55 },
    { axis: "GOVERNANCE", score: 41, confidence: 0.61 },
    { axis: "INFRASTRUCTURE", score: 36, confidence: 0.8 },
  ];

  it("Piloto sem chão com traço de Campeão isolado", () => {
    const p = assessReadiness(atlas);
    expect(p.dominant).toBe("PILOT_NO_GROUND");
    expect(p.secondary).toBe("ISOLATED_CHAMPION");
    expect(ARCHETYPE_LABEL[p.dominant as keyof typeof ARCHETYPE_LABEL]).toBe(
      "Piloto sem chão"
    );
  });

  it("faixas por eixo, com Pessoas marcada como não confiável", () => {
    const p = assessReadiness(atlas);
    const byAxis = Object.fromEntries(p.axes.map((a) => [a.axis, a.display]));
    expect(byAxis).toEqual({
      DATA: "Inicial",
      PROCESS: "Em formação",
      PEOPLE: "Em formação",
      GOVERNANCE: "Em formação",
      INFRASTRUCTURE: "Inicial",
    });
    // Só Pessoas leva a marca; a faixa dela segue sendo Em formação.
    const marks = Object.fromEntries(
      p.axes.map((a) => [a.axis, a.unreliableMark])
    );
    expect(marks).toEqual({
      DATA: null,
      PROCESS: null,
      PEOPLE: "Não confiável",
      GOVERNANCE: null,
      INFRASTRUCTURE: null,
    });
    expect(p.unreliableAxes).toEqual(["PEOPLE"]);
  });
});

describe("entradas incompletas", () => {
  it("menos de cinco eixos: faixas dos que existem, sem arquétipo", () => {
    const p = assessReadiness(read([70, 70, 70, 70, 70]).slice(0, 3));
    expect(p.axes).toHaveLength(3);
    expect(p.dominant).toBeNull();
    expect(p.secondary).toBeNull();
  });

  it("a saída segue a ordem canônica dos eixos, não a da entrada", () => {
    const embaralhado = [...read([10, 20, 30, 40, 50])].reverse();
    expect(assessReadiness(embaralhado).axes.map((a) => a.axis)).toEqual([
      "DATA",
      "PROCESS",
      "PEOPLE",
      "GOVERNANCE",
      "INFRASTRUCTURE",
    ]);
  });

  it("não muta a entrada", () => {
    const entrada = read([10, 20, 30, 40, 50]);
    const copia = JSON.stringify(entrada);
    assessReadiness(entrada);
    expect(JSON.stringify(entrada)).toBe(copia);
  });
});

// Decisões do Norte (briefing do Andaime): os sinais saem das respostas,
// presos aos códigos da bateria v3.2, no score normalizado da pergunta.
describe("signalsFromAnswers — sinais de pergunta a partir das respostas", () => {
  it("os códigos são os da bateria v3.2", () => {
    expect(SIGNAL_CODES).toEqual({
      peopleDistribution: "Q-E03",
      governancePolicy: "Q-G01",
      governanceCommittee: "Q-G02",
      governanceAccessControl: "Q-G03",
    });
  });

  it("vira 0–100 a partir do normalizado 0–1, pela média dos respondentes", () => {
    const s = signalsFromAnswers([
      { questionCode: "Q-E03", normalized: 0.25 },
      { questionCode: "Q-E03", normalized: 0.75 },
      { questionCode: "Q-G01", normalized: 1 },
    ]);
    expect(s.peopleDistribution).toBe(50);
    expect(s.governancePolicy).toBe(100);
  });

  it("pergunta sem resposta fica sem sinal (não vira zero)", () => {
    const s = signalsFromAnswers([{ questionCode: "Q-E03", normalized: 0.1 }]);
    expect(s.peopleDistribution).toBe(10);
    expect("governancePolicy" in s).toBe(false);
    expect("governanceCommittee" in s).toBe(false);
  });

  it("ignora respostas de outros códigos", () => {
    const s = signalsFromAnswers([
      { questionCode: "Q-D01", normalized: 0 },
      { questionCode: "Q-E01", normalized: 0 },
    ]);
    expect(s).toEqual({});
  });

  it("template sem os códigos (lista vazia): sem sinais, nada dispara nem quebra", () => {
    const signals = signalsFromAnswers([]);
    expect(signals).toEqual({});
    const p = assessReadiness(read([50, 50, 50, 50, 50]), signals);
    expect(p.dominant).toBeNull();
    expect(p.secondary).toBeNull();
  });

  it("Campeão isolado dispara com Q-E03 baixa (< 40) e não com 40", () => {
    const baixa = assessReadiness(
      read([50, 50, 50, 50, 50]),
      signalsFromAnswers([{ questionCode: "Q-E03", normalized: 0.39 }])
    );
    expect(baixa.dominant).toBe("ISOLATED_CHAMPION");
    const limite = assessReadiness(
      read([50, 50, 50, 50, 50]),
      signalsFromAnswers([{ questionCode: "Q-E03", normalized: 0.4 }])
    );
    expect(limite.dominant).toBeNull();
  });

  it("Governança de papel: Q-G01 alta (≥ 60), Q-G02 e Q-G03 baixas (< 40)", () => {
    const answers = (g1: number, g2: number, g3: number) => [
      { questionCode: "Q-G01", normalized: g1 },
      { questionCode: "Q-G02", normalized: g2 },
      { questionCode: "Q-G03", normalized: g3 },
    ];
    const dispara = assessReadiness(
      read([50, 50, 50, 50, 50]),
      signalsFromAnswers(answers(0.6, 0.39, 0.0))
    );
    expect(dispara.dominant).toBe("PAPER_GOVERNANCE");
    // Política em 59: não é alta.
    expect(
      assessReadiness(
        read([50, 50, 50, 50, 50]),
        signalsFromAnswers(answers(0.59, 0, 0))
      ).dominant
    ).toBeNull();
    // Comitê em 40: não é baixo.
    expect(
      assessReadiness(
        read([50, 50, 50, 50, 50]),
        signalsFromAnswers(answers(0.9, 0.4, 0))
      ).dominant
    ).toBeNull();
  });

  it("com só parte dos códigos de Governança, Governança de papel não dispara nem quebra", () => {
    const p = assessReadiness(
      read([50, 50, 50, 50, 50]),
      signalsFromAnswers([
        { questionCode: "Q-G01", normalized: 1 },
        { questionCode: "Q-G02", normalized: 0 },
      ])
    );
    expect(p.dominant).toBeNull();
  });

  it("Q-E03 alta não anula o Campeão isolado por confiança de Pessoas < 0,6", () => {
    const p = assessReadiness(
      read([50, 50, 50, 50, 50], { PEOPLE: 0.5 }),
      signalsFromAnswers([{ questionCode: "Q-E03", normalized: 0.9 }])
    );
    expect(p.dominant).toBe("ISOLATED_CHAMPION");
  });

  it("Campeão isolado vem antes de Governança de papel (prioridade do Norte)", () => {
    const p = assessReadiness(
      read([50, 50, 50, 50, 50]),
      signalsFromAnswers([
        { questionCode: "Q-E03", normalized: 0 },
        { questionCode: "Q-G01", normalized: 1 },
        { questionCode: "Q-G02", normalized: 0 },
        { questionCode: "Q-G03", normalized: 0 },
      ])
    );
    expect(p.dominant).toBe("ISOLATED_CHAMPION");
    expect(p.secondary).toBe("PAPER_GOVERNANCE");
  });
});
