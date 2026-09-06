// empresa-financeiro-action.test.ts — DRE e caixa por intervalo de datas, mais
// o CRUD do plano de contas: criar deriva grupo/centro do código, atualizar só
// grava o que foi enviado.
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  lancFindMany: vi.fn(),
  lancUpsert: vi.fn(),
  lancDeleteMany: vi.fn(),
  semanaFindMany: vi.fn(),
  semanaUpsert: vi.fn(),
  cacFindFirst: vi.fn(),
  proposalAggregate: vi.fn(),
  contaFindMany: vi.fn(),
  contaFindUnique: vi.fn(),
  contaCreate: vi.fn(),
  contaUpdate: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    lancamentoMensal: {
      findMany: mocks.lancFindMany,
      upsert: mocks.lancUpsert,
      deleteMany: mocks.lancDeleteMany,
    },
    semanaDeCaixa: {
      findMany: mocks.semanaFindMany,
      upsert: mocks.semanaUpsert,
    },
    contaDoPlano: {
      findMany: mocks.contaFindMany,
      findUnique: mocks.contaFindUnique,
      create: mocks.contaCreate,
      update: mocks.contaUpdate,
    },
    cacPeriodo: { findFirst: mocks.cacFindFirst },
    proposal: { aggregate: mocks.proposalAggregate },
  },
}));

import {
  atualizarConta,
  criarConta,
  lerCaixa,
  lerDre,
  salvarLancamento,
  salvarSemana,
} from "../app/actions/empresa/financeiro";

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
    conta: "4.1",
    nome: "Vendas",
    grupo: 4,
    centroDeCusto: "comercial",
    ativa: true,
    ordem: 15,
  },
];

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.lancFindMany.mockResolvedValue([
    { competencia: "2026-08", conta: "1.1", valorCentavos: 100 },
    { competencia: "2026-09", conta: "1.1", valorCentavos: 200 },
  ]);
  mocks.semanaFindMany.mockResolvedValue([]);
  mocks.cacFindFirst.mockResolvedValue({ convPropostaAceitaPercent: 25 });
  mocks.proposalAggregate.mockResolvedValue({
    _sum: { totalCentavos: 100_000 },
  });
  mocks.contaFindMany.mockResolvedValue(CONTAS);
  mocks.contaFindUnique.mockImplementation(
    async ({ where }: { where: { tenantId_conta: { conta: string } } }) =>
      CONTAS.find((c) => c.conta === where.tenantId_conta.conta) ?? null
  );
}

describe("lerDre por intervalo", () => {
  it("uma coluna por mês tocado e a coluna total", async () => {
    resetar();
    const res = await lerDre({ de: "2026-06-15", ate: "2026-09-01" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.competencias).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(res.data.intervalo).toEqual({ de: "2026-06-15", ate: "2026-09-01" });
    const c11 = res.data.contas.find((c) => c.conta === "1.1");
    expect(c11?.valores).toEqual([null, null, 100, 200]);
    expect(res.data.linhas.find((l) => l.id === "c-1.1")?.total).toBeNull();
    expect(mocks.lancFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      competencia: { in: ["2026-06", "2026-07", "2026-08", "2026-09"] },
    });
    expect(mocks.contaFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
    });
  });

  it("recusa intervalo inválido e acima de 12 meses", async () => {
    resetar();
    expect((await lerDre({ de: "2026-09-01", ate: "2026-08-01" })).ok).toBe(
      false
    );
    const r = await lerDre({ de: "2025-08-01", ate: "2026-09-01" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/12 meses/);
  });
});

