// empresa-financeiro-action.test.ts — o DRE devolve três meses e o trimestre;
// o caixa devolve sempre 13 semanas ancoradas na segunda corrente, criando em
// memória as que não existem.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    cacPeriodo: { findFirst: mocks.cacFindFirst },
    proposal: { aggregate: mocks.proposalAggregate },
  },
}));

import {
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
}

describe("lerDre", () => {
  beforeEach(resetar);

  it("três competências, uma coluna por mês, lançamentos no lugar e totais nulos onde falta conta", async () => {
    const res = await lerDre({ competenciaFinal: "2026-09" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.competencias).toEqual(["2026-07", "2026-08", "2026-09"]);
    const c11 = res.data.contas.find((c) => c.conta === "1.1");
    expect(c11?.valores).toEqual([null, 100, 200]);
    const bruta = res.data.linhas.find((l) => l.id === "receita-bruta");
    expect(bruta?.valores).toEqual([null, null, null]); // faltam 1.2…1.8
    expect(bruta?.trimestre).toBeNull();
    expect(mocks.lancFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      competencia: { in: ["2026-07", "2026-08", "2026-09"] },
    });
  });
});

describe("salvarLancamento", () => {
  beforeEach(resetar);

  it("conta desconhecida é recusada", async () => {
    const res = await salvarLancamento({
      competencia: "2026-09",
      conta: "9.9",
      valorCentavos: 1,
    });
    expect(res.ok).toBe(false);
    expect(mocks.lancUpsert).not.toHaveBeenCalled();
  });

  it("valor grava por upsert; nulo apaga; devolve o DRE até a competência", async () => {
    await salvarLancamento({
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: 300,
    });
    expect(mocks.lancUpsert.mock.calls[0][0].where).toEqual({
      tenantId_competencia_conta: {
        tenantId: "system",
        competencia: "2026-09",
        conta: "1.1",
      },
    });
    await salvarLancamento({
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: null,
    });
    expect(mocks.lancDeleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/financeiro");
  });

  it("lançar num mês anterior mantém a janela em competenciaFinal", async () => {
    const res = await salvarLancamento({
      competencia: "2026-07",
      competenciaFinal: "2026-09",
      conta: "1.1",
      valorCentavos: 100,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.competencias).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("MEMBER não lança", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await salvarLancamento({
      competencia: "2026-09",
      conta: "1.1",
      valorCentavos: 1,
    });
    expect(res.ok).toBe(false);
  });
});

describe("lerCaixa", () => {
  beforeEach(() => {
    resetar();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T15:00:00Z")); // sábado → semana 1 = 2026-08-31
  });
  afterEach(() => vi.useRealTimers());

  it("devolve 13 semanas a partir da segunda corrente, com as gravadas no lugar", async () => {
    mocks.semanaFindMany.mockResolvedValue([
      {
        semanaInicio: new Date("2026-09-07T00:00:00Z"),
        saldoInicialCentavos: null,
        recebiveisCentavos: 500,
        contratosAssinadosCentavos: 0,
        pipelinePonderadoCentavos: 0,
        saidasPessoalCentavos: 0,
        saidasFornecedoresCentavos: 0,
        saidasComercialCentavos: 0,
        saidasImpostosCentavos: 0,
        saidasOutrasCentavos: 0,
      },
    ]);
    const res = await lerCaixa();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.semanas).toHaveLength(13);
    expect(res.data.semanas[0].semanaInicio).toBe("2026-08-31");
    expect(res.data.semanas[1].recebiveisCentavos).toBe(500);
    expect(res.data.semanas[0].saldoFinalCentavos).toBeNull(); // sem extrato
    expect(res.data.referenciaPipelineCentavos).toBe(25_000);
    expect(res.data.convPropostaAceitaPercent).toBe(25);
    expect(mocks.proposalAggregate.mock.calls[0][0].where).toMatchObject({
      tenantId: "system",
      status: { in: ["ENVIADA", "AGUARDANDO_APROVACAO"] },
    });
  });

  it("sem conversão registrada, a referência é nula", async () => {
    mocks.cacFindFirst.mockResolvedValue(null);
    const res = await lerCaixa();
    expect(res.ok && res.data.referenciaPipelineCentavos).toBeNull();
  });
});

describe("salvarSemana", () => {
  beforeEach(resetar);

  it("exige segunda-feira", async () => {
    const res = await salvarSemana({
      semanaInicio: "2026-09-08",
      recebiveisCentavos: 1,
    });
    expect(res.ok).toBe(false);
  });

  it("upsert pela segunda-feira com só os campos enviados", async () => {
    await salvarSemana({
      semanaInicio: "2026-09-07",
      recebiveisCentavos: 500,
      saidasPessoalCentavos: null,
    });
    const a = mocks.semanaUpsert.mock.calls[0][0];
    expect(a.where).toEqual({
      tenantId_semanaInicio: {
        tenantId: "system",
        semanaInicio: new Date("2026-09-07T00:00:00Z"),
      },
    });
    expect(a.update).toEqual({
      recebiveisCentavos: 500,
      saidasPessoalCentavos: null,
    });
  });
});
