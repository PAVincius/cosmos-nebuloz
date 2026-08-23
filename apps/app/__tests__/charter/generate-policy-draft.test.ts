import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  sectionFindFirst: vi.fn(),
  sectionUpdate: vi.fn(),
  casosFindMany: vi.fn(),
  fornecedoresFindMany: vi.fn(),
  coverageFindMany: vi.fn(),
  reqFindMany: vi.fn(),
  auditCreate: vi.fn(),
  // Prova de que a IA roda fora de qualquer $transaction (C2): true só
  // durante a execução do callback passado a withTenantDb.
  dentroDaTransacao: false,
}));

const ia = vi.hoisted(() => ({
  generateText: vi.fn(),
  getAIModel: vi.fn().mockReturnValue({}),
  getActiveProvider: vi.fn().mockReturnValue("anthropic"),
}));

const cota = vi.hoisted(() => ({
  limit: vi.fn(),
  createRateLimiter: vi.fn(),
  fixedWindow: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("ai", () => ({ generateText: ia.generateText }));
vi.mock("@repo/ai/lib/models", () => ({
  getAIModel: ia.getAIModel,
  getActiveProvider: ia.getActiveProvider,
}));
vi.mock("@repo/rate-limit", () => ({
  createRateLimiter: cota.createRateLimiter,
  fixedWindow: cota.fixedWindow,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: async (_t: string, fn: (db: unknown) => unknown) => {
    h.dentroDaTransacao = true;
    try {
      return await fn({
        charterPolicySection: {
          findFirst: h.sectionFindFirst,
          update: h.sectionUpdate,
        },
        charterUseCase: { findMany: h.casosFindMany },
        charterVendor: { findMany: h.fornecedoresFindMany },
        charterCoverage: { findMany: h.coverageFindMany },
        charterRequirement: { findMany: h.reqFindMany },
        auditLog: { create: h.auditCreate },
      });
    } finally {
      h.dentroDaTransacao = false;
    }
  },
}));

import { generatePolicyDraft } from "../../app/(charter)/actions/policy-generate";

// cuid válido: GenerateDraftSchema.sectionId usa z.string().cuid() — mesmo id
// de grounded-draft.test.ts.
const SECTION_ID = "cksection000000000000001";

function draftSection(status: "DRAFT" | "REVIEW" | "PUBLISHED" = "DRAFT") {
  return {
    id: SECTION_ID,
    tenantId: "t-1",
    ordinal: 2,
    name: "Classificação de dados",
    status,
  };
}

describe("generatePolicyDraft", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      if (typeof m === "function" && "mockReset" in m) {
        m.mockReset();
      }
    }
    h.dentroDaTransacao = false;
    for (const m of Object.values(ia)) {
      m.mockReset();
    }
    for (const m of Object.values(cota)) {
      m.mockReset();
    }

    h.requireCtx.mockResolvedValue({
      tenantId: "t-1",
      userId: "u-1",
      charterRole: "COMPLIANCE_LEAD",
      user: { name: "Bia", email: "bia@x.com" },
    });
    h.sectionFindFirst.mockResolvedValue(draftSection());
    h.casosFindMany.mockResolvedValue([
      {
        code: "UC-01",
        title: "Triagem de sinistros",
        department: "Sinistros",
        riskPrivacy: 5,
        riskRegulatory: 1,
        riskSecurity: 1,
        riskBias: 1,
        riskIp: 1,
        riskOperational: 1,
        riskReputational: 1,
      },
    ]);
    h.fornecedoresFindMany.mockResolvedValue([
      { name: "OpenAI", tier: "APPROVED" },
    ]);
    h.coverageFindMany.mockResolvedValue([{ requirementId: "req-1" }]);
    h.reqFindMany.mockImplementation(
      (args: { where: { id?: unknown; setId?: unknown } }) => {
        if (args.where.id) {
          return Promise.resolve([{ setId: "set-1" }]);
        }
        return Promise.resolve([
          {
            id: "req-1",
            codigo: "SEC-02-01",
            citacao: "§2",
            resumo: "Classificar por sensibilidade todo dado.",
            categoria: "dados",
            peso: 5,
          },
        ]);
      }
    );
    h.auditCreate.mockResolvedValue({});

    cota.createRateLimiter.mockReturnValue({ limit: cota.limit });
    cota.limit.mockResolvedValue({
      success: true,
      reset: Date.now() + 86_400_000,
    });
    ia.getActiveProvider.mockReturnValue("anthropic");
    ia.getAIModel.mockReturnValue({});
    ia.generateText.mockResolvedValue({ text: "x".repeat(300) });
  });

  it.each([
    "REVIEW",
    "PUBLISHED",
  ] as const)("seção %s recusa geração — só DRAFT recebe rascunho gerado", async (status) => {
    h.sectionFindFirst.mockResolvedValue(draftSection(status));

    const res = await generatePolicyDraft({ sectionId: SECTION_ID });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("não recebe rascunho gerado");
    }
    expect(ia.generateText).not.toHaveBeenCalled();
  });

  it("cota negada recusa antes de chamar a IA", async () => {
    cota.limit.mockResolvedValue({
      success: false,
      reset: Date.now() + 3 * 86_400_000,
    });

    const res = await generatePolicyDraft({ sectionId: SECTION_ID });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      const match = res.error.match(/renova em (\d+) dia/);
      expect(match).toBeTruthy();
      expect(Number(match?.[1])).toBeGreaterThanOrEqual(1);
    }
    expect(ia.generateText).not.toHaveBeenCalled();
  });

  it("resposta curta demais (< 200 chars) falha sem persistir nem auditar nada", async () => {
    ia.generateText.mockResolvedValue({ text: "curto demais" });

    const res = await generatePolicyDraft({ sectionId: SECTION_ID });

    expect(res.ok).toBe(false);
    expect(h.sectionUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("sucesso — devolve grounded e audita sem persistir a seção", async () => {
    const res = await generatePolicyDraft({ sectionId: SECTION_ID });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.grounded.length).toBeGreaterThan(0);
      expect(res.data.grounded[0].id).toBe("req-1");
      expect(res.data.body.length).toBeGreaterThan(0);
    }

    expect(h.sectionUpdate).not.toHaveBeenCalled();

    const auditCall = h.auditCreate.mock.calls[0][0];
    expect(auditCall.data.action).toBe("Gerou rascunho por IA");
    expect(auditCall.data.metadata.note).toContain("exigência");
  });

  it("todas as consultas de inventário são escopadas por tenantId — prova de isolamento", async () => {
    const res = await generatePolicyDraft({ sectionId: SECTION_ID });
    expect(res.ok).toBe(true);

    expect(h.casosFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "t-1",
    });
    expect(h.fornecedoresFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "t-1",
    });
    expect(h.coverageFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "t-1",
    });
    for (const call of h.reqFindMany.mock.calls) {
      const where = call[0].where as { set?: { OR?: unknown[] } };
      expect(where.set?.OR).toContainEqual({ tenantId: "t-1" });
    }
  });

  it("provider de IA indisponível recusa com mensagem clara e não queima cota (I4)", async () => {
    ia.getActiveProvider.mockReturnValue("none");

    const res = await generatePolicyDraft({ sectionId: SECTION_ID });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Nenhum provedor");
    }
    expect(ia.generateText).not.toHaveBeenCalled();
    // Provider checado ANTES da cota (I4): sem provedor, limiter.limit nem
    // chega a rodar — um tenant sem chave de IA não pode queimar uma das 30
    // gerações/mês por um erro de configuração da plataforma.
    expect(cota.limit).not.toHaveBeenCalled();
  });

  it("generateText roda fora de qualquer withTenantDb (C2) — prova de mutação: mova a IA pra dentro da transação e este teste cai", async () => {
    let dentroDaTransacaoNaChamada: boolean | undefined;
    ia.generateText.mockImplementation(() => {
      dentroDaTransacaoNaChamada = h.dentroDaTransacao;
      return Promise.resolve({ text: "x".repeat(300) });
    });

    const res = await generatePolicyDraft({ sectionId: SECTION_ID });

    expect(res.ok).toBe(true);
    expect(dentroDaTransacaoNaChamada).toBe(false);
  });

  it("consultas e cota escopadas por tenantId, com os parâmetros certos (M9)", async () => {
    const res = await generatePolicyDraft({ sectionId: SECTION_ID });
    expect(res.ok).toBe(true);

    expect(h.sectionFindFirst.mock.calls[0][0].where).toMatchObject({
      id: SECTION_ID,
      tenantId: "t-1",
    });
    expect(cota.fixedWindow).toHaveBeenCalledWith(30, "30 d");
    expect(cota.createRateLimiter).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "charter:policy-gen" })
    );
  });
});