describe("salvarLancamento", () => {
  it("recusa conta desconhecida e conta inativa", async () => {
    resetar();
    expect(
      (
        await salvarLancamento({
          competencia: "2026-09",
          conta: "9.9",
          valorCentavos: 1,
          de: "2026-07-01",
          ate: "2026-09-30",
        })
      ).ok
    ).toBe(false);
    mocks.contaFindUnique.mockResolvedValue({ ...CONTAS[0], ativa: false });
    expect(
      (
        await salvarLancamento({
          competencia: "2026-09",
          conta: "1.1",
          valorCentavos: 1,
          de: "2026-07-01",
          ate: "2026-09-30",
        })
      ).ok
    ).toBe(false);
    expect(mocks.lancUpsert).not.toHaveBeenCalled();
  });

  it("grava e devolve a janela pedida", async () => {
    resetar();
    const res = await salvarLancamento({
      competencia: "2026-07",
      conta: "1.1",
      valorCentavos: 300,
      de: "2026-07-01",
      ate: "2026-09-30",
    });
    expect(res.ok && res.data.competencias).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(mocks.lancUpsert.mock.calls[0][0].where).toEqual({
      tenantId_competencia_conta: {
        tenantId: "system",
        competencia: "2026-07",
        conta: "1.1",
      },
    });
  });

  it("MEMBER não lança", async () => {
    resetar();
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await salvarLancamento({
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: 1,
      de: "2026-07-01",
      ate: "2026-09-30",
    });
    expect(res.ok).toBe(false);
  });
});

describe("plano de contas", () => {
  it("criarConta deriva grupo e centro do código e recusa formato", async () => {
    resetar();
    mocks.contaCreate.mockResolvedValue({});
    await criarConta({ conta: "4.7", nome: "Eventos" });
    expect(mocks.contaCreate.mock.calls[0][0].data).toMatchObject({
      tenantId: "system",
      conta: "4.7",
      nome: "Eventos",
      grupo: 4,
      centroDeCusto: "comercial",
      ativa: true,
      ordem: 16,
    });
    expect((await criarConta({ conta: "47", nome: "x" })).ok).toBe(false);
    expect(
      (
        await criarConta({
          conta: "1.9",
          nome: "x",
          centroDeCusto: "comercial",
        })
      ).ok
    ).toBe(false); // grupo 1 não tem centro
  });

  it("atualizarConta grava só o enviado e recusa inexistente", async () => {
    resetar();
    mocks.contaUpdate.mockResolvedValue({});
    await atualizarConta({ conta: "4.1", ativa: false });
    expect(mocks.contaUpdate.mock.calls[0][0]).toMatchObject({
      where: { tenantId_conta: { tenantId: "system", conta: "4.1" } },
      data: { ativa: false },
    });
    expect((await atualizarConta({ conta: "9.9", nome: "x" })).ok).toBe(false);
  });

  it("MEMBER não cria", async () => {
    resetar();
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    expect((await criarConta({ conta: "4.8", nome: "x" })).ok).toBe(false);
  });
});

describe("lerCaixa por intervalo", () => {
  it("devolve as segundas contidas e recusa acima de 26", async () => {
    resetar();
    const res = await lerCaixa({ de: "2026-09-06", ate: "2026-10-04" });
    expect(res.ok && res.data.semanas.map((s) => s.semanaInicio)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
    expect(mocks.semanaFindMany.mock.calls[0][0].where.semanaInicio).toEqual({
      gte: new Date("2026-08-31T00:00:00Z"),
      lte: new Date("2026-09-28T00:00:00Z"),
    });
    expect((await lerCaixa({ de: "2026-01-01", ate: "2026-12-31" })).ok).toBe(
      false
    );
  });
});

describe("salvarSemana", () => {
  it("exige segunda-feira", async () => {
    resetar();
    const res = await salvarSemana({
      semanaInicio: "2026-09-08",
      recebiveisCentavos: 1,
      de: "2026-09-01",
      ate: "2026-09-30",
    });
    expect(res.ok).toBe(false);
  });

  it("devolve a janela pedida", async () => {
    resetar();
    const res = await salvarSemana({
      semanaInicio: "2026-09-07",
      recebiveisCentavos: 500,
      de: "2026-09-06",
      ate: "2026-10-04",
    });
    expect(res.ok && res.data.semanas).toHaveLength(5);
    expect(mocks.semanaUpsert.mock.calls[0][0].update).toEqual({
      recebiveisCentavos: 500,
    });
  });
});
