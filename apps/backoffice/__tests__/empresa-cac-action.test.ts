// empresa-cac-action.test.ts — as seis parcelas 4.x moram em LancamentoMensal:
// salvar parcela é escrever no DRE. Nulo apaga o lançamento.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  lancFindMany: vi.fn(),
  lancUpsert: vi.fn(),
  lancDeleteMany: vi.fn(),
  cacFindUnique: vi.fn(),
  cacUpsert: vi.fn(),
  alocDeleteMany: vi.fn(),
  alocCreateMany: vi.fn(),
  planoFindUnique: vi.fn(),
  termoFindUnique: vi.fn(),
  proposalCount: vi.fn(),
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
    cacPeriodo: { findUnique: mocks.cacFindUnique, upsert: mocks.cacUpsert },
    cacAlocacaoProduto: {
      deleteMany: mocks.alocDeleteMany,
      createMany: mocks.alocCreateMany,
    },
    planoComercial: { findUnique: mocks.planoFindUnique },
    termoDeContrato: { findUnique: mocks.termoFindUnique },
    proposal: { count: mocks.proposalCount },
    $transaction: (fns: Promise<unknown>[]) => Promise.all(fns),
  },
  ProductModule: {
    COSMOS: "COSMOS",
    CHARTER: "CHARTER",
    SIGNAL: "SIGNAL",
    MERIDIAN: "MERIDIAN",
    SCAFFOLD: "SCAFFOLD",
  },
}));

import {
  lerCac,
  salvarAlocacao,
  salvarConversao,
  salvarParcelas,
} from "../app/actions/empresa/cac";

const staff = {
  userId: "u-1",
  name: "V",
  email: "v@nebuloz.com",
  canWrite: true,
};

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.lancFindMany.mockResolvedValue([{ conta: "4.1", valorCentavos: 100 }]);
  mocks.cacFindUnique.mockResolvedValue({
    id: "cac-1",
    entregaDiagnosticoCentavos: null,
    clientesGanhos: null,
    convLeadDiscoveryPercent: null,
    convDiscoveryEvaluationPercent: null,
    convEvaluationPropostaPercent: null,
    convPropostaAceitaPercent: 25,
    alocacoes: [{ produto: "MERIDIAN", pesoPercent: 100 }],
  });
  mocks.cacUpsert.mockResolvedValue({ id: "cac-1" });
  mocks.planoFindUnique.mockResolvedValue({
    precoAssentoCentavos: 14_900,
    minimoAssentos: 25,
  });
  mocks.termoFindUnique.mockResolvedValue({ meses: 12, descontoPercent: 12 });
  mocks.proposalCount.mockResolvedValue(1);
}

describe("lerCac", () => {
  beforeEach(resetar);

  it("monta as parcelas do DRE + CacPeriodo e a mensalidade de referência do catálogo", async () => {
    const res = await lerCac({ competencia: "2026-09" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.parcelas["4.1"]).toBe(100);
    expect(res.data.parcelas["4.2"]).toBeNull();
    expect(res.data.resultado.preenchidas).toBe(1);
    expect(res.data.resultado.cacCentavos).toBeNull();
    // 25 × 14.900 × 0,88 = 327.800 — a fórmula de precificar.test.ts.
    expect(res.data.mensalidadeReferenciaCentavos).toBe(327_800);
    expect(res.data.sugestaoClientesGanhos).toBe(1);
    expect(mocks.lancFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      competencia: "2026-09",
    });
  });

  it("sem plano scale no catálogo, a referência é nula e nada quebra", async () => {
    mocks.planoFindUnique.mockResolvedValue(null);
    const res = await lerCac({ competencia: "2026-09" });
    expect(res.ok && res.data.mensalidadeReferenciaCentavos).toBeNull();
  });

  it("competência inválida", async () => {
    const res = await lerCac({ competencia: "set/26" });
    expect(res.ok).toBe(false);
  });
});

describe("salvarParcelas", () => {
  beforeEach(resetar);

  it("MEMBER não salva", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await salvarParcelas({
      competencia: "2026-09",
      contas: { "4.1": 5 },
    });
    expect(res.ok).toBe(false);
  });

  it("conta 4.x vira upsert em LancamentoMensal; nulo apaga", async () => {
    await salvarParcelas({
      competencia: "2026-09",
      contas: { "4.1": 500, "4.2": null },
    });
    expect(mocks.lancUpsert.mock.calls[0][0].where).toEqual({
      tenantId_competencia_conta: {
        tenantId: "system",
        competencia: "2026-09",
        conta: "4.1",
      },
    });
    expect(mocks.lancUpsert.mock.calls[0][0].update).toEqual({
      valorCentavos: 500,
    });
    expect(mocks.lancDeleteMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
      competencia: "2026-09",
      conta: "4.2",
    });
  });

  it("conta fora das seis é recusada", async () => {
    const res = await salvarParcelas({
      competencia: "2026-09",
      contas: { "5.1": 5 } as never,
    });
    expect(res.ok).toBe(false);
    expect(mocks.lancUpsert).not.toHaveBeenCalled();
  });

  it("entrega e clientes ganhos vão para CacPeriodo, por upsert na competência", async () => {
    await salvarParcelas({
      competencia: "2026-09",
      entregaDiagnosticoCentavos: 600_000,
      clientesGanhos: 2,
    });
    const a = mocks.cacUpsert.mock.calls[0][0];
    expect(a.where).toEqual({
      tenantId_competencia: { tenantId: "system", competencia: "2026-09" },
    });
    expect(a.update).toEqual({
      entregaDiagnosticoCentavos: 600_000,
      clientesGanhos: 2,
    });
  });

  it("centavos fracionados e negativos são recusados", async () => {
    expect(
      (await salvarParcelas({ competencia: "2026-09", contas: { "4.1": 1.5 } }))
        .ok
    ).toBe(false);
    expect(
      (await salvarParcelas({ competencia: "2026-09", clientesGanhos: -1 })).ok
    ).toBe(false);
  });
});

describe("salvarConversao", () => {
  beforeEach(resetar);

  it("percentual entre 0 e 100", async () => {
    expect(
      (
        await salvarConversao({
          competencia: "2026-09",
          convPropostaAceitaPercent: 101,
        })
      ).ok
    ).toBe(false);
    await salvarConversao({
      competencia: "2026-09",
      convPropostaAceitaPercent: 30,
    });
    expect(mocks.cacUpsert.mock.calls[0][0].update).toEqual({
      convPropostaAceitaPercent: 30,
    });
  });
});

describe("salvarAlocacao", () => {
  beforeEach(resetar);

  it("pesos que não somam 100 são recusados", async () => {
    const res = await salvarAlocacao({
      competencia: "2026-09",
      alocacoes: [{ produto: "MERIDIAN", pesoPercent: 50 }],
    });
    expect(res.ok).toBe(false);
    expect(mocks.alocCreateMany).not.toHaveBeenCalled();
  });

  it("substitui as alocações do período", async () => {
    await salvarAlocacao({
      competencia: "2026-09",
      alocacoes: [
        { produto: "MERIDIAN", pesoPercent: 40 },
        { produto: "CHARTER", pesoPercent: 60 },
      ],
    });
    expect(mocks.alocDeleteMany.mock.calls[0][0].where).toEqual({
      cacPeriodoId: "cac-1",
    });
    expect(mocks.alocCreateMany.mock.calls[0][0].data).toEqual([
      { cacPeriodoId: "cac-1", produto: "MERIDIAN", pesoPercent: 40 },
      { cacPeriodoId: "cac-1", produto: "CHARTER", pesoPercent: 60 },
    ]);
  });
});
