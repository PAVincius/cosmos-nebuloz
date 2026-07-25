import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
  auditLogCreate: vi.fn(),
  dbTransaction: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
}));

vi.mock("@repo/database", () => ({
  database: {
    auditLog: { create: mocks.auditLogCreate },
    $transaction: mocks.dbTransaction,
  },
}));

import { withSecureAction } from "../../../lib/actions/with-secure-action";

const INSUFFICIENT_REGEX = /insufficient/i;

const RTE_CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  role: "RTE" as const,
  user: { id: "user-1", email: "rte@org.com" },
};

const MEMBER_CTX = {
  ...RTE_CTX,
  role: "MEMBER" as const,
};

const TestSchema = z.object({ value: z.string().min(1) });

describe("withSecureAction (AC-001 through AC-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(RTE_CTX);
    mocks.auditLogCreate.mockResolvedValue({});
    mocks.dbTransaction.mockImplementation((fn: () => Promise<unknown>) =>
      fn()
    );
  });

  it("returns success when session valid, role correct, schema valid (AC-002)", async () => {
    const handler = vi.fn().mockResolvedValue({ id: "result-1" });

    const result = await withSecureAction(
      {
        requiredRole: "RTE",
        schema: TestSchema,
        auditAction: "epic.create",
        auditResourceType: "Epic",
      },
      { value: "hello" },
      handler
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: "result-1" });
    }
    expect(handler).toHaveBeenCalledWith({ value: "hello" }, RTE_CTX);
  });

  it("returns 401 when no session (AC-007)", async () => {
    mocks.requireTenantSession.mockRejectedValue(new Error("UNAUTHORIZED"));

    const handler = vi.fn();
    const result = await withSecureAction(
      {
        schema: TestSchema,
        auditAction: "epic.create",
        auditResourceType: "Epic",
      },
      { value: "hello" },
      handler
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe(401);
    }
    expect(handler).not.toHaveBeenCalled();
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("returns 403 and writes AuditLog when role insufficient (AC-003)", async () => {
    mocks.requireTenantSession.mockResolvedValue(MEMBER_CTX);

    const handler = vi.fn();
    const result = await withSecureAction(
      {
        requiredRole: "RTE",
        schema: TestSchema,
        auditAction: "epic.create",
        auditResourceType: "Epic",
      },
      { value: "hello" },
      handler
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe(403);
      expect(result.error).toMatch(INSUFFICIENT_REGEX);
    }
    expect(handler).not.toHaveBeenCalled();
    // AuditLog for unauthorized attempt
    await vi.waitFor(() => {
      expect(mocks.auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "epic.create.unauthorized_attempt",
          }),
        })
      );
    });
  });

  it("returns 422 when Zod schema fails (AC-004)", async () => {
    const handler = vi.fn();
    const result = await withSecureAction(
      {
        schema: TestSchema,
        auditAction: "epic.create",
        auditResourceType: "Epic",
      },
      { value: "" }, // fails min(1)
      handler
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe(422);
      expect(result.details).toBeDefined();
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 500 and writes failure AuditLog when handler throws (AC-005)", async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(new Error("DB constraint violation"));

    const result = await withSecureAction(
      {
        schema: TestSchema,
        auditAction: "epic.create",
        auditResourceType: "Epic",
      },
      { value: "hello" },
      handler
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe(500);
    }
    await vi.waitFor(() => {
      expect(mocks.auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "epic.create.failed",
          }),
        })
      );
    });
  });

  it("writes AuditLog on success (AC-006)", async () => {
    const handler = vi.fn().mockResolvedValue({ id: "epic-1" });

    await withSecureAction(
      {
        schema: TestSchema,
        auditAction: "epic.create",
        auditResourceType: "Epic",
      },
      { value: "hello" },
      handler
    );

    await vi.waitFor(() => {
      expect(mocks.auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "epic.create",
            actorId: "user-1",
            tenantId: "tenant-1",
          }),
        })
      );
    });
  });

  it("uses $transaction when transactional=true (AC-005)", async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });

    await withSecureAction(
      {
        schema: TestSchema,
        transactional: true,
        auditAction: "epic.create",
        auditResourceType: "Epic",
      },
      { value: "hello" },
      handler
    );

    expect(mocks.dbTransaction).toHaveBeenCalled();
  });

  it("accepts array of required roles (AC-003)", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...RTE_CTX,
      role: "ADMIN" as const,
    });
    const handler = vi.fn().mockResolvedValue({});

    const result = await withSecureAction(
      {
        requiredRole: ["RTE", "ADMIN"],
        schema: TestSchema,
        auditAction: "epic.create",
        auditResourceType: "Epic",
      },
      { value: "hello" },
      handler
    );

    expect(result.success).toBe(true);
    expect(handler).toHaveBeenCalled();
  });
});
