import { describe, expect, it } from "vitest";
import { calcularDre } from "@/lib/empresa/financeiro";
import {
  agregarPorMes,
  envelhecimento,
  type LinhaDoLivro,
  situacaoDoTitulo,
  type TituloRow,
} from "@/lib/empresa/livro";
import type { Conta } from "@/lib/empresa/plano-de-contas";

function linha(
  over: Partial<LinhaDoLivro> & { conta: string; valorCentavos: number }
): LinhaDoLivro {
  return {
    id: over.id ?? `${over.conta}-${over.valorCentavos}`,
    competencia: over.competencia ?? "2026-09",
    data: over.data ?? "2026-09-10",
    conta: over.conta,
    descricao: over.descricao ?? "x",
    valorCentavos: over.valorCentavos,
    contraparte: over.contraparte ?? null,
    documento: over.documento ?? null,
    nota: over.nota ?? null,
    tituloId: over.tituloId ?? null,
  };
}

describe("agregarPorMes", () => {
  it("soma as linhas da mesma conta e competência", () => {
    const r = agregarPorMes([
      linha({ conta: "4.1", valorCentavos: 100 }),
      linha({ conta: "4.1", valorCentavos: 250 }),
      linha({ conta: "1.1", valorCentavos: 1000 }),
    ]);
    expect(r["2026-09"]).toEqual({ "4.1": 350, "1.1": 1000 });
  });

  it("separa competências", () => {
    const r = agregarPorMes([
      linha({ conta: "4.1", valorCentavos: 100, competencia: "2026-08" }),
      linha({ conta: "4.1", valorCentavos: 5, competencia: "2026-09" }),
    ]);
    expect(r["2026-08"]).toEqual({ "4.1": 100 });
    expect(r["2026-09"]).toEqual({ "4.1": 5 });
  });

  it("conta sem linha fica ausente, não zero — é o que preserva o nulo do DRE", () => {
    const r = agregarPorMes([linha({ conta: "1.1", valorCentavos: 10 })]);
    expect(r["2026-09"]["4.1"]).toBeUndefined();
    expect("4.1" in r["2026-09"]).toBe(false);
  });

  it("sem linhas devolve objeto vazio", () => {
    expect(agregarPorMes([])).toEqual({});
  });
});

describe("DRE por linhas dá o mesmo número que o DRE por valor mensal", () => {
  const CONTAS: Conta[] = [
    {
      conta: "1.1",
      nome: "Assinaturas",
      grupo: 1,
      centroDeCusto: null,
      ativa: true,
    },
    {
      conta: "2.1",
      nome: "Impostos",
      grupo: 2,
      centroDeCusto: null,
      ativa: true,
    },
    { conta: "3.1", nome: "Infra", grupo: 3, centroDeCusto: null, ativa: true },
    {
      conta: "4.1",
      nome: "Mídia",
      grupo: 4,
      centroDeCusto: "comercial",
      ativa: true,
    },
    {
      conta: "5.1",
      nome: "Time",
      grupo: 5,
      centroDeCusto: "produto-engenharia",
      ativa: true,
    },
    {
      conta: "6.1",
      nome: "Contador",
      grupo: 6,
      centroDeCusto: "ga",
      ativa: true,
    },
  ];
  const MENSAL = {
    "1.1": 100_000,
    "2.1": 10_000,
    "3.1": 20_000,
    "4.1": 15_000,
    "5.1": 30_000,
    "6.1": 5000,
  };

  it("mesma entrada, mesma saída, linha a linha", () => {
    const porLinhas = agregarPorMes([
      linha({ conta: "1.1", valorCentavos: 60_000 }),
      linha({ conta: "1.1", valorCentavos: 40_000 }),
      linha({ conta: "2.1", valorCentavos: 10_000 }),
      linha({ conta: "3.1", valorCentavos: 20_000 }),
      linha({ conta: "4.1", valorCentavos: 15_000 }),
      linha({ conta: "5.1", valorCentavos: 12_000 }),
      linha({ conta: "5.1", valorCentavos: 18_000 }),
      linha({ conta: "6.1", valorCentavos: 5000 }),
    ])["2026-09"];
    expect(calcularDre(CONTAS, porLinhas)).toEqual(calcularDre(CONTAS, MENSAL));
  });
});

describe("situacaoDoTitulo", () => {
  const hoje = new Date("2026-09-15T12:00:00Z");
  const t = (over: Partial<TituloRow>): TituloRow => ({
    id: "t1",
    tipo: "PAGAR",
    descricao: "x",
    contraparte: "y",
    conta: "6.1",
    valorCentavos: 100,
    emissao: "2026-09-01",
    vencimento: "2026-09-20",
    status: "ABERTO",
    baixadoEm: null,
    competenciaBaixa: null,
    motivoCancelamento: null,
    clienteSlug: null,
    ...over,
  });

  it("aberto e a vencer", () => {
    expect(situacaoDoTitulo(t({}), hoje)).toBe("ABERTO");
  });
  it("aberto e vencimento passado é VENCIDO", () => {
    expect(situacaoDoTitulo(t({ vencimento: "2026-09-14" }), hoje)).toBe(
      "VENCIDO"
    );
  });
  it("vence hoje ainda não é vencido", () => {
    expect(situacaoDoTitulo(t({ vencimento: "2026-09-15" }), hoje)).toBe(
      "ABERTO"
    );
  });
  it("baixado e cancelado passam direto", () => {
    expect(
      situacaoDoTitulo(t({ status: "BAIXADO", vencimento: "2026-01-01" }), hoje)
    ).toBe("BAIXADO");
    expect(
      situacaoDoTitulo(
        t({ status: "CANCELADO", vencimento: "2026-01-01" }),
        hoje
      )
    ).toBe("CANCELADO");
  });
});

describe("envelhecimento", () => {
  const hoje = new Date("2026-09-15T12:00:00Z");
  const t = (
    vencimento: string,
    valorCentavos: number,
    status: TituloRow["status"] = "ABERTO"
  ): TituloRow => ({
    id: vencimento + valorCentavos,
    tipo: "PAGAR",
    descricao: "x",
    contraparte: "y",
    conta: "6.1",
    valorCentavos,
    emissao: "2026-01-01",
    vencimento,
    status,
    baixadoEm: null,
    competenciaBaixa: null,
    motivoCancelamento: null,
    clienteSlug: null,
  });

  it("distribui nas cinco faixas e ignora baixado e cancelado", () => {
    const faixas = envelhecimento(
      [
        t("2026-09-30", 10), // a vencer
        t("2026-09-01", 20), // 14 d: 1–30
        t("2026-08-01", 30), // 45 d: 31–60
        t("2026-07-10", 40), // 67 d: 61–90
        t("2026-05-01", 50), // 137 d: 90+
        t("2026-05-01", 999, "BAIXADO"),
        t("2026-05-01", 999, "CANCELADO"),
      ],
      hoje
    );
    expect(faixas.map((f) => [f.id, f.valorCentavos, f.quantidade])).toEqual([
      ["a-vencer", 10, 1],
      ["1-30", 20, 1],
      ["31-60", 30, 1],
      ["61-90", 40, 1],
      ["90-mais", 50, 1],
    ]);
  });

  it("limites: 30 dias é 1–30, 31 é 31–60", () => {
    const faixas = envelhecimento(
      [t("2026-08-16", 1), t("2026-08-15", 2)],
      hoje
    );
    expect(faixas.find((f) => f.id === "1-30")?.valorCentavos).toBe(1);
    expect(faixas.find((f) => f.id === "31-60")?.valorCentavos).toBe(2);
  });
});
