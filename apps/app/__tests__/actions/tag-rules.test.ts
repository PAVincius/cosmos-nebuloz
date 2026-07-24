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
