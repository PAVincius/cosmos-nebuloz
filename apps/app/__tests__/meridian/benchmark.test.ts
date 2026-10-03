import { beforeEach, describe, expect, it, vi } from "vitest";

// Benchmark pool — FR-032/FR-033/FR-034.
//
// O corte é na leitura e é aqui que ele se prova: a linha retida sai da action
// **sem** os percentis. Um teste que só olhasse a tela deixaria a resposta da
// action carregando os números — que é exatamente o vazamento.

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  cohortFindMany: vi.fn(),
  cohortFindUnique: vi.fn(),
  cohortUpsert: vi.fn(),
  cohortUpdate: vi.fn(),
  contributionFindMany: vi.fn(),
  contributionUpsert: vi.fn(),
  contributionDeleteMany: vi.fn(),
  assessmentFindUnique: vi.fn(),
  assessmentFindFirst: vi.fn(),
  assessmentUpdate: vi.fn(),
  enablementFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/meridian/guards", () => ({
  requireMeridianContext: h.requireCtx,
  requireMeridianPermissionContext: h.requireCtx,
  MeridianRuleError: class extends Error {
    rule: string;
    constructor(rule: string, message: string) {
      super(message);
      this.rule = rule;
    }
  },
  StateConflictError: class extends Error {
    rule: string;
    blockers: string[];
    constructor(rule: string, message: string, blockers: string[] = []) {
      super(message);
      this.rule = rule;
      this.blockers = blockers;
    }
  },
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: {
        findFirst: h.assessmentFindFirst,
        update: h.assessmentUpdate,
        findUnique: h.assessmentFindUnique,
      },
      meridianBenchmarkEnablement: { findUnique: h.enablementFindUnique },
      auditLog: { create: h.auditCreate },
    }),
  database: {
    meridianBenchmarkCohort: {
      findMany: h.cohortFindMany,
      findUnique: h.cohortFindUnique,
      upsert: h.cohortUpsert,
      update: h.cohortUpdate,
    },
    meridianBenchmarkContribution: {
      findMany: h.contributionFindMany,
      upsert: h.contributionUpsert,
      deleteMany: h.contributionDeleteMany,
    },
  },
}));

import {
  contributeInTx,
  getBenchmarkEnablement,
  listCohorts,
  readCohortAction,
  withdrawContribution,
} from "@/app/(meridian)/actions/benchmark";

const BANDS = {
  DATA: { p25: 38, p50: 52, p75: 64 },
  PROCESS: { p25: 44, p50: 55, p75: 68 },
  PEOPLE: { p25: 30, p50: 42, p75: 55 },
  GOVERNANCE: { p25: 41, p50: 57, p75: 71 },
  INFRASTRUCTURE: { p25: 40, p50: 53, p75: 66 },
};

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  meridianRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireCtx.mockResolvedValue(CTX);
  h.cohortUpsert.mockResolvedValue({});
  h.cohortUpdate.mockResolvedValue({});
  h.contributionUpsert.mockResolvedValue({});
  h.contributionFindMany.mockResolvedValue([]);
  h.contributionDeleteMany.mockResolvedValue({});
  h.enablementFindUnique.mockResolvedValue({ enabled: true });
});

describe("leitura travada por tenant (specs/012)", () => {
  it("listCohorts recusa com a habilitação desligada, sem tocar nas coortes", async () => {
    h.enablementFindUnique.mockResolvedValue({ enabled: false });
    const res = await listCohorts();
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/benchmark não está habilitado/i);
    expect(h.cohortFindMany).not.toHaveBeenCalled();
  });

  it("readCohortAction recusa com a habilitação desligada, sem tocar na coorte", async () => {
    h.enablementFindUnique.mockResolvedValue({ enabled: false });
    const res = await readCohortAction({ cohortKey: "saude · 200–1.000" });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/benchmark não está habilitado/i);
    expect(h.cohortFindUnique).not.toHaveBeenCalled();
  });

  it("sem linha de habilitação recusa as duas leituras", async () => {
    h.enablementFindUnique.mockResolvedValue(null);
    expect((await listCohorts()).ok).toBe(false);
    expect((await readCohortAction({ cohortKey: "x · y" })).ok).toBe(false);
  });

  it("habilitação ligada (interno ou cliente): lê normal", async () => {
    h.enablementFindUnique.mockResolvedValue({ enabled: true });
    h.cohortFindMany.mockResolvedValue([
      { cohortKey: "saude · 200–1.000", n: 5, percentiles: BANDS },
    ]);
    const res = await listCohorts();
    expect(res.ok && res.data).toHaveLength(1);
    expect(h.enablementFindUnique.mock.calls[0][0].where).toEqual({
      tenantId: "t1",
    });
  });
});

