// funil.test.ts — regras puras do funil v2 (spec §2, design backoffice-funnel.jsx
// e backoffice-funnel-stage.jsx). Sem Prisma, sem I/O: fixa os números, não só
// "maior que zero" — é a mesma conta que sustenta o pipeline ponderado e o
// painel do estágio.
import { describe, expect, it } from "vitest";
import {
  ABERTOS,
  type ConfigEstagio,
  cacSobreAcvGanho,
  diasNoEstagio,
  estagnado,
  type LeadFunil,
  metricasDoEstagio,
  pipelinePonderado,
  podeConverter,
  podeMover,
  proximoEstagio,
  situacaoDe,
  type Transicao,
  taxaLeadParaProposta,
  valorDoLead,
} from "../lib/comercial/funil";

const CFG: ConfigEstagio[] = [
  { codigo: "LEAD", pesoPercent: 10, tetoDias: 7, criterios: [] },
  { codigo: "DISCOVERY", pesoPercent: 30, tetoDias: 14, criterios: [] },
  { codigo: "EVALUATION", pesoPercent: 60, tetoDias: 21, criterios: [] },
  { codigo: "PROPOSAL", pesoPercent: 80, tetoDias: 30, criterios: [] },
];

const lead = (overrides: Partial<LeadFunil> = {}): LeadFunil => ({
  id: "L-1",
  estagio: "DISCOVERY",
  estagioDesde: "2026-08-01T00:00:00Z",
  situacao: "ATIVO",
  acvEstimadoCentavos: null,
  proposta: null,
  entrada: null,
  canalSlug: null,
  perdidoNoEstagio: null,
  ...overrides,
});

describe("situacaoDe", () => {
  it("proposta ACEITA vira GANHO", () => {
    expect(situacaoDe(null, "ACEITA")).toBe("GANHO");
  });

  it("proposta RECUSADA vira PERDIDO", () => {
    expect(situacaoDe(null, "RECUSADA")).toBe("PERDIDO");
  });

  it("perdidoEm preenchido vira PERDIDO mesmo sem proposta", () => {
    expect(situacaoDe("2026-08-01T00:00:00Z", null)).toBe("PERDIDO");
  });

  it("sem perda e sem proposta decidida, fica ATIVO", () => {
    expect(situacaoDe(null, null)).toBe("ATIVO");
    expect(situacaoDe(null, "ENVIADA")).toBe("ATIVO");
  });
});

describe("diasNoEstagio", () => {
  it("conta dias inteiros entre estagioDesde e hoje", () => {
    const dias = diasNoEstagio(
      "2026-08-01T00:00:00Z",
      new Date("2026-08-06T00:00:00Z")
    );
    expect(dias).toBe(5);
  });

  it("fronteira UTC: menos de 24h mas cruzando a meia-noite UTC conta 1 dia", () => {
    const dias = diasNoEstagio(
      "2026-09-01T23:00:00Z",
      new Date("2026-09-02T01:00:00Z")
    );
    expect(dias).toBe(1);
  });

  it("mesmo dia UTC conta 0", () => {
    const dias = diasNoEstagio(
      "2026-09-01T02:00:00Z",
      new Date("2026-09-01T23:00:00Z")
    );
    expect(dias).toBe(0);
  });
});

describe("estagnado", () => {
  const hoje = new Date("2026-08-20T00:00:00Z");

  it("ativo e acima do teto do estágio: estagnado", () => {
    const l = lead({
      estagio: "DISCOVERY",
      estagioDesde: "2026-08-01T00:00:00Z",
    });
    expect(estagnado(l, CFG, hoje)).toBe(true);
  });

  it("ativo e dentro do teto: não estagnado", () => {
    const l = lead({
      estagio: "DISCOVERY",
      estagioDesde: "2026-08-15T00:00:00Z",
    });
    expect(estagnado(l, CFG, hoje)).toBe(false);
  });

  it("perdido acima do teto não conta como estagnado", () => {
    const l = lead({
      estagio: "DISCOVERY",
      estagioDesde: "2026-08-01T00:00:00Z",
      situacao: "PERDIDO",
      perdidoNoEstagio: "DISCOVERY",
    });
    expect(estagnado(l, CFG, hoje)).toBe(false);
  });
});

