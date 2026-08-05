import { describe, expect, it, vi } from "vitest";

// Uma linha realista por model — não [] — para que os formatadores de
// `amostra` (o `.map()` de cada capacidade) executem de verdade. É lá que a
// maioria dos campos referenciados por capabilities.ts aparece; com []
// nenhum `.map()` roda e o teste nunca exercita esse código. O caso de
// `charterAcknowledgment` inclui uma linha com `acknowledgedAt: null` porque
// esse é o único campo opcional lido pelos formatadores (schema: `DateTime?`)
// — é onde um `.toLocaleDateString()` sem guarda quebraria.
const dbStub = {
  charterPolicyVersion: {
    count: vi.fn().mockResolvedValue(3),
    findMany: vi.fn().mockResolvedValue([{ version: "3.2", changeCount: 5 }]),
  },
  charterAcknowledgment: {
    count: vi.fn().mockResolvedValue(37),
    findMany: vi.fn().mockResolvedValue([
      { personName: "Bia", acknowledgedAt: new Date("2026-07-12") },
      { personName: "Caio", acknowledgedAt: null },
    ]),
  },
  charterDecision: {
    count: vi.fn().mockResolvedValue(12),
    findMany: vi.fn().mockResolvedValue([
      {
        outcome: "APPROVED",
        conditions: ["Revisão trimestral"],
        createdAt: new Date("2026-07-01"),
      },
    ]),
  },
  charterVendor: {
    count: vi.fn().mockResolvedValue(8),
    findMany: vi
      .fn()
      .mockResolvedValue([{ name: "Acme Cloud", tier: "APPROVED" }]),
  },
  charterPolicyLink: {
    count: vi.fn().mockResolvedValue(5),
    findMany: vi
      .fn()
      .mockResolvedValue([{ alvoTipo: "USE_CASE", alvoId: "uc-1" }]),
  },
  charterUseCase: {
    count: vi.fn().mockResolvedValue(21),
    findMany: vi
      .fn()
      .mockResolvedValue([{ code: "UC-118", riskPrivacy: 4, probPrivacy: 3 }]),
  },
  auditLog: {
    count: vi.fn().mockResolvedValue(400),
    findMany: vi
      .fn()
      .mockResolvedValue([
        { action: "Exportou pacote", createdAt: new Date("2026-07-20") },
      ]),
  },
};

vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) => fn(dbStub),
}));

import { CAPABILITIES, getCapability } from "@/lib/charter/capabilities";

describe("catálogo de capacidades", () => {
  it("tem id único por entrada", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda capacidade tem rótulo em pt-BR não vazio", () => {
    for (const c of CAPABILITIES) {
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  // Sozinho, este teste só garante forma: `evidencia()` roda sem lançar e
  // devolve { total: number, amostra: array }. Com linha realista no stub
  // (não []), o `.map()` de cada formatador executa de fato — mas isto não
  // valida nome de coluna contra o banco real, só contra o objeto stub acima.
  // Quem pega campo removido do schema é o `tsc --noEmit` (job obrigatório do
  // CI), compilando cada `select`/`.map()` contra o Prisma Client gerado. As
  // duas coisas juntas impedem o produto de alegar ao comprador uma
  // conformidade que não consegue mais provar; rodar só `vitest` não basta.
  it.each(
    CAPABILITIES.map((c) => [c.id, c] as const)
  )("%s consegue buscar a própria evidência", async (_id, cap) => {
    const ev = await cap.evidencia("t-1");
    expect(typeof ev.total).toBe("number");
    expect(Array.isArray(ev.amostra)).toBe(true);
  });

  it("getCapability devolve undefined para id desconhecido, sem lançar", () => {
    expect(getCapability("NAO_EXISTE")).toBeUndefined();
  });
});
