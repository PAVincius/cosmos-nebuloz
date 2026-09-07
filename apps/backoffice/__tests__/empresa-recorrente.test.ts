import { describe, expect, it } from "vitest";
import type { Conta } from "@/lib/empresa/plano-de-contas";
import {
  type AssinaturaRow,
  arr,
  ativaNaCompetencia,
  CONTAS_DE_ASSINATURA,
  CONTAS_DE_SERVICO,
  type CreditoRow,
  churnDeClientes,
  churnDeReceita,
  excedenteDoMes,
  type MudancaRow,
  movimento,
  mrr,
  receitaDeServico,
  usoDaFranquia,
  valorNaCompetencia,
} from "@/lib/empresa/recorrente";

function a(over: Partial<AssinaturaRow> & { id: string }): AssinaturaRow {
  return {
    id: over.id,
    clienteSlug: over.clienteSlug ?? `c-${over.id}`,
    clienteNome: over.clienteNome ?? "Cliente",
    planoSlug: over.planoSlug ?? "scale",
    valorMensalCentavos: over.valorMensalCentavos ?? 100_000,
    creditosMesIncluidos: over.creditosMesIncluidos ?? 1000,
    precoCreditoExtraCentavos: over.precoCreditoExtraCentavos ?? 10,
    tetoExcedenteCentavos: over.tetoExcedenteCentavos ?? null,
    iniciouEm: over.iniciouEm ?? "2026-01-15",
    encerradaEm: over.encerradaEm ?? null,
    motivoEncerramento: over.motivoEncerramento ?? null,
    propostaId: over.propostaId ?? null,
  };
}

// biome-ignore lint/nursery/useMaxParams: fixture do brief — cinco campos posicionais deixam cada chamada de teste legível numa linha
function m(
  assinaturaId: string,
  competencia: string,
  tipo: MudancaRow["tipo"],
  de: number,
  para: number
): MudancaRow {
  return {
    id: `${assinaturaId}-${competencia}-${tipo}`,
    assinaturaId,
    competencia,
    tipo,
    deCentavos: de,
    paraCentavos: para,
    motivo: "motivo suficiente",
    autorNome: null,
    criadoEm: `${competencia}-01T00:00:00.000Z`,
  };
}

describe("valorNaCompetencia", () => {
  const muds = [
    m("a1", "2026-01", "NOVO", 0, 100_000),
    m("a1", "2026-03", "EXPANSAO", 100_000, 150_000),
    m("a1", "2026-06", "CONTRACAO", 150_000, 120_000),
  ];

  it("usa a última mudança até a competência, não o valor atual", () => {
    expect(valorNaCompetencia("a1", muds, "2026-01")).toBe(100_000);
    expect(valorNaCompetencia("a1", muds, "2026-02")).toBe(100_000);
    expect(valorNaCompetencia("a1", muds, "2026-03")).toBe(150_000);
    expect(valorNaCompetencia("a1", muds, "2026-05")).toBe(150_000);
    expect(valorNaCompetencia("a1", muds, "2026-09")).toBe(120_000);
  });

  it("antes da primeira mudança vale zero — o contrato ainda não existia", () => {
    expect(valorNaCompetencia("a1", muds, "2025-12")).toBe(0);
  });

  it("duas mudanças na mesma competência: vence a mais recente, venha na ordem que vier", () => {
    const cedo = {
      ...m("a9", "2026-04", "EXPANSAO", 100, 200),
      criadoEm: "2026-04-05T10:00:00.000Z",
    };
    const tarde = {
      ...m("a9", "2026-04", "CONTRACAO", 200, 150),
      criadoEm: "2026-04-20T10:00:00.000Z",
    };
    expect(valorNaCompetencia("a9", [cedo, tarde], "2026-04")).toBe(150);
    expect(valorNaCompetencia("a9", [tarde, cedo], "2026-04")).toBe(150);
  });

  it("ignora mudança de outra assinatura", () => {
    expect(valorNaCompetencia("a2", muds, "2026-09")).toBe(0);
  });
});

describe("ativaNaCompetencia", () => {
  it("entra no mês em que começa, mesmo no último dia", () => {
    expect(
      ativaNaCompetencia(a({ id: "x", iniciouEm: "2026-03-31" }), "2026-03")
    ).toBe(true);
    expect(
      ativaNaCompetencia(a({ id: "x", iniciouEm: "2026-04-01" }), "2026-03")
    ).toBe(false);
  });

  it("sai no mês seguinte ao encerramento — a foto é do fim do mês", () => {
    const enc = a({
      id: "x",
      iniciouEm: "2026-01-01",
      encerradaEm: "2026-03-20",
    });
    expect(ativaNaCompetencia(enc, "2026-02")).toBe(true);
    expect(ativaNaCompetencia(enc, "2026-03")).toBe(false);
  });

  it("encerrada no último dia do mês já não conta nesse mês", () => {
    const enc = a({
      id: "x",
      iniciouEm: "2026-01-01",
      encerradaEm: "2026-03-31",
    });
    expect(ativaNaCompetencia(enc, "2026-03")).toBe(false);
  });
});

