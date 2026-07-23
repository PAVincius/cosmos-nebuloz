import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  webhookFindMany: vi.fn(),
  webhookCreate: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({
  revalidateTag: h.revalidateTag,
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    webhookEndpoint: {
      findMany: h.webhookFindMany,
      create: h.webhookCreate,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

process.env.ENCRYPTION_KEY = "0".repeat(32);

import {
  createWebhook,
  listWebhooks,
} from "../../app/(cosmos)/actions/webhooks";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listWebhooks", () => {
  it("returns tenant-scoped webhooks without secret fields", async () => {
    h.webhookFindMany.mockResolvedValue([
      {
        id: "w1",
        url: "https://hooks.slack.com/x",
        eventTypes: ["pi_committed"],
        active: true,
      },
    ]);
    const r = await listWebhooks();
    expect(r.ok).toBe(true);
    expect(h.webhookFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
        select: { id: true, url: true, eventTypes: true, active: true },
      })
    );
    if (r.ok) {
      expect(r.data[0].eventTypes).toContain("pi_committed");
    }
  });
});

describe("createWebhook", () => {
  const validInput = {
    url: "https://example.com/hooks/cosmos",
    eventTypes: ["epic.created"],
  };

  it("is denied when the role is not ADMIN (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await createWebhook(validInput);
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN"], tenantCtx);
    expect(h.webhookCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid url", async () => {
    const res = await createWebhook({
      url: "not-a-url",
      eventTypes: ["epic.created"],
    });
    expect(res.ok).toBe(false);
    expect(h.webhookCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty eventTypes selection", async () => {
    const res = await createWebhook({
      url: "https://example.com/x",
      eventTypes: [],
    });
    expect(res.ok).toBe(false);
    expect(h.webhookCreate).not.toHaveBeenCalled();
  });

  it("generates the secret server-side and returns it exactly once, ignoring any client-supplied secret", async () => {
    h.webhookCreate.mockResolvedValue({ id: "wh-new" });
    const res = await createWebhook({
      ...validInput,
      // Zod strips unknown keys by default — this simulates an attacker
      // trying to smuggle a client-chosen secret through the input.
      secret: "attacker-supplied-secret",
    } as unknown as typeof validInput);

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.id).toBe("wh-new");
    expect(typeof res.data.secret).toBe("string");
    expect(res.data.secret).toHaveLength(64); // 32 random bytes, hex-encoded
    expect(res.data.secret).not.toBe("attacker-supplied-secret");

    expect(h.webhookCreate).toHaveBeenCalledTimes(1);
    const createArgs = h.webhookCreate.mock.calls[0][0];
    expect(createArgs.data.tenantId).toBe(tenantCtx.tenantId);
    expect(createArgs.data.createdBy).toBe(tenantCtx.userId);
    expect(createArgs.data.url).toBe(validInput.url);
    expect(createArgs.data).not.toHaveProperty("secret");
    // Never persisted in plaintext, and never derived from client input.
    expect(createArgs.data.secretHash).not.toBe(res.data.secret);
    expect(createArgs.data.secretHash).not.toContain(
      "attacker-supplied-secret"
    );
    expect(createArgs.data.secretEnc).not.toBe(res.data.secret);
    expect(createArgs.data.secretEnc).not.toContain(res.data.secret);
    expect(createArgs.data.secretEnc).not.toContain("attacker-supplied-secret");
  });

  it("never leaks secretHash/secretEnc/the raw secret into the audit log diff", async () => {
    h.webhookCreate.mockResolvedValue({ id: "wh-2" });
    const res = await createWebhook(validInput);
    expect(res.ok).toBe(true);

    expect(h.logAudit).toHaveBeenCalledTimes(1);
    const [tenantId, payload] = h.logAudit.mock.calls[0];
    expect(tenantId).toBe(tenantCtx.tenantId);
    expect(payload).toMatchObject({
      action: "created",
      entityType: "webhook",
      entityId: "wh-2",
    });
    const diffStr = JSON.stringify(payload.diff);
    expect(diffStr).not.toMatch(/secretHash|secretEnc/i);
    if (res.ok) {
      expect(diffStr).not.toContain(res.data.secret);
    }
  });

  it("audits and revalidates on success", async () => {
    h.webhookCreate.mockResolvedValue({ id: "wh-3" });
    const res = await createWebhook(validInput);
    expect(res.ok).toBe(true);
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});