describe("listCohorts", () => {
  it("retém a coorte abaixo do mínimo e não devolve percentil nenhum", async () => {
    h.cohortFindMany.mockResolvedValue([
      { cohortKey: "agro · 200–1.000", n: 3, percentiles: BANDS },
    ]);
    const res = await listCohorts();
    expect(res.ok).toBe(true);
    expect(res.ok && res.data[0]?.withheld).toBe(true);
    expect(JSON.stringify(res)).not.toContain("p50");
  });

  it("libera a coorte no limiar e devolve as bandas", async () => {
    h.cohortFindMany.mockResolvedValue([
      { cohortKey: "saude · 200–1.000", n: 5, percentiles: BANDS },
    ]);
    const res = await listCohorts();
    const row = res.ok ? res.data[0] : null;
    expect(row?.withheld).toBe(false);
    expect(row && row.withheld === false && row.bands.DATA.p50).toBe(52);
  });

  it("retém quando o agregado está incompleto — banda faltando não vira gráfico torto", async () => {
    h.cohortFindMany.mockResolvedValue([
      {
        cohortKey: "x · y",
        n: 9,
        percentiles: { DATA: BANDS.DATA },
      },
    ]);
    const res = await listCohorts();
    expect(res.ok && res.data[0]?.withheld).toBe(true);
  });
});

describe("readCohortAction", () => {
  it("devolve retido quando a coorte não existe", async () => {
    h.cohortFindUnique.mockResolvedValue(null);
    const res = await readCohortAction({ cohortKey: "novo · faixa" });
    expect(res.ok && res.data.withheld).toBe(true);
    expect(res.ok && res.data.n).toBe(0);
  });
});

