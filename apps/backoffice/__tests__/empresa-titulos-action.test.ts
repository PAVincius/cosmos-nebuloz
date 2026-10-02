// empresa-titulos-action.test.ts — título é a promessa, lançamento (livro.ts)
// é o fato (spec 2026-09-06 §3). `baixarTitulo` grava os dois na mesma
// transação: o `updateMany` guardado por `status: "ABERTO"` fecha a corrida
// entre a leitura do título e a baixa — sem ele, duas baixas concorrentes do
// mesmo título criariam dois lançamentos para uma promessa só.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  tituloFindMany: vi.fn(),
  tituloFindFirst: vi.fn(),
  tituloCreate: vi.fn(),
  tituloUpdateMany: vi.fn(),
  lancamentoCreate: vi.fn(),
  contaFindMany: vi.fn(),
  contaFindUnique: vi.fn(),
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
    titulo: {
      findMany: mocks.tituloFindMany,
      findFirst: mocks.tituloFindFirst,
      create: mocks.tituloCreate,
      updateMany: mocks.tituloUpdateMany,
    },
    lancamento: { create: mocks.lancamentoCreate },
    contaDoPlano: {
      findMany: mocks.contaFindMany,
      findUnique: mocks.contaFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  baixarTitulo,
  cancelarTitulo,
  criarTitulo,
  listarTitulos,
} from "../app/actions/empresa/titulos";

const staff = {
  userId: "u-1",
  name: "V",
  email: "v@nebuloz.ai",
  canWrite: true,
};

const CONTAS = [
  {
    conta: "1.1",
    nome: "Assinatura",
    grupo: 1,
    centroDeCusto: null,
    ativa: true,
    ordem: 0,
  },
];

const TITULO_VALIDO = {
  tipo: "PAGAR" as const,
  descricao: "Aluguel de setembro",
  contraparte: "Imobiliária Y",
  conta: "1.1",
  valorCentavos: 300_000,
  emissao: "2026-09-01",
  vencimento: "2026-09-10",
};

/** `$transaction` como em leads.test.ts: callback recebe o mesmo objeto de
 *  mocks, seja ele chamado `tx` (produção) ou aqui. */
const tx = {
  titulo: { updateMany: mocks.tituloUpdateMany },
  lancamento: { create: mocks.lancamentoCreate },
};

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.tituloFindMany.mockResolvedValue([]);
  mocks.contaFindMany.mockResolvedValue(CONTAS);
  mocks.tituloCreate.mockResolvedValue({ id: "t-1" });
  mocks.tituloFindFirst.mockResolvedValue({
    tipo: "PAGAR",
    descricao: "Aluguel de setembro",
    contraparte: "Imobiliária Y",
    conta: "1.1",
    valorCentavos: 300_000,
  });
  mocks.tituloUpdateMany.mockResolvedValue({ count: 1 });
  mocks.lancamentoCreate.mockResolvedValue({ id: "l-1" });
  mocks.contaFindUnique.mockResolvedValue({ ativa: true });
  mocks.transaction.mockImplementation(
    async (fn: (t: unknown) => Promise<unknown>) => await fn(tx)
  );
}

describe("listarTitulos", () => {
  beforeEach(resetar);

  it("filtra por tenant e ordena por vencimento asc", async () => {
    const res = await listarTitulos({});
    expect(res.ok).toBe(true);
    // O recorte de 90 dias e o teto moram em teto-das-leituras-onda8.test.ts.
    expect(mocks.tituloFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
    });
    expect(mocks.tituloFindMany.mock.calls[0][0].orderBy).toEqual({
      vencimento: "asc",
    });
  });

  it("com tipo, também filtra por tipo", async () => {
    await listarTitulos({ tipo: "RECEBER" });
    expect(mocks.tituloFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      tipo: "RECEBER",
    });
  });
});