describe("valorDoLead", () => {
  it("com proposta, o ACV da proposta vence a estimativa", () => {
    const l = lead({
      acvEstimadoCentavos: 10_000,
      proposta: { acvCentavos: 50_000, status: "ENVIADA" },
    });
    expect(valorDoLead(l)).toBe(50_000);
  });

  it("sem proposta, usa a estimativa", () => {
    const l = lead({ acvEstimadoCentavos: 10_000, proposta: null });
    expect(valorDoLead(l)).toBe(10_000);
  });

  it("sem proposta e sem estimativa, zero", () => {
    const l = lead({ acvEstimadoCentavos: null, proposta: null });
    expect(valorDoLead(l)).toBe(0);
  });
});

describe("pipelinePonderado", () => {
  it("soma o valor ponderado pelo peso do estágio, só dos ativos", () => {
    const leads: LeadFunil[] = [
      lead({ id: "L-1", estagio: "DISCOVERY", acvEstimadoCentavos: 100_000 }), // 30% -> 30_000
      lead({
        id: "L-2",
        estagio: "EVALUATION",
        proposta: { acvCentavos: 200_000, status: "ENVIADA" },
      }), // 60% -> 120_000
      lead({
        id: "L-3",
        estagio: "DISCOVERY",
        acvEstimadoCentavos: 999_999,
        situacao: "PERDIDO",
        perdidoNoEstagio: "DISCOVERY",
      }), // fora, não conta
    ];
    expect(pipelinePonderado(leads, CFG)).toBe(30_000 + 120_000);
  });
});

describe("taxaLeadParaProposta", () => {
  it("conta quem chegou em PROPOSAL, ganhou, ou perdeu em PROPOSAL", () => {
    const leads: LeadFunil[] = [
      lead({ id: "L-1", estagio: "LEAD" }),
      lead({ id: "L-2", estagio: "PROPOSAL" }),
      lead({
        id: "L-3",
        estagio: "PROPOSAL",
        situacao: "GANHO",
        proposta: { acvCentavos: 1, status: "ACEITA" },
      }),
      lead({
        id: "L-4",
        estagio: "PROPOSAL",
        situacao: "PERDIDO",
        perdidoNoEstagio: "PROPOSAL",
      }),
      lead({
        id: "L-5",
        estagio: "DISCOVERY",
        situacao: "PERDIDO",
        perdidoNoEstagio: "DISCOVERY",
      }),
    ];
    const r = taxaLeadParaProposta(leads);
    expect(r).toEqual({ alcancaram: 3, total: 5, percent: 60 });
  });

  it("sem leads, zero sem dividir por zero", () => {
    expect(taxaLeadParaProposta([])).toEqual({
      alcancaram: 0,
      total: 0,
      percent: 0,
    });
  });
});

describe("cacSobreAcvGanho", () => {
  const canais = [
    { slug: "indicacao", cacMedioCentavos: 0 },
    { slug: "evento", cacMedioCentavos: 4200 },
    { slug: "inbound", cacMedioCentavos: null },
  ];

  it("canal sem medição não soma ao CAC, mas o ACV ganho conta", () => {
    const leads: LeadFunil[] = [
      lead({
        id: "L-1",
        estagio: "PROPOSAL",
        situacao: "GANHO",
        canalSlug: "evento",
        proposta: { acvCentavos: 100_000, status: "ACEITA" },
      }),
      lead({
        id: "L-2",
        estagio: "PROPOSAL",
        situacao: "GANHO",
        canalSlug: "inbound",
        proposta: { acvCentavos: 50_000, status: "ACEITA" },
      }),
    ];
    const r = cacSobreAcvGanho(leads, canais);
    expect(r.acvGanhoCentavos).toBe(150_000);
    expect(r.cacCentavos).toBe(4200);
    expect(r.percent).toBe(Math.round((4200 / 150_000) * 100));
  });

  it("sem ganho, percent nulo", () => {
    const r = cacSobreAcvGanho([lead({ estagio: "LEAD" })], canais);
    expect(r.acvGanhoCentavos).toBe(0);
    expect(r.percent).toBeNull();
  });

  it("com ganho mas nenhum canal medido, percent nulo", () => {
    const leads: LeadFunil[] = [
      lead({
        id: "L-1",
        estagio: "PROPOSAL",
        situacao: "GANHO",
        canalSlug: "inbound",
        proposta: { acvCentavos: 50_000, status: "ACEITA" },
      }),
    ];
    const r = cacSobreAcvGanho(leads, canais);
    expect(r.percent).toBeNull();
  });
});

