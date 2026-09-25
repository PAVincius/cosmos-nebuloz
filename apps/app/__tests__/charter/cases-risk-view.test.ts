// cases-risk-view.test.ts — o que a leitura de caso entrega quando ninguém
// pontuou o risco. Antes, todo caso criado pela tela saía como "1 · Baixo":
// o default do schema lido como medição (SRD §7, "cuidado com valor padrão").
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireContext: vi.fn(),
  requireCtx: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireContext,
  requireCharterPermissionContext: h.requireCtx,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/feriados", () => ({
  feriadosAbertos: () => Promise.resolve(new Set<string>()),
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterUseCase: { findMany: h.findMany, findUnique: h.findUnique },
    }),
}));

import { getCase, listCases } from "../../app/(charter)/actions/cases";

function caso(over: Record<string, unknown> = {}) {
  return {
    id: "uc-1",
    tenantId: "t-1",
    code: "UC-003",
    title: "Triagem de sinistros",
    department: "Operações",
    ownerName: "Bia",
    objective: "Reduzir o tempo de triagem.",
    vendorId: null,
    vendor: null,
    exposure: "INTERNAL",
    dataClass: "INTERNAL",
    criticality: "MEDIUM",
    status: "SUBMITTED",
    approvalPath: "Segurança",
    slaTotal: null,
    hitl: null,
    submittedAt: null,
    riskPrivacy: 1,
    riskRegulatory: 1,
    riskSecurity: 1,
    riskBias: 1,
    riskIp: 1,
    riskOperational: 1,
    riskReputational: 1,
    riskScoredAt: null,
    restrictions: [],
    blockReason: null,
    changeRequest: null,
    vendorIneligible: false,
    mitigations: [],
    decisions: [],
    ...over,
  };
}

const ctx = (charterRole: string) => ({
  tenantId: "t-1",
  userId: "u-1",
  charterRole,
  user: { name: "Bia", email: "bia@x.com" },
});

describe("leitura de caso sem pontuação de risco", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireContext.mockResolvedValue(ctx("SECURITY"));
  });

  it("listCases: caso que ninguém pontuou sai sem número, com 'sem pontuação' escrito", async () => {
    h.findMany
      .mockResolvedValueOnce([
        caso(),
        caso({ id: "uc-2", code: "UC-004", riskPrivacy: 4 }),
      ])
      .mockResolvedValueOnce([]);

    const res = await listCases();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const [semPontuacao, pontuado] = res.data.rows;
    expect(semPontuacao).toMatchObject({
      score: null,
      riskLabel: "sem pontuação",
      riskTone: "accent",
    });
    // privacidade 4, resto 1: severidade 4 × probabilidade round(10/7) = 1.
    expect(pontuado).toMatchObject({ score: 4, riskLabel: "Moderado" });
  });

  it("getCase: sem pontuação não entrega eixos, severidade nem probabilidade", async () => {
    h.findUnique.mockResolvedValue(caso());

    const res = await getCase("UC-003");

    expect(res.ok).toBe(true);
    if (!(res.ok && res.data)) {
      return;
    }
    expect(res.data.score).toBeNull();
    expect(res.data.severity).toBeNull();
    expect(res.data.likelihood).toBeNull();
    expect(res.data.risks).toBeNull();
  });

  it("getCase: caso pontuado com os sete eixos em 1 mostra 1 · Baixo", async () => {
    h.findUnique.mockResolvedValue(
      caso({ riskScoredAt: new Date("2026-09-20") })
    );

    const res = await getCase("UC-003");

    if (!(res.ok && res.data)) {
      throw new Error("esperava caso");
    }
    expect(res.data.score).toBe(1);
    expect(res.data.riskLabel).toBe("Baixo");
    expect(res.data.risks).toMatchObject({ privacy: 1, reputational: 1 });
  });

  it("getCase: Segurança pontua risco; Requester recebe o motivo nominal", async () => {
    h.findUnique.mockResolvedValue(caso());
    const seguranca = await getCase("UC-003");

    h.requireContext.mockResolvedValue(ctx("REQUESTER"));
    const requester = await getCase("UC-003");

    if (!(seguranca.ok && seguranca.data && requester.ok && requester.data)) {
      throw new Error("esperava caso");
    }
    expect(seguranca.data.can.score).toBe(true);
    expect(requester.data.can.score).toBe(false);
    expect(requester.data.scoreDenial).toBe(
      "Requer papel Compliance ou Segurança — Pontuar risco e criar mitigação"
    );
  });
});
