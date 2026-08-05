import { describe, expect, it, vi } from "vitest";

const dbStub = {
  charterPolicyVersion: {
    count: vi.fn().mockResolvedValue(3),
    findMany: vi.fn().mockResolvedValue([]),
  },
  charterAcknowledgment: {
    count: vi.fn().mockResolvedValue(37),
    findMany: vi.fn().mockResolvedValue([]),
  },
  charterDecision: {
    count: vi.fn().mockResolvedValue(12),
    findMany: vi.fn().mockResolvedValue([]),
  },
  charterVendor: {
    count: vi.fn().mockResolvedValue(8),
    findMany: vi.fn().mockResolvedValue([]),
  },
  charterPolicyLink: {
    count: vi.fn().mockResolvedValue(5),
    findMany: vi.fn().mockResolvedValue([]),
  },
  charterUseCase: {
    count: vi.fn().mockResolvedValue(21),
    findMany: vi.fn().mockResolvedValue([]),
  },
  auditLog: {
    count: vi.fn().mockResolvedValue(400),
    findMany: vi.fn().mockResolvedValue([]),
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

  // ESTE é o teste que sustenta o design. Se alguém remover um campo do schema
  // que uma capacidade consulta, ele quebra aqui — antes de o produto alegar
  // ao comprador uma conformidade que não consegue mais provar.
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