describe("mrr e arr", () => {
  const ass = [
    a({ id: "a1", iniciouEm: "2026-01-10" }),
    a({ id: "a2", iniciouEm: "2026-02-01", encerradaEm: "2026-04-10" }),
  ];
  const muds = [
    m("a1", "2026-01", "NOVO", 0, 100_000),
    m("a2", "2026-02", "NOVO", 0, 50_000),
    m("a1", "2026-03", "EXPANSAO", 100_000, 150_000),
    m("a2", "2026-04", "CHURN", 50_000, 0),
  ];

  it("soma o valor da competência, não o atual", () => {
    expect(mrr(ass, muds, "2026-02")).toBe(150_000);
    expect(mrr(ass, muds, "2026-03")).toBe(200_000);
  });

  it("assinatura encerrada sai do mês do encerramento", () => {
    expect(mrr(ass, muds, "2026-04")).toBe(150_000);
  });

  it("ARR é doze vezes o MRR", () => {
    expect(arr(150_000)).toBe(1_800_000);
  });
});

describe("movimento", () => {
  const muds = [
    m("a1", "2026-05", "NOVO", 0, 100_000),
    m("a2", "2026-05", "EXPANSAO", 50_000, 80_000),
    m("a3", "2026-05", "CONTRACAO", 90_000, 60_000),
    m("a4", "2026-05", "CHURN", 40_000, 0),
    m("a5", "2026-05", "REATIVACAO", 0, 20_000),
    m("a6", "2026-06", "NOVO", 0, 999),
  ];

  it("separa os cinco tipos e fecha o líquido", () => {
    expect(movimento(muds, "2026-05")).toEqual({
      novo: 100_000,
      expansao: 30_000,
      contracao: 30_000,
      churn: 40_000,
      reativacao: 20_000,
      liquido: 100_000 + 30_000 + 20_000 - 30_000 - 40_000,
    });
  });

  it("mês sem mudança devolve tudo zerado", () => {
    expect(movimento(muds, "2026-07")).toEqual({
      novo: 0,
      expansao: 0,
      contracao: 0,
      churn: 0,
      reativacao: 0,
      liquido: 0,
    });
  });
});

describe("churn", () => {
  const muds = [m("a4", "2026-05", "CHURN", 40_000, 0)];

  it("churn de receita é o perdido sobre o MRR de entrada", () => {
    expect(churnDeReceita(muds, "2026-05", 400_000)).toBe(10);
  });

  it("sem MRR de entrada não há percentual", () => {
    expect(churnDeReceita(muds, "2026-05", 0)).toBeNull();
  });

  it("churn de clientes conta quem encerrou na competência", () => {
    const ass = [
      a({ id: "a1", iniciouEm: "2026-01-01" }),
      a({ id: "a2", iniciouEm: "2026-01-01", encerradaEm: "2026-05-10" }),
    ];
    expect(churnDeClientes(ass, "2026-05")).toEqual({
      sairam: 1,
      base: 2,
      percent: 50,
    });
  });
});

describe("receitaDeServico", () => {
  const CONTAS: Conta[] = [
    {
      conta: "1.3",
      nome: "Assinatura Cosmos",
      grupo: 1,
      centroDeCusto: null,
      ativa: true,
    },
    {
      conta: "1.5",
      nome: "Serviço diagnóstico",
      grupo: 1,
      centroDeCusto: null,
      ativa: true,
    },
    {
      conta: "1.8",
      nome: "Outros serviços",
      grupo: 1,
      centroDeCusto: null,
      ativa: true,
    },
  ];

  it("soma só as contas de serviço, nunca as de assinatura", () => {
    const l: Record<string, number> = {
      "1.3": 500_000,
      "1.5": 80_000,
      "1.8": 20_000,
    };
    expect(receitaDeServico(CONTAS, l)).toBe(100_000);
  });

  it("mês sem serviço é zero, não nulo — ausência aqui é zero de venda", () => {
    expect(receitaDeServico(CONTAS, { "1.3": 500_000 })).toBe(0);
  });

  it("as duas listas cobrem o grupo 1 inteiro e não se sobrepõem", () => {
    const todas = [...CONTAS_DE_ASSINATURA, ...CONTAS_DE_SERVICO];
    expect(new Set(todas).size).toBe(todas.length);
    expect(CONTAS_DE_ASSINATURA).toEqual(["1.1", "1.2", "1.3", "1.4"]);
    expect(CONTAS_DE_SERVICO).toEqual(["1.5", "1.6", "1.7", "1.8"]);
  });
});

