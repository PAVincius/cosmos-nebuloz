import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  webhookFindMany: vi.fn(),
  webhookFindFirst: vi.fn(),
  webhookCreate: vi.fn(),
  webhookUpdate: vi.fn(),
  deliveryLogCreate: vi.fn(),
  inngestSend: vi.fn(),
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
      findFirst: h.webhookFindFirst,
      create: h.webhookCreate,
      update: h.webhookUpdate,
    },
    webhookDeliveryLog: { create: h.deliveryLogCreate },
  },
}));
vi.mock("../../lib/inngest/client", () => ({
  inngest: { send: h.inngestSend },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

process.env.ENCRYPTION_KEY = "0".repeat(32);

import {
  createWebhook,
  listWebhooks,
  sendTestWebhook,
  setWebhookActive,
} from "../../app/(cosmos)/actions/webhooks";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.inngestSend.mockResolvedValue({ ids: ["evt-1"] });
});

describe("listWebhooks", () => {
  it("returns tenant-scoped webhooks without secret fields", async () => {
    h.webhookFindMany.mockResolvedValue([
      {
        id: "w1",
        url: "https://hooks.slack.com/x",
        eventTypes: ["pi_committed"],
        active: true,
        deliveryLogs: [],
      },
    ]);
    const r = await listWebhooks();
    expect(r.ok).toBe(true);
    expect(h.webhookFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    const call = h.webhookFindMany.mock.calls[0][0];
    expect(call.select).not.toHaveProperty("secretHash");
    expect(call.select).not.toHaveProperty("secretEnc");
    if (r.ok) {
      expect(r.data[0].eventTypes).toContain("pi_committed");
      expect(r.data[0].lastDeliveryStatus).toBeNull();
      expect(r.data[0].lastDeliveryAt).toBeNull();
    }
  });

  it("surfaces the latest delivery status, code and timestamp per endpoint", async () => {
    const createdAt = new Date("2026-07-20T12:00:00.000Z");
    h.webhookFindMany.mockResolvedValue([
      {
        id: "w2",
        url: "https://hooks.example.com/y",
        eventTypes: ["risk.created"],
        active: true,
        deliveryLogs: [{ status: "FAILED", responseCode: 503, createdAt }],
      },
    ]);
    const r = await listWebhooks();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].lastDeliveryStatus).toBe("FAILED");
      expect(r.data[0].lastDeliveryCode).toBe(503);
      expect(r.data[0].lastDeliveryAt).toBe(createdAt.toISOString());
    }
  });

  it("conta falhas consecutivas a partir da entrega mais recente e para na primeira entrega boa (AC-006)", async () => {
    const at = (m: number) => new Date(`2026-07-20T12:0${m}:00.000Z`);
    h.webhookFindMany.mockResolvedValue([
      {
        id: "w3",
        url: "https://hooks.example.com/z",
        eventTypes: ["epic.created"],
        active: true,
        // ordenado do mais recente para o mais antigo
        deliveryLogs: [
          { status: "FAILED", responseCode: 503, createdAt: at(5) },
          { status: "FAILED", responseCode: 500, createdAt: at(4) },
          { status: "FAILED", responseCode: 502, createdAt: at(3) },
          { status: "DELIVERED", responseCode: 200, createdAt: at(2) },
          { status: "FAILED", responseCode: 500, createdAt: at(1) },
        ],
      },
    ]);
    const r = await listWebhooks();
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 3, não 4 — a falha antes da entrega bem-sucedida não é consecutiva
      expect(r.data[0].consecutiveFailures).toBe(3);
      expect(r.data[0].degraded).toBe(true);
    }
  });

  it("não marca degradado com menos de 3 falhas consecutivas (AC-006)", async () => {
    h.webhookFindMany.mockResolvedValue([
      {
        id: "w4",
        url: "https://hooks.example.com/w",
        eventTypes: ["epic.created"],
        active: true,
        deliveryLogs: [
          {
            status: "FAILED",
            responseCode: 500,
            createdAt: new Date("2026-07-20T12:00:00.000Z"),
          },
        ],
      },
    ]);
    const r = await listWebhooks();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].consecutiveFailures).toBe(1);
      expect(r.data[0].degraded).toBe(false);
    }
  });
});