describe("metricasDoEstagio", () => {
  // Histórico sintético: 3 leads entram em DISCOVERY dentro da janela de 90 d
  // a partir de hoje (2026-09-06) — um avança para EVALUATION em 5 d, um é
  // perdido em 5 d, um continua no estágio. Um quarto lead entra fora da
  // janela e deve ser ignorado por completo.
  const hoje = new Date("2026-09-06T12:00:00Z");
  const historico: Transicao[] = [
    {
      leadId: "L-1",
      de: "LEAD",
      para: "DISCOVERY",
      em: "2026-08-01T00:00:00Z",
    },
    {
      leadId: "L-1",
      de: "DISCOVERY",
      para: "EVALUATION",
      em: "2026-08-06T00:00:00Z",
    },

    {
      leadId: "L-2",
      de: "LEAD",
      para: "DISCOVERY",
      em: "2026-08-10T00:00:00Z",
    },
    {
      leadId: "L-2",
      de: "DISCOVERY",
      para: "PERDIDO",
      em: "2026-08-15T00:00:00Z",
    },

    {
      leadId: "L-3",
      de: "LEAD",
      para: "DISCOVERY",
      em: "2026-08-20T00:00:00Z",
    },

    // Fora da janela de 90 d (mais de um ano antes de hoje).
    {
      leadId: "L-4",
      de: "LEAD",
      para: "DISCOVERY",
      em: "2025-01-01T00:00:00Z",
    },
  ];

  it("entraram, avançaram, perdidos e permanência média", () => {
    const r = metricasDoEstagio(historico, "DISCOVERY", hoje, 90);
    expect(r).toEqual({
      entraram: 3,
      avancaram: 1,
      perdidos: 1,
      permanenciaMediaDias: 5,
    });
  });

  it("lead que entrou e não teve transição seguinte não conta na permanência", () => {
    // L-1 entra em EVALUATION em 06 ago e não tem transição seguinte no
    // histórico sintético — ainda está lá.
    const r = metricasDoEstagio(historico, "EVALUATION", hoje, 90);
    expect(r).toEqual({
      entraram: 1,
      avancaram: 0,
      perdidos: 0,
      permanenciaMediaDias: null,
    });
  });

  it("sem nenhuma entrada na janela, tudo zerado e permanência nula", () => {
    const r = metricasDoEstagio(historico, "PROPOSAL", hoje, 90);
    expect(r).toEqual({
      entraram: 0,
      avancaram: 0,
      perdidos: 0,
      permanenciaMediaDias: null,
    });
  });
});

describe("proximoEstagio / podeMover / podeConverter", () => {
  it("encadeia LEAD -> DISCOVERY -> EVALUATION -> PROPOSAL -> null", () => {
    expect(proximoEstagio("LEAD")).toBe("DISCOVERY");
    expect(proximoEstagio("DISCOVERY")).toBe("EVALUATION");
    expect(proximoEstagio("EVALUATION")).toBe("PROPOSAL");
    expect(proximoEstagio("PROPOSAL")).toBeNull();
  });

  it("podeMover exige ativo e estágio entre os abertos", () => {
    expect(podeMover(lead({ estagio: "DISCOVERY", situacao: "ATIVO" }))).toBe(
      true
    );
    expect(podeMover(lead({ estagio: "PROPOSAL", situacao: "ATIVO" }))).toBe(
      false
    );
    expect(
      podeMover(
        lead({
          estagio: "DISCOVERY",
          situacao: "PERDIDO",
          perdidoNoEstagio: "DISCOVERY",
        })
      )
    ).toBe(false);
  });

  it("podeConverter exige ativo e EVALUATION", () => {
    expect(podeConverter(lead({ estagio: "EVALUATION" }))).toBe(true);
    expect(podeConverter(lead({ estagio: "DISCOVERY" }))).toBe(false);
    expect(
      podeConverter(
        lead({
          estagio: "EVALUATION",
          situacao: "PERDIDO",
          perdidoNoEstagio: "EVALUATION",
        })
      )
    ).toBe(false);
  });

  it("ABERTOS não inclui PROPOSAL", () => {
    expect(ABERTOS).toEqual(["LEAD", "DISCOVERY", "EVALUATION"]);
  });
});