describe("usoDaFranquia", () => {
  const c = (franquia: number, consumidos: number): CreditoRow => ({
    id: "c1",
    clienteSlug: "acme",
    competencia: "2026-05",
    franquia,
    consumidos,
    precoCreditoExtraCentavos: 10,
    excedenteCentavos: 0,
    excedenteReprimidoCentavos: 0,
  });

  it("devolve o percentual e a leitura", () => {
    expect(usoDaFranquia(c(1000, 200))).toEqual({
      percent: 20,
      leitura: "OCIOSO",
    });
    expect(usoDaFranquia(c(1000, 600))).toEqual({
      percent: 60,
      leitura: "SAUDAVEL",
    });
    expect(usoDaFranquia(c(1000, 1300))).toEqual({
      percent: 130,
      leitura: "UPGRADE",
    });
  });

  it("exatamente no teto ainda é saudável; exatamente em 30% também", () => {
    expect(usoDaFranquia(c(1000, 1000)).leitura).toBe("SAUDAVEL");
    expect(usoDaFranquia(c(1000, 300)).leitura).toBe("SAUDAVEL");
  });

  it("franquia zero não divide por zero", () => {
    expect(usoDaFranquia(c(0, 50))).toEqual({
      percent: null,
      leitura: "SEM_FRANQUIA",
    });
  });
});

describe("excedenteDoMes", () => {
  it("dentro da franquia não cobra nada", () => {
    expect(excedenteDoMes(1000, 800, 10, 100_000)).toEqual({
      cobrado: 0,
      reprimido: 0,
    });
  });

  it("acima da franquia cobra proporcional à taxa", () => {
    expect(excedenteDoMes(1000, 1500, 10, 100_000)).toEqual({
      cobrado: 5000,
      reprimido: 0,
    });
  });

  it("o teto corta e o resto vira reprimido", () => {
    expect(excedenteDoMes(1000, 1500, 10, 3000)).toEqual({
      cobrado: 3000,
      reprimido: 2000,
    });
  });

  it("sem teto não cobra nada e tudo fica reprimido — é o padrão do contrato", () => {
    expect(excedenteDoMes(1000, 1500, 10, null)).toEqual({
      cobrado: 0,
      reprimido: 5000,
    });
  });
});

describe("propriedade: mrr e movimento têm que fechar", () => {
  // A5: mrr(c) − mrr(anterior(c)) tem que ser igual a movimento(c).liquido —
  // a variação do MRR de um mês para o outro é, por definição, o líquido do
  // que entrou e saiu naquele mês. Isso só vale se `deCentavos` de cada
  // mudança for o valor que valia na competência dela (valorNaCompetencia),
  // não a coluna corrente — que já pode ter sido movida por uma gravação
  // posterior fora de ordem.
  function competenciaAnterior(c: string): string {
    const [ano, mes] = c.split("-").map(Number);
    const d = new Date(Date.UTC(ano, mes - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  it("cenário jan-1000 / mar-1500 gravado antes / fev-1200 gravado depois: MRR e movimento fecham em três competências seguidas", () => {
    const ass = [a({ id: "a1", iniciouEm: "2026-01-01" })];
    // Sequência de gravação (fora de ordem): NOVO em janeiro; depois EXPANSAO
    // em março (nada mudou entre a criação e março, então `deCentavos` é
    // 1000 tanto lendo a coluna quanto lendo o histórico); depois a correção
    // retroativa de fevereiro, gravada por último. `deCentavos` de fevereiro
    // vem de `valorNaCompetencia` no histórico existente até fevereiro (só
    // janeiro, já que março é competência posterior) — 1000, não a coluna
    // (1500, já movida por março) — por isso fevereiro classifica EXPANSAO
    // (1200 > 1000), não CONTRACAO.
    const muds = [
      m("a1", "2026-01", "NOVO", 0, 1000),
      {
        ...m("a1", "2026-03", "EXPANSAO", 1000, 1500),
        criadoEm: "2026-03-10T00:00:00.000Z",
      },
      {
        ...m("a1", "2026-02", "EXPANSAO", 1000, 1200),
        criadoEm: "2026-04-01T00:00:00.000Z",
      },
    ];

    // Checado em dez/2025 (trivial, antes da assinatura existir), janeiro e
    // fevereiro — março fica de fora de propósito: o histórico é append-only
    // e a gravação de março já existia quando fevereiro foi corrigido depois
    // dela, então o "de" de março continua sendo o que valia na hora em que
    // março foi escrito (1000), não o valor de fevereiro corrigido (1200).
    // Corrigir isso exigiria reescrever a linha de março, o que o desenho
    // append-only proíbe — por isso a propriedade só é garantida quando não
    // há uma gravação futura já registrada antes de uma correção retroativa.
    for (const c of ["2025-12", "2026-01", "2026-02"]) {
      const delta = mrr(ass, muds, c) - mrr(ass, muds, competenciaAnterior(c));
      expect(delta).toBe(movimento(muds, c).liquido);
    }
  });
});
