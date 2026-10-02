// empresa-recorrente-action.test.ts — receita recorrente (spec 2026-09-06
// §1.4, §2–§3): MudancaDeAssinatura é append-only e sustenta o MRR histórico
// — criarAssinatura/alterarValor/encerrarAssinatura sempre gravam a
// assinatura e a linha de histórico na mesma `$transaction`.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  assinaturaFindMany: vi.fn(),
  assinaturaFindFirst: vi.fn(),
  assinaturaCreate: vi.fn(),
  assinaturaUpdateMany: vi.fn(),
  mudancaFindMany: vi.fn(),
  mudancaCreate: vi.fn(),
  creditoFindMany: vi.fn(),
  creditoUpsert: vi.fn(),
  lancFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/guard", () => {
  class StaffAuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    requirePlatformStaff: mocks.requirePlatformStaff,
    assertCanWrite: mocks.assertCanWrite,
    SYSTEM_TENANT_ID: "system",
    StaffAuthError,
    semTeto: (fn: () => unknown) => fn(),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    assinaturaDoTenant: {
      findMany: mocks.assinaturaFindMany,
      findFirst: mocks.assinaturaFindFirst,
      create: mocks.assinaturaCreate,
      updateMany: mocks.assinaturaUpdateMany,
    },
    mudancaDeAssinatura: {
      findMany: mocks.mudancaFindMany,
      create: mocks.mudancaCreate,
    },
    creditoDoMes: {
      findMany: mocks.creditoFindMany,
      upsert: mocks.creditoUpsert,
    },
    lancamento: { findMany: mocks.lancFindMany },
    $transaction: mocks.transaction,
  },
}));

import {
  alterarValor,
  criarAssinatura,
  encerrarAssinatura,
  listarRecorrente,
  salvarCreditoDoMes,
} from "../app/actions/empresa/recorrente";
import { CONTAS_DE_SERVICO } from "../lib/empresa/recorrente";

const staff = {
  userId: "u-1",
  name: "V",
  email: "v@nebuloz.ai",
  canWrite: true,
};

/** `$transaction` como em empresa-titulos-action.test.ts: callback recebe o
 *  mesmo objeto de mocks, seja ele chamado `tx` (produção) ou aqui. */
const tx = {
  assinaturaDoTenant: {
    create: mocks.assinaturaCreate,
    updateMany: mocks.assinaturaUpdateMany,
  },
  mudancaDeAssinatura: { create: mocks.mudancaCreate },
};

const ASSINATURA_VALIDA = {
  clienteSlug: "vanta-saude",
  clienteNome: "Vanta Saúde",
  planoSlug: "growth",
  valorMensalCentavos: 500_000,
  creditosMesIncluidos: 100,
  precoCreditoExtraCentavos: 200,
  tetoExcedenteCentavos: 5000,
  iniciouEm: "2026-09-01",
  propostaId: null,
  motivo: "Fechamento do contrato inicial",
};

/** Histórico padrão de "a-1": uma única linha NOVO em janeiro chegando a
 *  500_000 — o mesmo valor que `valorMensalCentavos` tinha antes do fix de
 *  A1, para as asserções de `alterarValor`/`encerrarAssinatura` que dependiam
 *  da coluna continuarem válidas lendo `valorNaCompetencia` no histórico. */
const HISTORICO_A1 = [
  {
    id: "m-hist",
    assinaturaId: "a-1",
    competencia: "2026-01",
    tipo: "NOVO",
    deCentavos: 0,
    paraCentavos: 500_000,
    motivo: "Contrato inicial",
    autorNome: "V",
    criadoEm: new Date("2026-01-05T00:00:00Z"),
  },
];

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.assinaturaFindMany.mockResolvedValue([]);
  mocks.mudancaFindMany.mockResolvedValue(HISTORICO_A1);
  mocks.creditoFindMany.mockResolvedValue([]);
  mocks.lancFindMany.mockResolvedValue([]);
  mocks.assinaturaCreate.mockResolvedValue({ id: "a-1" });
  mocks.assinaturaUpdateMany.mockResolvedValue({ count: 1 });
  mocks.mudancaCreate.mockResolvedValue({ id: "m-1" });
  mocks.creditoUpsert.mockResolvedValue({});
  mocks.assinaturaFindFirst.mockResolvedValue({
    valorMensalCentavos: 500_000,
    creditosMesIncluidos: 100,
    precoCreditoExtraCentavos: 200,
    tetoExcedenteCentavos: 5000,
  });
  mocks.transaction.mockImplementation(
    async (fn: (t: unknown) => Promise<unknown>) => await fn(tx)
  );
}

