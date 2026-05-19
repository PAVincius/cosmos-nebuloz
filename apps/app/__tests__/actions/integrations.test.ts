import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  integrationFindMany: vi.fn(),
  integrationFindUnique: vi.fn(),
  integrationFindFirst: vi.fn(),
  integrationUpsert: vi.fn(),
  integrationUpdate: vi.fn(),
  integrationDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    integration: {
      findMany: mocks.integrationFindMany,
      findUnique: mocks.integrationFindUnique,
      findFirst: mocks.integrationFindFirst,
      upsert: mocks.integrationUpsert,
      update: mocks.integrationUpdate,
      delete: mocks.integrationDelete,
    },
  },
}));

import {
  deleteIntegration,
  getIntegrationByType,
  listIntegrations,
  testIntegration,
  upsertIntegration,
} from "../../app/actions/settings/integrations";

const adminCtx = { ...tenantCtx, role: "ADMIN" as const };

const ROW = {
  id: "int-1",
  tenantId: adminCtx.tenantId,
  type: "jira",
  name: "Jira",
  status: "ACTIVE",
  config: { baseUrl: "https://acme.atlassian.net", apiToken: "tok" },
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(adminCtx);
  mocks.revalidatePath.mockReturnValue(undefined);
});

// ─── listIntegrations ────────────────────────────────────────────────────────

describe("listIntegrations", () => {
  it("returns public integrations without config secrets", async () => {
    mocks.integrationFindMany.mockResolvedValue([ROW]);
    const result = await listIntegrations();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]).not.toHaveProperty("config");
      expect(result.data[0].configured).toBe(true);
      expect(result.data[0].type).toBe("jira");
    }
  });

  it("returns ok:true with empty array when no integrations", async () => {
    mocks.integrationFindMany.mockResolvedValue([]);
    const result = await listIntegrations();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("returns ok:false on error", async () => {
    mocks.integrationFindMany.mockRejectedValue(new Error("DB error"));
    const result = await listIntegrations();
    expect(result.ok).toBe(false);
  });

  it("marks configured:false when config is empty object", async () => {
    mocks.integrationFindMany.mockResolvedValue([{ ...ROW, config: {} }]);
    const result = await listIntegrations();
    if (result.ok) {
      expect(result.data[0].configured).toBe(false);
    }
  });
});

// ─── getIntegrationByType ─────────────────────────────────────────────────────

describe("getIntegrationByType", () => {
  it("returns full integration with config", async () => {
    mocks.integrationFindUnique.mockResolvedValue(ROW);
    const result = await getIntegrationByType("jira");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.config).toMatchObject({ baseUrl: expect.any(String) });
    }
  });

  it("returns ok:false when not found", async () => {
    mocks.integrationFindUnique.mockResolvedValue(null);
    const result = await getIntegrationByType("jira");
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for invalid type", async () => {
    const result = await getIntegrationByType("unknown-type");
    expect(result.ok).toBe(false);
  });
});

// ─── upsertIntegration ───────────────────────────────────────────────────────

describe("upsertIntegration", () => {
  it("upserts integration and returns public view", async () => {
    mocks.integrationUpsert.mockResolvedValue(ROW);
    const result = await upsertIntegration({
      type: "jira",
      name: "Jira",
      config: {
        baseUrl: "https://acme.atlassian.net",
        apiToken: "tok",
        projectKey: "COSMOS",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.type).toBe("jira");
    }
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("returns ok:false on invalid schema", async () => {
    const result = await upsertIntegration({ type: "jira" }); // missing name
    expect(result.ok).toBe(false);
  });
});

// ─── testIntegration ─────────────────────────────────────────────────────────

describe("testIntegration", () => {
  beforeEach(() => {
    mocks.integrationFindUnique.mockResolvedValue(ROW);
    mocks.integrationUpdate.mockResolvedValue({});
  });

  it("returns ok:false when integration not found", async () => {
    mocks.integrationFindUnique.mockResolvedValue(null);
    const result = await testIntegration("jira");
    expect(result.ok).toBe(false);
  });

  it("tests jira — marks ACTIVE on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
    const result = await testIntegration("jira");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ok).toBe(true);
      expect(result.data.message).toMatch(/sucesso/i);
    }
    expect(mocks.integrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } })
    );
    vi.unstubAllGlobals();
  });

  it("tests jira — marks ERROR on HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );
    const result = await testIntegration("jira");
    if (result.ok) {
      expect(result.data.ok).toBe(false);
    }
    expect(mocks.integrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ERROR" } })
    );
    vi.unstubAllGlobals();
  });

  it("tests slack — sends test message", async () => {
    mocks.integrationFindUnique.mockResolvedValue({
      ...ROW,
      type: "slack",
      config: { webhookUrl: "https://hooks.slack.com/T1" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
    const result = await testIntegration("slack");
    if (result.ok) {
      expect(result.data.ok).toBe(true);
    }
    vi.unstubAllGlobals();
  });

  it("handles fetch network error gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network timeout"))
    );
    const result = await testIntegration("jira");
    if (result.ok) {
      expect(result.data.ok).toBe(false);
      expect(result.data.message).toContain("Network timeout");
    }
    vi.unstubAllGlobals();
  });

  it("unknown type returns default message", async () => {
    mocks.integrationFindUnique.mockResolvedValue({
      ...ROW,
      type: "github",
      config: { token: "tok", owner: "org", repo: "repo" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
    const result = await testIntegration("github");
    expect(result.ok).toBe(true);
    vi.unstubAllGlobals();
  });
});

// ─── deleteIntegration ───────────────────────────────────────────────────────

describe("deleteIntegration", () => {
  it("deletes integration and returns id", async () => {
    mocks.integrationFindFirst.mockResolvedValue(ROW);
    mocks.integrationDelete.mockResolvedValue({});
    const result = await deleteIntegration("int-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("int-1");
    }
    expect(mocks.integrationDelete).toHaveBeenCalledWith({
      where: { id: "int-1" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("returns ok:false when integration not found", async () => {
    mocks.integrationFindFirst.mockResolvedValue(null);
    const result = await deleteIntegration("missing");
    expect(result.ok).toBe(false);
  });
});
