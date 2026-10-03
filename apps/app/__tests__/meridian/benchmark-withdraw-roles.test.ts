import { beforeEach, describe, expect, it, vi } from "vitest";

// Achado 11 do Vigia (MÉDIO): `withdrawContribution` só pedia `requireMeridianContext`
// (qualquer papel de diagnóstico). VIEWER e REVIEWER conseguiam retirar o
// consentimento de benchmark e apagar a contribuição de QUALQUER assessment do
// tenant. Retirar o opt-in é decisão de quem conduz o assessment: exige
// `assessment.manage`, igual a criar o assessment com o opt-in ligado.
//
// O guard é o REAL (sessão, módulo e papel mockados no limite, matriz real): o
// que se prova é a combinação papel × permissão, não um mock que diz sim.

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  hasModule: vi.fn(),
  getMeridianRole: vi.fn(),
  assessmentFindFirst: vi.fn(),
  assessmentUpdate: vi.fn(),
  deleteMany: vi.fn(),
  cohortUpdate: vi.fn(),
  contributionFindMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
vi.mock("@repo/auth/server", async () => {
  class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message?: string) {
      super(message);
      this.code = code;
      this.name = "AuthError";
    }
  }
  return { AuthError, requireTenantSession: h.requireTenantSession };
});
vi.mock("@repo/rbac", async () => {
  const actual = await vi.importActual<
    typeof import("@repo/rbac/src/meridian-matrix")
  >("../../../../packages/rbac/src/meridian-matrix");
  return {
    hasModule: h.hasModule,
    getMeridianRole: h.getMeridianRole,
    hasMeridianPermission: actual.hasMeridianPermission,
    meridianDenialReason: actual.meridianDenialReason,
  };
});
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianAssessment: {
        findFirst: h.assessmentFindFirst,
        update: h.assessmentUpdate,
      },
      auditLog: { create: h.auditCreate },
    }),
  database: {
    meridianBenchmarkContribution: {
      deleteMany: h.deleteMany,
      findMany: h.contributionFindMany,
    },
    meridianBenchmarkCohort: { update: h.cohortUpdate },
  },
}));

import { withdrawContribution } from "@/app/(meridian)/actions/benchmark";

const AS_ID = "clx0000000000000000000as1";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue({
    tenantId: "t1",
    userId: "u1",
    role: "ADMIN",
    user: { name: "Ana", email: "a@x.com" },
  });
  h.hasModule.mockResolvedValue(true);
  h.assessmentFindFirst.mockResolvedValue({
    id: "a1",
    code: "AS-104",
    orgName: "Vanta Saúde",
    sector: "Saúde",
    sizeBand: "200–1.000",
    benchmarkOptIn: true,
  });
  h.assessmentUpdate.mockResolvedValue({});
  h.deleteMany.mockResolvedValue({ count: 3 });
  h.contributionFindMany.mockResolvedValue([]);
  h.cohortUpdate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
});

describe("withdrawContribution por papel", () => {
  it.each([
    "VIEWER",
    "REVIEWER",
  ])("%s é recusado e nada é tocado", async (role) => {
    h.getMeridianRole.mockResolvedValue(role);
    const res = await withdrawContribution({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(h.assessmentFindFirst).not.toHaveBeenCalled();
    expect(h.assessmentUpdate).not.toHaveBeenCalled();
    expect(h.deleteMany).not.toHaveBeenCalled();
    expect(h.cohortUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("a recusa diz o que faltou, em linguagem de produto", async () => {
    h.getMeridianRole.mockResolvedValue("VIEWER");
    const res = await withdrawContribution({ assessmentId: AS_ID });
    expect(!res.ok && res.error).toMatch(/assessment/i);
  });

  it("CONSULTANT retira o opt-in, apaga a contribuição e deixa a trilha", async () => {
    h.getMeridianRole.mockResolvedValue("CONSULTANT");
    const res = await withdrawContribution({ assessmentId: AS_ID });
    expect(res.ok).toBe(true);
    expect(h.assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { benchmarkOptIn: false } })
    );
    expect(h.deleteMany).toHaveBeenCalledTimes(1);
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
  });

  it("quem não tem papel nenhum no Meridian também é recusado", async () => {
    h.getMeridianRole.mockResolvedValue(null);
    const res = await withdrawContribution({ assessmentId: AS_ID });
    expect(res.ok).toBe(false);
    expect(h.deleteMany).not.toHaveBeenCalled();
  });
});
