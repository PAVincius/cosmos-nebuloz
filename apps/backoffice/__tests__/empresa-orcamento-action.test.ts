// empresa-orcamento-action.test.ts — orçado × realizado (spec 2026-09-06
// §3–§4): orçado vem de OrcamentoDaConta, realizado é a soma dos lançamentos
// do intervalo (agregarPorMes) — nunca uma cópia gravada do realizado.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  orcFindMany: vi.fn(),
  orcUpsert: vi.fn(),
  orcDeleteMany: vi.fn(),
  lancFindMany: vi.fn(),
  contaFindMany: vi.fn(),
  contaFindUnique: vi.fn(),
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
    orcamentoDaConta: {
      findMany: mocks.orcFindMany,
      upsert: mocks.orcUpsert,
      deleteMany: mocks.orcDeleteMany,
    },
    lancamento: { findMany: mocks.lancFindMany },
    contaDoPlano: {
      findMany: mocks.contaFindMany,
      findUnique: mocks.contaFindUnique,
    },
  },
}));

import { lerOrcado, salvarOrcamento } from "../app/actions/empresa/orcamento";

const staff = {
  userId: "u-1",
  name: "V",
  email: "v@nebuloz.com",
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
  {
    conta: "5.1",
    nome: "Engenharia",
    grupo: 5,
    centroDeCusto: "produto-engenharia",
    ativa: true,
    ordem: 0,
  },
];

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.orcFindMany.mockResolvedValue([]);
  mocks.lancFindMany.mockResolvedValue([]);
  mocks.contaFindMany.mockResolvedValue(CONTAS);
  mocks.contaFindUnique.mockResolvedValue({ ativa: true });
  mocks.orcUpsert.mockResolvedValue({});
  mocks.orcDeleteMany.mockResolvedValue({ count: 1 });
}

describe("lerOrcado", () => {
  beforeEach(resetar);

  it("consulta orcamentoDaConta e lancamento com tenantId e competencia in as competências do intervalo", async () => {
    const res = await lerOrcado({ de: "2026-08-15", ate: "2026-09-10" });
    expect(res.ok).toBe(true);
    expect(mocks.orcFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
      competencia: { in: ["2026-08", "2026-09"] },
    });
    expect(mocks.lancFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
      competencia: { in: ["2026-08", "2026-09"] },
    });
  });

  it("devolve por conta e competência orçado, realizado e desvio; conta sem orçamento tem orçado nulo e realizado somado", async () => {
    mocks.orcFindMany.mockResolvedValue([
      { competencia: "2026-09", conta: "1.1", valorCentavos: 10_000 },
    ]);
    mocks.lancFindMany.mockResolvedValue([
      { competencia: "2026-09", conta: "1.1", valorCentavos: 4000 },
      { competencia: "2026-09", conta: "1.1", valorCentavos: 3000 },
      { competencia: "2026-09", conta: "5.1", valorCentavos: 500 },
    ]);
    const res = await lerOrcado({ de: "2026-09-01", ate: "2026-09-30" });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const conta1 = res.data.contas.find((c) => c.conta === "1.1");
    expect(conta1?.porCompetencia["2026-09"]).toEqual({
      orcado: 10_000,
      realizado: 7000,
      desvio: -3000,
    });
    const conta5 = res.data.contas.find((c) => c.conta === "5.1");
    expect(conta5?.porCompetencia["2026-09"]).toEqual({
      orcado: null,
      realizado: 500,
      desvio: null,
    });
  });

  it("conta sem orçamento e sem lançamento fica com os três nulos", async () => {
    const res = await lerOrcado({ de: "2026-09-01", ate: "2026-09-30" });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.contas[0]?.porCompetencia["2026-09"]).toEqual({
      orcado: null,
      realizado: null,
      desvio: null,
    });
  });
});

describe("salvarOrcamento", () => {
  beforeEach(resetar);

  it("recusa conta desativada ou fora do plano, sem upsert", async () => {
    mocks.contaFindUnique.mockResolvedValue({ ativa: false });
    expect(
      (
        await salvarOrcamento({
          competencia: "2026-09",
          conta: "1.1",
          valorCentavos: 1000,
        })
      ).ok
    ).toBe(false);
    mocks.contaFindUnique.mockResolvedValue(null);
    expect(
      (
        await salvarOrcamento({
          competencia: "2026-09",
          conta: "9.9",
          valorCentavos: 1000,
        })
      ).ok
    ).toBe(false);
    expect(mocks.orcUpsert).not.toHaveBeenCalled();
  });

  it("valorCentavos nulo apaga a linha", async () => {
    const res = await salvarOrcamento({
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: null,
    });
    expect(res.ok).toBe(true);
    expect(mocks.orcDeleteMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
      competencia: "2026-09",
      conta: "1.1",
    });
    expect(mocks.orcUpsert).not.toHaveBeenCalled();
    expect(mocks.logPlatformAudit).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/financeiro");
  });

  it("com valor faz upsert na chave composta", async () => {
    const res = await salvarOrcamento({
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: 10_000,
    });
    expect(res.ok).toBe(true);
    expect(mocks.orcUpsert.mock.calls[0][0]).toMatchObject({
      where: {
        tenantId_competencia_conta: {
          tenantId: "system",
          competencia: "2026-09",
          conta: "1.1",
        },
      },
      create: { valorCentavos: 10_000 },
      update: { valorCentavos: 10_000 },
    });
    expect(mocks.orcDeleteMany).not.toHaveBeenCalled();
    expect(mocks.logPlatformAudit).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/financeiro");
  });

  it("recusa valorCentavos negativo — orçado é magnitude", async () => {
    const res = await salvarOrcamento({
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: -100,
    });
    expect(res.ok).toBe(false);
    expect(mocks.orcUpsert).not.toHaveBeenCalled();
    expect(mocks.orcDeleteMany).not.toHaveBeenCalled();
  });

  it("MEMBER não salva, nada chega ao banco", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await salvarOrcamento({
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: 1000,
    });
    expect(res.ok).toBe(false);
    expect(mocks.orcUpsert).not.toHaveBeenCalled();
    expect(mocks.orcDeleteMany).not.toHaveBeenCalled();
  });
});