describe("setWebhookActive", () => {
  it("is denied when the role is not ADMIN (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await setWebhookActive({ id: "w1", active: false });
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN"], tenantCtx);
    expect(h.webhookUpdate).not.toHaveBeenCalled();
  });

  it("recusa endpoint de outro tenant sem escrever (guarda IDOR)", async () => {
    h.webhookFindFirst.mockResolvedValue(null);
    const res = await setWebhookActive({ id: "alheio", active: false });
    expect(res.ok).toBe(false);
    expect(h.webhookFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alheio", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.webhookUpdate).not.toHaveBeenCalled();
  });

  it("pausa o endpoint, audita o estado anterior e revalida", async () => {
    h.webhookFindFirst.mockResolvedValue({ id: "w1", active: true });
    h.webhookUpdate.mockResolvedValue({ id: "w1" });

    const res = await setWebhookActive({ id: "w1", active: false });
    expect(res.ok).toBe(true);
    expect(h.webhookUpdate).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { active: false },
      select: { id: true },
    });
    const [tenantId, payload] = h.logAudit.mock.calls[0];
    expect(tenantId).toBe(tenantCtx.tenantId);
    expect(payload).toMatchObject({
      action: "status_changed",
      entityType: "webhook",
      entityId: "w1",
    });
    expect(payload.diff.active).toBe("true→false");
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});

describe("sendTestWebhook", () => {
  it("is denied when the role is not ADMIN (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await sendTestWebhook({ id: "w1" });
    expect(res.ok).toBe(false);
    expect(h.deliveryLogCreate).not.toHaveBeenCalled();
    expect(h.inngestSend).not.toHaveBeenCalled();
  });

  it("recusa endpoint de outro tenant sem enfileirar entrega (guarda IDOR)", async () => {
    h.webhookFindFirst.mockResolvedValue(null);
    const res = await sendTestWebhook({ id: "alheio" });
    expect(res.ok).toBe(false);
    expect(h.deliveryLogCreate).not.toHaveBeenCalled();
    expect(h.inngestSend).not.toHaveBeenCalled();
  });

  it("recusa endpoint pausado — o worker marcaria a entrega como falha permanente", async () => {
    h.webhookFindFirst.mockResolvedValue({ id: "w1", active: false });
    const res = await sendTestWebhook({ id: "w1" });
    expect(res.ok).toBe(false);
    expect(h.deliveryLogCreate).not.toHaveBeenCalled();
    expect(h.inngestSend).not.toHaveBeenCalled();
  });

  it("registra a entrega como sintética e enfileira o job de entrega (AC-004)", async () => {
    h.webhookFindFirst.mockResolvedValue({ id: "w1", active: true });
    h.deliveryLogCreate.mockResolvedValue({ id: "log-1" });

    const res = await sendTestWebhook({ id: "w1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.deliveryLogId).toBe("log-1");
    }

    const createArgs = h.deliveryLogCreate.mock.calls[0][0];
    expect(createArgs.data.tenantId).toBe(tenantCtx.tenantId);
    expect(createArgs.data.endpointId).toBe("w1");
    expect(createArgs.data.eventType).toBe("ping");
    // `synthetic` distingue teste de tráfego real no log de entrega — sem ele
    // um ping de teste conta como entrega de produção na saúde do endpoint
    expect(createArgs.data.synthetic).toBe(true);
    expect(createArgs.data.status).toBe("PENDING");

    expect(h.inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "webhook/event.dispatch",
        data: expect.objectContaining({
          endpointId: "w1",
          tenantId: tenantCtx.tenantId,
          eventType: "ping",
          deliveryLogId: "log-1",
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalled();
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
