import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  withTenantDb: vi.fn(),
  policyFindFirst: vi.fn(),
  useCaseFindFirst: vi.fn(),
  vendorFindFirst: vi.fn(),
  linkCreate: vi.fn(),
  linkDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterPolicy: { findFirst: h.policyFindFirst },
      charterUseCase: { findFirst: h.useCaseFindFirst },
      charterVendor: { findFirst: h.vendorFindFirst },
      charterPolicyLink: { create: h.linkCreate, deleteMany: h.linkDeleteMany },
      auditLog: { create: h.auditCreate },
    }),
}));

import { linkPolicy } from "../../app/(charter)/actions/policy";

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
