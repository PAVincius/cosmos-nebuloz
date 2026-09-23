// dashboard-queue-risk.test.ts — a fila de decisão da Visão Geral é onde o
// caso recém-submetido aparece primeiro, e é justamente o caso que ninguém
// pontuou. Ali "1 · Baixo" era o default do schema lido como fato.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireContext: vi.fn(),
  useCaseFindMany: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireContext,
}));
vi.mock("@/lib/feriados", () => ({
  feriadosAbertos: () => Promise.resolve(new Set<string>()),
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      tenant: {
        findUniqueOrThrow: () => Promise.resolve({ name: "Aurora Bank" }),
      },
      charterSettings: { findUnique: () => Promise.resolve(null) },
      charterUseCase: { findMany: h.useCaseFindMany },
      charterMitigation: { findMany: () => Promise.resolve([]) },
      charterAcknowledgment: { findMany: () => Promise.resolve([]) },
      charterPolicy: { findFirst: () => Promise.resolve(null) },
      charterVendor: { findMany: () => Promise.resolve([]) },
      user: {
        findMany: () => Promise.resolve([]),
        findUnique: () => Promise.resolve(null),
      },
    }),
}));

import { getDashboard } from "../../app/(charter)/actions/dashboard";

function caso(code: string, privacy: number) {
  return {
    code,
    title: `Caso ${code}`,
    status: "SUBMITTED",
    dataClass: "INTERNAL",
    reviewerId: null,
    submittedAt: new Date("2026-09-22"),
    slaTotal: 3,
    riskPrivacy: privacy,
    riskRegulatory: 1,
    riskSecurity: 1,
    riskBias: 1,
    riskIp: 1,
    riskOperational: 1,
    riskReputational: 1,
    riskScoredAt: null,
  };
}

describe("getDashboard — fila com caso sem pontuação", () => {
  beforeEach(() => {
    h.requireContext.mockResolvedValue({ tenantId: "t-1" });
    h.useCaseFindMany.mockResolvedValue([caso("UC-001", 1), caso("UC-002", 4)]);
  });

  it("caso sem pontuação entra na fila sem número e com 'sem pontuação' escrito", async () => {
    const res = await getDashboard();
    if (!res.ok) {
      throw new Error(res.error);
    }
    const semPontuacao = res.data.queue.find((q) => q.code === "UC-001");
    const pontuado = res.data.queue.find((q) => q.code === "UC-002");
    expect(semPontuacao).toMatchObject({
      score: null,
      riskLabel: "sem pontuação",
      riskTone: "accent",
    });
    expect(pontuado).toMatchObject({ score: 4, riskLabel: "Moderado" });
  });
});
