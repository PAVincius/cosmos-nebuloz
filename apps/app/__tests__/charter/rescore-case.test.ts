// rescore-case.test.ts — `rescoreCase` ganha tela e deixa de ser a única
// escrita de risco sem rastro legível. Três coisas mudam: justificativa passa a
// ser obrigatória (princípio 2 do PRODUCT.md: toda decisão leva justificativa),
// a pontuação marca `riskScoredAt` (é o que separa "alguém avaliou" do default
// 1 do intake) e a primeira pontuação aparece na trilha mesmo quando os sete
// eixos ficam em 1 — sem isso o diff sai vazio e o auditor não vê que houve
// avaliação.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  requireContext: vi.fn(),
  revalidatePath: vi.fn(),
  useCaseFindUnique: vi.fn(),
  useCaseUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
  requireCharterContext: h.requireContext,
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterUseCase: {
        findUnique: h.useCaseFindUnique,
        update: h.useCaseUpdate,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import { rescoreCase } from "../../app/(charter)/actions/cases";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "SECURITY",
  user: { name: "Diego", email: "diego@x.com" },
};

const flat = (n: number) => ({
  privacy: n,
  regulatory: n,
  security: n,
  bias: n,
  ip: n,
  operational: n,
  reputational: n,
});

function caso(over: Record<string, unknown> = {}) {
  return {
    id: "uc-1",
    tenantId: "t-1",
    code: "UC-003",
    title: "Triagem de sinistros",
    riskPrivacy: 1,
    riskRegulatory: 1,
    riskSecurity: 1,
    riskBias: 1,
    riskIp: 1,
    riskOperational: 1,
    riskReputational: 1,
    riskScoredAt: null,
    ...over,
  };
}

const NOTA = "Fornecedor passou a reter prompts por 30 dias.";

describe("rescoreCase", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.useCaseUpdate.mockResolvedValue({});
    h.auditCreate.mockResolvedValue({});
  });

  it("sem justificativa, recusa e não grava nada", async () => {
    h.useCaseFindUnique.mockResolvedValue(caso());

    const res = await rescoreCase({ code: "UC-003", risks: flat(3), note: "" });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toMatch(/justificativa/i);
    expect(h.useCaseUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("grava os sete eixos e marca quando o risco foi pontuado", async () => {
    h.useCaseFindUnique.mockResolvedValue(caso());

    const res = await rescoreCase({
      code: "UC-003",
      risks: { ...flat(2), privacy: 5 },
      note: NOTA,
    });

    expect(res.ok).toBe(true);
    const update = h.useCaseUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: "uc-1" });
    expect(update.data).toMatchObject({
      riskPrivacy: 5,
      riskRegulatory: 2,
      riskSecurity: 2,
      riskBias: 2,
      riskIp: 2,
      riskOperational: 2,
      riskReputational: 2,
    });
    expect(update.data.riskScoredAt).toBeInstanceOf(Date);
  });

  it("primeira pontuação com os sete eixos em 1 aparece na trilha: 'sem pontuação' → 1", async () => {
    h.useCaseFindUnique.mockResolvedValue(caso());

    await rescoreCase({ code: "UC-003", risks: flat(1), note: NOTA });

    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const audit = h.auditCreate.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      action: "Reavaliou risco",
      entityType: "charter.risk",
      entityId: "uc-1",
    });
    expect(audit.diff).toContainEqual(["Score de risco", "sem pontuação", "1"]);
    expect(audit.metadata.note).toBe(NOTA);
  });

  it("reavaliação de caso já pontuado registra só o que mudou, com o score anterior", async () => {
    h.useCaseFindUnique.mockResolvedValue(
      caso({ riskPrivacy: 3, riskScoredAt: new Date("2026-09-01") })
    );

    await rescoreCase({
      code: "UC-003",
      risks: { ...flat(1), privacy: 4 },
      note: NOTA,
    });

    const { diff } = h.auditCreate.mock.calls[0][0].data;
    expect(diff).toEqual([
      ["Privacidade", "3", "4"],
      ["Severidade geral", "3", "4"],
      ["Score de risco", "3", "4"],
    ]);
  });

  it("exige o papel de risk.score e busca o caso no tenant da sessão", async () => {
    h.useCaseFindUnique.mockResolvedValue(caso());

    await rescoreCase({ code: "UC-003", risks: flat(2), note: NOTA });

    expect(h.requireCtx).toHaveBeenCalledWith("risk.score");
    expect(h.useCaseFindUnique.mock.calls[0][0].where).toEqual({
      tenantId_code: { tenantId: "t-1", code: "UC-003" },
    });
  });
});