describe("criarTitulo", () => {
  beforeEach(resetar);

  it("recusa conta inválida, valorCentavos <= 0, vencimento < emissao e tipo fora de PAGAR/RECEBER", async () => {
    expect((await criarTitulo({ ...TITULO_VALIDO, conta: "9.9" })).ok).toBe(
      false
    );
    expect((await criarTitulo({ ...TITULO_VALIDO, valorCentavos: 0 })).ok).toBe(
      false
    );
    expect(
      (
        await criarTitulo({
          ...TITULO_VALIDO,
          emissao: "2026-09-10",
          vencimento: "2026-09-01",
        })
      ).ok
    ).toBe(false);
    expect(
      (await criarTitulo({ ...TITULO_VALIDO, tipo: "OUTRO" as never })).ok
    ).toBe(false);
    expect(mocks.tituloCreate).not.toHaveBeenCalled();
  });

  it("grava e audita", async () => {
    const res = await criarTitulo(TITULO_VALIDO);
    expect(res.ok).toBe(true);
    expect(mocks.tituloCreate.mock.calls[0][0].data).toMatchObject({
      tenantId: "system",
      tipo: "PAGAR",
      conta: "1.1",
      valorCentavos: 300_000,
    });
    expect(mocks.logPlatformAudit).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/financeiro");
  });

  it("MEMBER não cria, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await criarTitulo(TITULO_VALIDO);
    expect(res.ok).toBe(false);
    expect(mocks.tituloCreate).not.toHaveBeenCalled();
  });

  it("conta fora do plano de contas (findUnique devolve null) recusa e não cria", async () => {
    mocks.contaFindUnique.mockResolvedValue(null);
    const res = await criarTitulo(TITULO_VALIDO);
    expect(res.ok).toBe(false);
    expect(mocks.tituloCreate).not.toHaveBeenCalled();
  });

  it("conta desativada (ativa: false) recusa e não cria", async () => {
    mocks.contaFindUnique.mockResolvedValue({ ativa: false });
    const res = await criarTitulo(TITULO_VALIDO);
    expect(res.ok).toBe(false);
    expect(mocks.tituloCreate).not.toHaveBeenCalled();
  });
});

describe("baixarTitulo", () => {
  beforeEach(resetar);

  it("roda em $transaction: updateMany guardado por ABERTO, depois cria o lançamento com os dados do título", async () => {
    const res = await baixarTitulo({
      id: "t-1",
      data: "2026-09-12",
      competencia: "2026-09",
    });
    expect(res.ok).toBe(true);
    expect(mocks.tituloUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "t-1", tenantId: "system", status: "ABERTO" },
      data: {
        status: "BAIXADO",
        baixadoEm: new Date("2026-09-12T00:00:00Z"),
        competenciaBaixa: "2026-09",
      },
    });
    expect(mocks.lancamentoCreate.mock.calls[0][0].data).toEqual({
      tenantId: "system",
      competencia: "2026-09",
      data: new Date("2026-09-12T00:00:00Z"),
      conta: "1.1",
      descricao: "Aluguel de setembro",
      valorCentavos: 300_000,
      contraparte: "Imobiliária Y",
      tituloId: "t-1",
    });
  });

  it("count === 0 (já baixado ou cancelado) devolve ok:false e não cria lançamento", async () => {
    mocks.tituloUpdateMany.mockResolvedValue({ count: 0 });
    const res = await baixarTitulo({
      id: "t-1",
      data: "2026-09-12",
      competencia: "2026-09",
    });
    expect(res.ok).toBe(false);
    expect(mocks.lancamentoCreate).not.toHaveBeenCalled();
  });

  it("recusa competência inválida", async () => {
    const res = await baixarTitulo({
      id: "t-1",
      data: "2026-09-12",
      competencia: "2026-9",
    });
    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("MEMBER não baixa, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await baixarTitulo({
      id: "t-1",
      data: "2026-09-12",
      competencia: "2026-09",
    });
    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("conta do título desativada entre a criação e a baixa: recusa antes da $transaction, sem lançamento", async () => {
    mocks.contaFindUnique.mockResolvedValue({ ativa: false });
    const res = await baixarTitulo({
      id: "t-1",
      data: "2026-09-12",
      competencia: "2026-09",
    });
    expect(res.ok).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.lancamentoCreate).not.toHaveBeenCalled();
  });
});

describe("cancelarTitulo", () => {
  beforeEach(resetar);

  it("exige motivo com 10+ caracteres", async () => {
    const res = await cancelarTitulo({ id: "t-1", motivo: "curto" });
    expect(res.ok).toBe(false);
    expect(mocks.tituloUpdateMany).not.toHaveBeenCalled();
  });

  it("updateMany guardado por status ABERTO", async () => {
    const res = await cancelarTitulo({
      id: "t-1",
      motivo: "Cliente cancelou o contrato",
    });
    expect(res.ok).toBe(true);
    expect(mocks.tituloUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "t-1", tenantId: "system", status: "ABERTO" },
      data: {
        status: "CANCELADO",
        motivoCancelamento: "Cliente cancelou o contrato",
      },
    });
  });

  it("count === 0 devolve ok:false", async () => {
    mocks.tituloUpdateMany.mockResolvedValue({ count: 0 });
    const res = await cancelarTitulo({
      id: "t-1",
      motivo: "Cliente cancelou o contrato",
    });
    expect(res.ok).toBe(false);
  });

  it("MEMBER não cancela, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await cancelarTitulo({
      id: "t-1",
      motivo: "Cliente cancelou o contrato",
    });
    expect(res.ok).toBe(false);
    expect(mocks.tituloUpdateMany).not.toHaveBeenCalled();
  });
});
