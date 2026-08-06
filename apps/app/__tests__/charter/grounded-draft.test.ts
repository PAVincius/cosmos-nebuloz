import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  sectionFindFirst: vi.fn(),
  sectionUpdate: vi.fn(),
  reqFindFirst: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
}));
// saveGeneratedDraft chama revalidatePath — sem mock, a chamada real lança
// "Invariant: static generation store missing" fora de um request Next.js, e
// safeAction converte isso em res.ok:false mesmo com a lógica correta.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterPolicySection: {
        findFirst: h.sectionFindFirst,
        update: h.sectionUpdate,
      },
      charterRequirement: { findFirst: h.reqFindFirst },
      auditLog: { create: h.auditCreate },
    }),
}));

import { saveGeneratedDraft } from "../../app/(charter)/actions/policy";

// cuid válido: DraftSchema.sectionId usa z.string().cuid(), então um id tipo
// "sec-1" falha a validação de formato antes mesmo de chegar à regra de
// fundamento — o que estava sendo testado aqui.
const SECTION_ID = "cksection000000000000001";

describe("saveGeneratedDraft", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue({
      tenantId: "t-1",
      userId: "u-1",
      charterRole: "COMPLIANCE_LEAD",
      user: { name: "Bia", email: "bia@x.com" },
    });
    h.sectionFindFirst.mockResolvedValue({
      id: SECTION_ID,
      ordinal: 3,
      name: "Uso aceitável",
    });
    h.reqFindFirst.mockResolvedValue({ id: "r-1", citacao: "Art. 9º" });
    h.sectionUpdate.mockResolvedValue({ id: SECTION_ID });
  });

  it("grava o fundamento junto do rascunho", async () => {
    const res = await saveGeneratedDraft({
      sectionId: SECTION_ID,
      body: "Texto gerado.",
      groundedRequirementId: "r-1",
    });

    expect(res.ok).toBe(true);
    expect(h.sectionUpdate.mock.calls[0][0].data.groundedRequirementId).toBe(
      "r-1"
    );

    // Exigência escopada por tenant OU global (mesmo padrão de
    // compliance.ts/setCoverage) — sem isso, requirementId de outro tenant
    // vira oráculo de existência.
    expect(h.reqFindFirst).toHaveBeenCalledWith({
      where: {
        id: "r-1",
        set: { OR: [{ tenantId: "t-1" }, { tenantId: null }] },
      },
    });

    // A citação entra no target da auditoria — sem isso, a trilha registra
    // que um rascunho foi gerado mas não com base em quê.
    const auditCall = h.auditCreate.mock.calls[0][0];
    expect(auditCall.data.metadata.target).toContain("Art. 9º");
  });

  it("recusa rascunho sem fundamento — geração sem citação é estado inválido", async () => {
    const res = await saveGeneratedDraft({
      sectionId: SECTION_ID,
      body: "Texto gerado sem base.",
    } as never);

    expect(res.ok).toBe(false);
    expect(h.sectionUpdate).not.toHaveBeenCalled();
  });

  it("recusa fundamento inexistente", async () => {
    h.reqFindFirst.mockResolvedValue(null);

    const res = await saveGeneratedDraft({
      sectionId: SECTION_ID,
      body: "Texto.",
      groundedRequirementId: "r-inventado",
    });

    expect(res.ok).toBe(false);
    expect(h.sectionUpdate).not.toHaveBeenCalled();
    if (!res.ok) {
      expect(res.error).toContain(
        "Exigência que fundamenta o rascunho não encontrada"
      );
    }
  });
});