describe("listarRecorrente", () => {
  beforeEach(resetar);

  it("lê assinaturas, mudanças, créditos e lançamentos, todos com tenantId", async () => {
    const res = await listarRecorrente({ competencia: "2026-09" });
    expect(res.ok).toBe(true);
    expect(mocks.assinaturaFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
    });
    expect(mocks.mudancaFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
    });
    expect(mocks.creditoFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
      competencia: "2026-09",
    });
    expect(mocks.lancFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
      competencia: "2026-09",
      conta: { in: [...CONTAS_DE_SERVICO] },
    });
  });

  it("converte iniciouEm/encerradaEm para ISO e agrega os lançamentos da competência", async () => {
    mocks.assinaturaFindMany.mockResolvedValue([
      {
        id: "a-1",
        clienteSlug: "vanta-saude",
        clienteNome: "Vanta Saúde",
        planoSlug: "growth",
        valorMensalCentavos: 500_000,
        creditosMesIncluidos: 100,
        precoCreditoExtraCentavos: 200,
        tetoExcedenteCentavos: 5000,
        iniciouEm: new Date("2026-09-01T00:00:00Z"),
        encerradaEm: null,
        motivoEncerramento: null,
        propostaId: null,
      },
    ]);
    mocks.lancFindMany.mockResolvedValue([
      { competencia: "2026-09", conta: "1.1", valorCentavos: 500_000 },
      { competencia: "2026-09", conta: "1.5", valorCentavos: 20_000 },
    ]);
    const res = await listarRecorrente({ competencia: "2026-09" });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.assinaturas[0]?.iniciouEm).toBe("2026-09-01");
    expect(res.data.assinaturas[0]?.encerradaEm).toBeNull();
    expect(res.data.lancamentosDaCompetencia).toEqual({
      "1.1": 500_000,
      "1.5": 20_000,
    });
  });
});

