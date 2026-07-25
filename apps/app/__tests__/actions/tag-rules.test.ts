import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  inngestSend: vi.fn(),
  logAudit: vi.fn(),
  tagRuleFindMany: vi.fn(),
  tagRuleFindFirst: vi.fn(),
  tagRuleCreate: vi.fn(),
  tagRuleUpdate: vi.fn(),
  tagRuleDeleteMany: vi.fn(),
  strategicThemeFindFirst: vi.fn(),
  aRTFindFirst: vi.fn(),
  epicFindFirst: vi.fn(),
  integrationFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    tagRule: {
      findMany: h.tagRuleFindMany,
      findFirst: h.tagRuleFindFirst,
      create: h.tagRuleCreate,
      update: h.tagRuleUpdate,
      deleteMany: h.tagRuleDeleteMany,
    },
    strategicTheme: {
      findFirst: h.strategicThemeFindFirst,
    },
    aRT: {
      findFirst: h.aRTFindFirst,
    },
    epic: {
      findFirst: h.epicFindFirst,
    },
    integration: {
      findFirst: h.integrationFindFirst,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: h.inngestSend },
}));

import {
  createTagRule,
  deleteTagRule,
  updateTagRule,
} from "../../app/actions/billing/tag-rules";

const validInput = {
  matchType: "EXACT" as const,
  name: "Rule A",
  priority: 0,
  enabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.tagRuleCreate.mockResolvedValue({ id: "rule-1", name: "Rule A" });
  h.tagRuleFindFirst.mockResolvedValue({ id: "rule-1" });
  h.tagRuleUpdate.mockResolvedValue({ id: "rule-1", name: "Rule A" });
  h.tagRuleDeleteMany.mockResolvedValue({ count: 1 });
  h.inngestSend.mockResolvedValue(undefined);
});

// ─── F2 regression: mutations require ADMIN/STE ───────────────────────────────

describe("createTagRule — RBAC", () => {
  it("checks the role before writing", async () => {
    await createTagRule(validInput);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
  });

  it("is denied for a non-ADMIN/STE role", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createTagRule(validInput);

    expect(res.ok).toBe(false);
    expect(h.tagRuleCreate).not.toHaveBeenCalled();
  });
});

describe("updateTagRule — RBAC", () => {
  it("checks the role before writing", async () => {
    await updateTagRule("rule-1", validInput);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
  });

  it("is denied for a non-ADMIN/STE role", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await updateTagRule("rule-1", validInput);

    expect(res.ok).toBe(false);
    expect(h.tagRuleFindFirst).not.toHaveBeenCalled();
    expect(h.tagRuleUpdate).not.toHaveBeenCalled();
    expect(h.inngestSend).not.toHaveBeenCalled();
  });
});

describe("deleteTagRule — RBAC", () => {
  it("checks the role before writing", async () => {
    await deleteTagRule("rule-1");
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
  });

  it("is denied for a non-ADMIN/STE role", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await deleteTagRule("rule-1");

    expect(res.ok).toBe(false);
    expect(h.tagRuleDeleteMany).not.toHaveBeenCalled();
  });
});

// ─── F3 regression: FKs are tenant-guarded before the write ───────────────────

describe("createTagRule — cross-tenant FK guard", () => {
  it("rejects a themeId that does not belong to the tenant", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(null);

    const res = await createTagRule({
      ...validInput,
      themeId: "clforeigntheme00000001",
    });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "clforeigntheme00000001", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.tagRuleCreate).not.toHaveBeenCalled();
  });

  it("rejects an artId that does not belong to the tenant", async () => {
    h.aRTFindFirst.mockResolvedValue(null);

    const res = await createTagRule({
      ...validInput,
      artId: "clforeignart000000001",
    });

    expect(res.ok).toBe(false);
    expect(h.tagRuleCreate).not.toHaveBeenCalled();
  });

  it("rejects an epicId that does not belong to the tenant", async () => {
    h.epicFindFirst.mockResolvedValue(null);

    const res = await createTagRule({
      ...validInput,
      epicId: "clforeignepic000000001",
    });

    expect(res.ok).toBe(false);
    expect(h.tagRuleCreate).not.toHaveBeenCalled();
  });

  it("rejects an integrationId that does not belong to the tenant", async () => {
    h.integrationFindFirst.mockResolvedValue(null);

    const res = await createTagRule({
      ...validInput,
      integrationId: "clforeignintegration01",
    });

    expect(res.ok).toBe(false);
    expect(h.tagRuleCreate).not.toHaveBeenCalled();
  });

  it("does not query any FK guard when none is supplied", async () => {
    await createTagRule(validInput);

    expect(h.strategicThemeFindFirst).not.toHaveBeenCalled();
    expect(h.aRTFindFirst).not.toHaveBeenCalled();
    expect(h.epicFindFirst).not.toHaveBeenCalled();
    expect(h.integrationFindFirst).not.toHaveBeenCalled();
    expect(h.tagRuleCreate).toHaveBeenCalled();
  });

  it("proceeds when the supplied themeId belongs to the tenant", async () => {
    h.strategicThemeFindFirst.mockResolvedValue({
      id: "cltheme000000000000001",
    });

    const res = await createTagRule({
      ...validInput,
      themeId: "cltheme000000000000001",
    });

    expect(res.ok).toBe(true);
    expect(h.tagRuleCreate).toHaveBeenCalled();
  });
});

describe("updateTagRule — cross-tenant FK guard", () => {
  it("rejects a themeId that does not belong to the tenant", async () => {
    h.strategicThemeFindFirst.mockResolvedValue(null);

    const res = await updateTagRule("rule-1", {
      themeId: "clforeigntheme00000001",
    });

    expect(res.ok).toBe(false);
    expect(h.strategicThemeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "clforeigntheme00000001", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.tagRuleUpdate).not.toHaveBeenCalled();
    expect(h.inngestSend).not.toHaveBeenCalled();
  });
});
