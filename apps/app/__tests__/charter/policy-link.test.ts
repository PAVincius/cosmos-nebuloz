import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  requireContext: vi.fn(),
  withTenantDb: vi.fn(),
  policyFindFirst: vi.fn(),
  useCaseFindFirst: vi.fn(),
  useCaseFindMany: vi.fn(),
  vendorFindFirst: vi.fn(),
  vendorFindMany: vi.fn(),
  linkCreate: vi.fn(),
  linkDeleteMany: vi.fn(),
  linkFindMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
  requireCharterContext: h.requireContext,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterPolicy: { findFirst: h.policyFindFirst },
      charterUseCase: {
        findFirst: h.useCaseFindFirst,
        findMany: h.useCaseFindMany,
      },
      charterVendor: {
        findFirst: h.vendorFindFirst,
        findMany: h.vendorFindMany,
      },
      charterPolicyLink: {
        create: h.linkCreate,
        deleteMany: h.linkDeleteMany,
        findMany: h.linkFindMany,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import {
  getPolicyScope,
  linkPolicy,
  unlinkPolicy,
} from "../../app/(charter)/actions/policy";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "COMPLIANCE_LEAD",
  user: { name: "Bia", email: "bia@x.com" },
};

describe("linkPolicy", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.policyFindFirst.mockResolvedValue({ id: "p-1", name: "Política de IA" });
    h.useCaseFindFirst.mockResolvedValue({
      id: "uc-1",
      code: "UC-118",
      title: "Triagem",
    });
    h.linkCreate.mockResolvedValue({ id: "l-1" });
  });

  it("vincula política a caso de uso e audita", async () => {
    const res = await linkPolicy({
      policyId: "p-1",
      alvoTipo: "USE_CASE",
      alvoId: "uc-1",
    });

    expect(res.ok).toBe(true);
    expect(h.linkCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "t-1",
        policyId: "p-1",
        alvoTipo: "USE_CASE",
        alvoId: "uc-1",
      },
    });
    expect(h.auditCreate).toHaveBeenCalled();
  });

  it("recusa alvo de outro tenant sem gravar — guard de IDOR", async () => {
    h.useCaseFindFirst.mockResolvedValue(null);

    const res = await linkPolicy({
      policyId: "p-1",
      alvoTipo: "USE_CASE",
      alvoId: "uc-de-outro",
    });

    expect(res.ok).toBe(false);
    expect(h.linkCreate).not.toHaveBeenCalled();
  });

  it("recusa política de outro tenant sem gravar", async () => {
    h.policyFindFirst.mockResolvedValue(null);

    const res = await linkPolicy({
      policyId: "p-de-outro",
      alvoTipo: "VENDOR",
      alvoId: "v-1",
    });

    expect(res.ok).toBe(false);
    expect(h.linkCreate).not.toHaveBeenCalled();
  });
});

describe("unlinkPolicy", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
  });

  it("remove o vínculo existente", async () => {
    h.linkDeleteMany.mockResolvedValue({ count: 1 });

    const res = await unlinkPolicy({
      policyId: "pol-1",
      alvoTipo: "USE_CASE",
      alvoId: "uc-1",
    });

    expect(res.ok).toBe(true);
    expect(h.linkDeleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: expect.any(String),
        policyId: "pol-1",
        alvoTipo: "USE_CASE",
        alvoId: "uc-1",
      },
    });
  });

  it("recusa desvincular o que não existe em vez de devolver sucesso calado", async () => {
    h.linkDeleteMany.mockResolvedValue({ count: 0 });

    const res = await unlinkPolicy({
      policyId: "pol-1",
      alvoTipo: "VENDOR",
      alvoId: "inexistente",
    });

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/não encontrado/i);
  });
});

describe("getPolicyScope", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireContext.mockResolvedValue(ctx);
  });

  it("marca vinculado por alvo e devolve os dois lados", async () => {
    h.policyFindFirst.mockResolvedValue({ id: "pol-1" });
    h.useCaseFindMany.mockResolvedValue([
      { id: "uc-1", code: "UC-001", title: "Triagem" },
      { id: "uc-2", code: "UC-002", title: "Sumarizador" },
    ]);
    h.vendorFindMany.mockResolvedValue([
      { id: "v-1", code: "V-001", name: "OpenAI" },
    ]);
    h.linkFindMany.mockResolvedValue([
      { alvoTipo: "USE_CASE", alvoId: "uc-1" },
    ]);

    const res = await getPolicyScope();

    expect(res.ok).toBe(true);
    expect(res.ok && res.data).toEqual({
      policyId: "pol-1",
      casos: [
        { id: "uc-1", rotulo: "UC-001 Triagem", vinculado: true },
        { id: "uc-2", rotulo: "UC-002 Sumarizador", vinculado: false },
      ],
      vendors: [{ id: "v-1", rotulo: "V-001 OpenAI", vinculado: false }],
    });
  });

  it("devolve null quando o tenant não tem política", async () => {
    h.policyFindFirst.mockResolvedValue(null);

    const res = await getPolicyScope();

    expect(res.ok && res.data).toBe(null);
  });
});