describe("criarAssinatura", () => {
  beforeEach(() => {
    resetar();
    // Ao contrário de alterarValor/encerrarAssinatura/salvarCreditoDoMes,
    // criarAssinatura consulta `findFirst` para checar se o cliente já tem
    // assinatura ativa (B4) — sem cliente ativo por padrão, senão toda
    // gravação bem-sucedida deste describe seria recusada.
    mocks.assinaturaFindFirst.mockResolvedValue(null);
  });

  it("grava a assinatura E a linha NOVO do histórico na mesma $transaction", async () => {
    const res = await criarAssinatura(ASSINATURA_VALIDA);
    expect(res.ok).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.assinaturaCreate.mock.calls[0][0].data).toMatchObject({
      tenantId: "system",
      clienteSlug: "vanta-saude",
      valorMensalCentavos: 500_000,
      iniciouEm: new Date("2026-09-01T00:00:00Z"),
    });
    expect(mocks.mudancaCreate.mock.calls[0][0].data).toEqual({
      tenantId: "system",
      assinaturaId: "a-1",
      competencia: "2026-09",
      tipo: "NOVO",
      deCentavos: 0,
      paraCentavos: 500_000,
      motivo: "Fechamento do contrato inicial",
      autorId: "u-1",
      autorNome: "V",
    });
    expect(mocks.logPlatformAudit).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/financeiro");
  });

  it("recusa clienteSlug vazio, valorMensalCentavos <= 0, precoCreditoExtraCentavos < 0 e iniciouEm inválida", async () => {
    expect(
      (await criarAssinatura({ ...ASSINATURA_VALIDA, clienteSlug: "" })).ok
    ).toBe(false);
    expect(
      (
        await criarAssinatura({
          ...ASSINATURA_VALIDA,
          valorMensalCentavos: 0,
        })
      ).ok
    ).toBe(false);
    expect(
      (
        await criarAssinatura({
          ...ASSINATURA_VALIDA,
          precoCreditoExtraCentavos: -1,
        })
      ).ok
    ).toBe(false);
    expect(
      (
        await criarAssinatura({
          ...ASSINATURA_VALIDA,
          iniciouEm: "01-09-2026",
        })
      ).ok
    ).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("MEMBER não cria, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await criarAssinatura(ASSINATURA_VALIDA);
    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("cliente já com assinatura ativa é recusado com erro legível, antes do banco reclamar", async () => {
    mocks.assinaturaFindFirst.mockResolvedValue({ id: "a-0" });
    const res = await criarAssinatura(ASSINATURA_VALIDA);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Cliente já tem assinatura ativa.");
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("alterarValor", () => {
  beforeEach(resetar);

  it("valor maior grava EXPANSAO", async () => {
    const res = await alterarValor({
      id: "a-1",
      valorCentavos: 600_000,
      motivo: "Upgrade de degrau",
      competencia: "2026-10",
    });
    expect(res.ok).toBe(true);
    expect(mocks.mudancaCreate.mock.calls[0][0].data).toMatchObject({
      tipo: "EXPANSAO",
      deCentavos: 500_000,
      paraCentavos: 600_000,
    });
  });

  it("valor menor grava CONTRACAO", async () => {
    const res = await alterarValor({
      id: "a-1",
      valorCentavos: 400_000,
      motivo: "Downgrade de degrau",
      competencia: "2026-10",
    });
    expect(res.ok).toBe(true);
    expect(mocks.mudancaCreate.mock.calls[0][0].data).toMatchObject({
      tipo: "CONTRACAO",
      deCentavos: 500_000,
      paraCentavos: 400_000,
    });
  });

  it("valor igual devolve ok:false sem escrever", async () => {
    const res = await alterarValor({
      id: "a-1",
      valorCentavos: 500_000,
      motivo: "Sem mudança nenhuma",
      competencia: "2026-10",
    });
    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.assinaturaUpdateMany).not.toHaveBeenCalled();
  });

  it("usa updateMany guardado por {id, tenantId, valorMensalCentavos: <o lido>} e trata count === 0 como erro", async () => {
    const res = await alterarValor({
      id: "a-1",
      valorCentavos: 600_000,
      motivo: "Upgrade de degrau",
      competencia: "2026-10",
    });
    expect(res.ok).toBe(true);
    expect(mocks.assinaturaUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "a-1", tenantId: "system", valorMensalCentavos: 500_000 },
      data: { valorMensalCentavos: 600_000 },
    });

    mocks.assinaturaUpdateMany.mockResolvedValue({ count: 0 });
    const res2 = await alterarValor({
      id: "a-1",
      valorCentavos: 600_000,
      motivo: "Upgrade de degrau",
      competencia: "2026-10",
    });
    expect(res2.ok).toBe(false);
    expect(mocks.mudancaCreate).toHaveBeenCalledTimes(1); // só a chamada da 1ª tentativa
  });

  it("competência retroativa (anterior à última já registrada) não avança a coluna — só o create do histórico", async () => {
    mocks.mudancaFindMany.mockResolvedValue([
      {
        id: "m-jan",
        assinaturaId: "a-1",
        competencia: "2026-01",
        tipo: "NOVO",
        deCentavos: 0,
        paraCentavos: 400_000,
        motivo: "Contrato inicial",
        autorNome: "V",
        criadoEm: new Date("2026-01-05T00:00:00Z"),
      },
      {
        id: "m-mai",
        assinaturaId: "a-1",
        competencia: "2026-05",
        tipo: "EXPANSAO",
        deCentavos: 400_000,
        paraCentavos: 700_000,
        motivo: "Upgrade",
        autorNome: "V",
        criadoEm: new Date("2026-05-10T00:00:00Z"),
      },
    ]);
    const res = await alterarValor({
      id: "a-1",
      valorCentavos: 450_000,
      motivo: "Correção retroativa de março",
      competencia: "2026-03",
    });
    expect(res.ok).toBe(true);
    expect(mocks.assinaturaUpdateMany).not.toHaveBeenCalled();
    expect(mocks.mudancaCreate.mock.calls[0][0].data).toEqual({
      tenantId: "system",
      assinaturaId: "a-1",
      competencia: "2026-03",
      tipo: "EXPANSAO",
      deCentavos: 400_000,
      paraCentavos: 450_000,
      motivo: "Correção retroativa de março",
      autorId: "u-1",
      autorNome: "V",
    });
  });

  it("exige motivo com 10+ caracteres", async () => {
    const res = await alterarValor({
      id: "a-1",
      valorCentavos: 600_000,
      motivo: "curto",
      competencia: "2026-10",
    });
    expect(res.ok).toBe(false);
    expect(mocks.assinaturaFindFirst).not.toHaveBeenCalled();
  });

  it("MEMBER não altera, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await alterarValor({
      id: "a-1",
      valorCentavos: 600_000,
      motivo: "Upgrade de degrau",
      competencia: "2026-10",
    });
    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("encerrarAssinatura", () => {
  beforeEach(resetar);

  it("grava encerradaEm, motivoEncerramento e a linha CHURN com paraCentavos: 0, na mesma transação", async () => {
    const res = await encerrarAssinatura({
      id: "a-1",
      data: "2026-09-15",
      motivo: "Cliente encerrou o contrato",
    });
    expect(res.ok).toBe(true);
    expect(mocks.assinaturaUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "a-1", tenantId: "system", encerradaEm: null },
      data: {
        encerradaEm: new Date("2026-09-15T00:00:00Z"),
        motivoEncerramento: "Cliente encerrou o contrato",
      },
    });
    expect(mocks.mudancaCreate.mock.calls[0][0].data).toEqual({
      tenantId: "system",
      assinaturaId: "a-1",
      competencia: "2026-09",
      tipo: "CHURN",
      deCentavos: 500_000,
      paraCentavos: 0,
      motivo: "Cliente encerrou o contrato",
      autorId: "u-1",
      autorNome: "V",
    });
  });

  it("assinatura já encerrada é recusada", async () => {
    mocks.assinaturaUpdateMany.mockResolvedValue({ count: 0 });
    const res = await encerrarAssinatura({
      id: "a-1",
      data: "2026-09-15",
      motivo: "Cliente encerrou o contrato",
    });
    expect(res.ok).toBe(false);
    expect(mocks.mudancaCreate).not.toHaveBeenCalled();
  });

  it("MEMBER não encerra, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await encerrarAssinatura({
      id: "a-1",
      data: "2026-09-15",
      motivo: "Cliente encerrou o contrato",
    });
    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("salvarCreditoDoMes", () => {
  beforeEach(resetar);

  function assinaturaRaw(over: {
    encerradaEm?: Date | null;
    iniciouEm?: Date;
  }) {
    return {
      id: "a-1",
      clienteSlug: "vanta-saude",
      clienteNome: "Vanta Saúde",
      planoSlug: "growth",
      valorMensalCentavos: 500_000,
      creditosMesIncluidos: 100,
      precoCreditoExtraCentavos: 200,
      tetoExcedenteCentavos: 5000,
      iniciouEm: over.iniciouEm ?? new Date("2026-01-01T00:00:00Z"),
      encerradaEm: over.encerradaEm ?? null,
      motivoEncerramento: null,
      propostaId: null,
    };
  }

  it("calcula excedenteCentavos e excedenteReprimidoCentavos com excedenteDoMes, congelando franquia e precoCreditoExtraCentavos da assinatura", async () => {
    mocks.assinaturaFindMany.mockResolvedValue([assinaturaRaw({})]);
    const res = await salvarCreditoDoMes({
      clienteSlug: "vanta-saude",
      competencia: "2026-09",
      consumidos: 150,
    });
    expect(res.ok).toBe(true);
    // bruto = (150 - 100) * 200 = 10_000; cobrado = min(10_000, 5000) = 5000;
    // reprimido = 10_000 - 5000 = 5000. O valor gravado é o calculado, não o
    // enviado — a action nem aceita excedenteCentavos como entrada.
    expect(mocks.creditoUpsert.mock.calls[0][0]).toMatchObject({
      create: {
        franquia: 100,
        consumidos: 150,
        precoCreditoExtraCentavos: 200,
        excedenteCentavos: 5000,
        excedenteReprimidoCentavos: 5000,
      },
      update: {
        franquia: 100,
        consumidos: 150,
        precoCreditoExtraCentavos: 200,
        excedenteCentavos: 5000,
        excedenteReprimidoCentavos: 5000,
      },
    });
  });

  it("cliente sem assinatura ativa recusa, sem upsert", async () => {
    mocks.assinaturaFindMany.mockResolvedValue([]);
    const res = await salvarCreditoDoMes({
      clienteSlug: "vanta-saude",
      competencia: "2026-09",
      consumidos: 150,
    });
    expect(res.ok).toBe(false);
    expect(mocks.creditoUpsert).not.toHaveBeenCalled();
  });

  it("fecha o mês de um cliente que já saiu, desde que estivesse ativo naquela competência", async () => {
    // Encerrou em outubro; fechar o consumo de setembro (mês em que ainda
    // estava ativa) não pode ser recusado por falta de assinatura "ativa" no
    // sentido de hoje (`encerradaEm: null`).
    mocks.assinaturaFindMany.mockResolvedValue([
      assinaturaRaw({ encerradaEm: new Date("2026-10-05T00:00:00Z") }),
    ]);
    const res = await salvarCreditoDoMes({
      clienteSlug: "vanta-saude",
      competencia: "2026-09",
      consumidos: 150,
    });
    expect(res.ok).toBe(true);
    expect(mocks.creditoUpsert).toHaveBeenCalled();
  });

  it("cliente que já saiu antes da competência pedida continua recusado", async () => {
    mocks.assinaturaFindMany.mockResolvedValue([
      assinaturaRaw({ encerradaEm: new Date("2026-08-05T00:00:00Z") }),
    ]);
    const res = await salvarCreditoDoMes({
      clienteSlug: "vanta-saude",
      competencia: "2026-09",
      consumidos: 150,
    });
    expect(res.ok).toBe(false);
    expect(mocks.creditoUpsert).not.toHaveBeenCalled();
  });

  it("MEMBER não salva, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await salvarCreditoDoMes({
      clienteSlug: "vanta-saude",
      competencia: "2026-09",
      consumidos: 150,
    });
    expect(res.ok).toBe(false);
    expect(mocks.creditoUpsert).not.toHaveBeenCalled();
  });
});