describe("contributeInTx", () => {
  const db = {
    meridianAssessment: { findUnique: h.assessmentFindUnique },
    meridianBenchmarkEnablement: { findUnique: h.enablementFindUnique },
    auditLog: { create: h.auditCreate },
  } as never;

  // Benchmark travado por tenant (specs/012, FR-007/FR-008): a habilitação é
  // checada NO momento do scoring, e vale mais que um opt-in antigo.
  it("habilitação desligada não contribui, mesmo com opt-in antigo (SC-003)", async () => {
    h.enablementFindUnique.mockResolvedValue({ enabled: false });
    h.assessmentFindUnique.mockResolvedValue({
      id: "a1",
      tenantId: "t1",
      sector: "Saúde",
      sizeBand: "200–1.000",
      benchmarkOptIn: true,
      scores: [{ axis: "DATA", computed: 46, final: null }],
    });
    await contributeInTx(db, CTX as never, "a1");
    expect(h.contributionUpsert).not.toHaveBeenCalled();
    expect(h.cohortUpsert).not.toHaveBeenCalled();
    expect(h.cohortUpdate).not.toHaveBeenCalled();
  });

  it("tenant sem linha de habilitação não contribui", async () => {
    h.enablementFindUnique.mockResolvedValue(null);
    h.assessmentFindUnique.mockResolvedValue({
      id: "a1",
      tenantId: "t1",
      sector: "Saúde",
      sizeBand: "200–1.000",
      benchmarkOptIn: true,
      scores: [{ axis: "DATA", computed: 46, final: null }],
    });
    await contributeInTx(db, CTX as never, "a1");
    expect(h.contributionUpsert).not.toHaveBeenCalled();
  });

  it("habilitação ligada e opt-in marcado: contribui como hoje (FR-010)", async () => {
    h.assessmentFindUnique.mockResolvedValue({
      id: "a1",
      tenantId: "t1",
      sector: "Saúde",
      sizeBand: "200–1.000",
      benchmarkOptIn: true,
      scores: [{ axis: "DATA", computed: 46, final: null }],
    });
    await contributeInTx(db, CTX as never, "a1");
    expect(h.contributionUpsert).toHaveBeenCalledTimes(1);
    expect(h.enablementFindUnique.mock.calls[0][0].where).toEqual({
      tenantId: "t1",
    });
  });

  it("não contribui sem opt-in", async () => {
    h.assessmentFindUnique.mockResolvedValue({
      id: "a1",
      tenantId: "t1",
      sector: "Saúde",
      sizeBand: "200–1.000",
      benchmarkOptIn: false,
      scores: [{ axis: "DATA", computed: 46, final: null }],
    });
    await contributeInTx(db, CTX as never, "a1");
    expect(h.contributionUpsert).not.toHaveBeenCalled();
  });

  it("não contribui antes de existir score", async () => {
    h.assessmentFindUnique.mockResolvedValue({
      id: "a1",
      tenantId: "t1",
      sector: "Saúde",
      sizeBand: "200–1.000",
      benchmarkOptIn: true,
      scores: [],
    });
    await contributeInTx(db, CTX as never, "a1");
    expect(h.contributionUpsert).not.toHaveBeenCalled();
  });

  it("contribui com o score final, não com o computado, quando há override", async () => {
    h.assessmentFindUnique.mockResolvedValue({
      id: "a1",
      tenantId: "t1",
      sector: "Saúde",
      sizeBand: "200–1.000",
      benchmarkOptIn: true,
      scores: [{ axis: "GOVERNANCE", computed: 74, final: 66 }],
    });
    await contributeInTx(db, CTX as never, "a1");
    const call = h.contributionUpsert.mock.calls[0]?.[0] as {
      create: { score: number; cohortKey: string };
    };
    expect(call.create.score).toBe(66);
    expect(call.create.cohortKey).toBe("saude · 200–1.000");
  });

  it("não grava nada que identifique a organização", async () => {
    h.assessmentFindUnique.mockResolvedValue({
      id: "a1",
      tenantId: "t1",
      sector: "Saúde",
      sizeBand: "200–1.000",
      benchmarkOptIn: true,
      scores: [{ axis: "DATA", computed: 46, final: null }],
    });
    await contributeInTx(db, CTX as never, "a1");
    const call = h.contributionUpsert.mock.calls[0]?.[0] as {
      create: Record<string, unknown>;
    };
    expect(Object.keys(call.create).sort()).toEqual([
      "assessmentId",
      "axis",
      "cohortKey",
      "score",
    ]);
    expect(JSON.stringify(call.create)).not.toContain("Vanta");
  });
});

const OPTED_IN = {
  id: "a1",
  code: "AS-104",
  orgName: "Vanta Saúde",
  sector: "Saúde",
  sizeBand: "200–1.000",
  benchmarkOptIn: true,
};

