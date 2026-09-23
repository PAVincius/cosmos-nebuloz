// risk-board.test.ts — a matriz de risco só posiciona risco avaliado. Caso
// criado pela tela nasce com os sete eixos em 1 e caía na célula 1×1 como se
// alguém tivesse medido "Baixo" (PRD FR-7).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireContext: vi.fn(),
  useCaseFindMany: vi.fn(),
  mitigationFindMany: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  GovernanceError: class extends Error {},
  requireCharterContext: h.requireContext,
  requireCharterPermissionContext: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterUseCase: { findMany: h.useCaseFindMany },
      charterMitigation: { findMany: h.mitigationFindMany },
    }),
}));

import { getRiskBoard } from "../../app/(charter)/actions/risk";

function caso(code: string, privacy: number, riskScoredAt: Date | null) {
  return {
    code,
    title: `Caso ${code}`,
    status: "SUBMITTED",
    dataClass: "INTERNAL",
    riskPrivacy: privacy,
    riskRegulatory: 1,
    riskSecurity: 1,
    riskBias: 1,
    riskIp: 1,
    riskOperational: 1,
    riskReputational: 1,
    riskScoredAt,
  };
}

describe("getRiskBoard com caso sem pontuação", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireContext.mockResolvedValue({ tenantId: "t-1" });
    h.mitigationFindMany.mockResolvedValue([]);
    h.useCaseFindMany.mockResolvedValue([
      caso("UC-001", 4, null),
      caso("UC-002", 1, null),
    ]);
  });

  it("o caso sem pontuação fica fora do mapa de calor", async () => {
    const res = await getRiskBoard();
    if (!res.ok) {
      throw new Error(res.error);
    }
    const posicionados = res.data.heatmap.reduce((n, c) => n + c.count, 0);
    expect(posicionados).toBe(1);
    const umPorUm = res.data.heatmap.find(
      (c) => c.severity === 1 && c.likelihood === 1
    );
    expect(umPorUm?.count).toBe(0);
  });

  it("o caso sem pontuação continua na lista, sem número", async () => {
    const res = await getRiskBoard();
    if (!res.ok) {
      throw new Error(res.error);
    }
    const semPontuacao = res.data.cases.find((c) => c.code === "UC-002");
    expect(semPontuacao).toMatchObject({
      score: null,
      severity: null,
      likelihood: null,
      label: "sem pontuação",
    });
  });

  it("exposição por categoria soma só o risco avaliado", async () => {
    const res = await getRiskBoard();
    if (!res.ok) {
      throw new Error(res.error);
    }
    const regulatorio = res.data.categories.find((c) => c.id === "REGULATORY");
    // Só UC-001 conta: regulatório 1. Com UC-002 junto, o default somaria 2.
    expect(regulatorio).toMatchObject({ total: 1, max: 1 });
  });
});