describe("withdrawContribution", () => {
  it("apaga as contribuições e recalcula ao retirar o opt-in", async () => {
    h.assessmentFindFirst.mockResolvedValue(OPTED_IN);
    h.assessmentUpdate.mockResolvedValue({});
    const res = await withdrawContribution({
      assessmentId: "clx0000000000000000000as1",
    });
    expect(res.ok).toBe(true);
    expect(h.assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { benchmarkOptIn: false } })
    );
    expect(h.contributionDeleteMany).toHaveBeenCalledTimes(1);
    expect(h.cohortUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("getBenchmarkEnablement", () => {
  it("devolve a habilitação do tenant da sessão", async () => {
    h.enablementFindUnique.mockResolvedValue({ enabled: true });
    const res = await getBenchmarkEnablement();
    expect(res.ok && res.data).toEqual({ enabled: true });
    expect(h.enablementFindUnique.mock.calls[0][0].where).toEqual({
      tenantId: "t1",
    });
  });

  it("sem linha: desligado", async () => {
    h.enablementFindUnique.mockResolvedValue(null);
    const res = await getBenchmarkEnablement();
    expect(res.ok && res.data).toEqual({ enabled: false });
  });
});

// Achado 29c do Lacre: contribuir ao pool e retirar a contribuição são escritas
// de consentimento (opt-in, LGPD) e não deixavam trilha. A trilha diz o que
// mudou; coorte e contagem não identificam organização, então nada de PII.
describe("trilha de auditoria do benchmark", () => {
  const withScores = (over: Record<string, unknown> = {}) => ({
    id: "a1",
    code: "AS-104",
    orgName: "Vanta Saúde",
    tenantId: "t1",
    sector: "Saúde",
    sizeBand: "200–1.000",
    benchmarkOptIn: true,
    scores: [
      { axis: "DATA", computed: 46, final: null },
      { axis: "PROCESS", computed: 60, final: 62 },
    ],
    ...over,
  });
  const db = {
    meridianAssessment: { findUnique: h.assessmentFindUnique },
    meridianBenchmarkEnablement: { findUnique: h.enablementFindUnique },
    auditLog: { create: h.auditCreate },
  } as never;

  const auditData = () =>
    (
      h.auditCreate.mock.calls[0]?.[0] as {
        data: {
          action: string;
          entityType: string;
          entityId: string;
          tenantId: string;
          userId: string;
          diff: [string, string, string][];
          metadata: { target: string };
        };
      }
    ).data;

  it("contribuir grava meridian.benchmark.contribute, com a coorte e a contagem de eixos", async () => {
    h.assessmentFindUnique.mockResolvedValue(withScores());
    await contributeInTx(db, CTX as never, "a1");
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const a = auditData();
    expect(a.action).toBe("meridian.benchmark.contribute");
    expect(a.entityType).toBe("meridian.benchmark");
    expect(a.entityId).toBe("a1");
    expect(a.tenantId).toBe("t1");
    expect(a.userId).toBe("u1");
    expect(a.metadata.target).toBe("AS-104 · Vanta Saúde");
    expect(a.diff).toEqual([
      ["Coorte", "—", "saude · 200–1.000"],
      ["Eixos contribuídos", "—", "2"],
    ]);
  });

  it("os scores não vão para a trilha", async () => {
    h.assessmentFindUnique.mockResolvedValue(withScores());
    await contributeInTx(db, CTX as never, "a1");
    const written = JSON.stringify(h.auditCreate.mock.calls);
    expect(written).not.toContain("62");
    expect(written).not.toContain("46");
  });

  it("sem contribuição (sem opt-in, sem score, habilitação desligada) não grava trilha", async () => {
    h.assessmentFindUnique.mockResolvedValue(
      withScores({ benchmarkOptIn: false })
    );
    await contributeInTx(db, CTX as never, "a1");
    h.assessmentFindUnique.mockResolvedValue(withScores({ scores: [] }));
    await contributeInTx(db, CTX as never, "a1");
    h.enablementFindUnique.mockResolvedValue({ enabled: false });
    h.assessmentFindUnique.mockResolvedValue(withScores());
    await contributeInTx(db, CTX as never, "a1");
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("retirar o opt-in grava meridian.benchmark.withdraw na mesma transação", async () => {
    h.assessmentFindFirst.mockResolvedValue(OPTED_IN);
    h.assessmentUpdate.mockResolvedValue({});
    await withdrawContribution({ assessmentId: "clx0000000000000000000as1" });
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const a = auditData();
    expect(a.action).toBe("meridian.benchmark.withdraw");
    expect(a.entityType).toBe("meridian.benchmark");
    expect(a.entityId).toBe("a1");
    expect(a.metadata.target).toBe("AS-104 · Vanta Saúde");
    expect(a.diff).toEqual([["Opt-in de benchmark", "Ativo", "Retirado"]]);
  });

  it("assessment de outro tenant (não encontrado) não grava trilha", async () => {
    h.assessmentFindFirst.mockResolvedValue(null);
    await withdrawContribution({ assessmentId: "clx0000000000000000000as1" });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });
});
