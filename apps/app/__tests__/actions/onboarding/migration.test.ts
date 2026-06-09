import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  connFindFirst: vi.fn(),
  connCreate: vi.fn(),
  connUpdate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    migrationConnection: {
      findFirst: mocks.connFindFirst,
      create: mocks.connCreate,
      update: mocks.connUpdate,
    },
  },
}));

import {
  approveMigrationMapping,
  getMigrationConnection,
  saveMigrationConnection,
  saveMigrationImportReport,
} from "../../../app/actions/onboarding/migration";

describe("saveMigrationConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("creates a new connection when none exists", async () => {
    const created = {
      id: "conn-1",
      tenantId: tenantCtx.tenantId,
      source: "jira",
      config: { url: "https://jira.example.com" },
      status: "pending",
    };
    mocks.connFindFirst.mockResolvedValue(null);
    mocks.connCreate.mockResolvedValue(created);

    const result = await saveMigrationConnection({
      source: "jira",
      config: { url: "https://jira.example.com" },
    });

    expect(result).toEqual(created);
    expect(mocks.connCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          source: "jira",
          status: "pending",
        }),
      })
    );
    expect(mocks.connUpdate).not.toHaveBeenCalled();
  });

  it("updates existing connection with status pending and clears errorMessage", async () => {
    const existing = {
      id: "conn-1",
      tenantId: tenantCtx.tenantId,
      source: "csv",
      config: {},
      status: "error",
      errorMessage: "previous error",
    };
    const updated = { ...existing, status: "pending", errorMessage: null };
    mocks.connFindFirst.mockResolvedValue(existing);
    mocks.connUpdate.mockResolvedValue(updated);

    const result = await saveMigrationConnection({
      source: "csv",
      config: { path: "/data/export.csv" },
    });

    expect(result).toEqual(updated);
    expect(mocks.connUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conn-1" },
        data: expect.objectContaining({
          status: "pending",
          errorMessage: null,
        }),
      })
    );
    expect(mocks.connCreate).not.toHaveBeenCalled();
  });

  it("throws a Zod error for an invalid source value", async () => {
    await expect(
      saveMigrationConnection({ source: "invalid-source", config: {} })
    ).rejects.toThrow();
    expect(mocks.connCreate).not.toHaveBeenCalled();
    expect(mocks.connUpdate).not.toHaveBeenCalled();
  });
});

describe("getMigrationConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("returns the connection for the tenant and source", async () => {
    const connection = {
      id: "conn-2",
      tenantId: tenantCtx.tenantId,
      source: "azure",
      config: {},
      status: "connected",
    };
    mocks.connFindFirst.mockResolvedValue(connection);

    const result = await getMigrationConnection("azure");

    expect(result).toEqual(connection);
    expect(mocks.connFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, source: "azure" },
      })
    );
  });
});

describe("approveMigrationMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("updates mappingData for the connection", async () => {
    const existing = {
      id: "conn-3",
      tenantId: tenantCtx.tenantId,
      source: "jira",
    };
    const mappingData = { fields: { summary: "title", description: "body" } };
    mocks.connFindFirst.mockResolvedValue(existing);
    mocks.connUpdate.mockResolvedValue({ ...existing, mappingData });

    await approveMigrationMapping("conn-3", mappingData);

    expect(mocks.connUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conn-3" },
        data: expect.objectContaining({ mappingData }),
      })
    );
  });

  it("throws when the connection is not found", async () => {
    mocks.connFindFirst.mockResolvedValue(null);

    await expect(
      approveMigrationMapping("missing-conn", { fields: {} })
    ).rejects.toThrow("Migration connection not found.");
    expect(mocks.connUpdate).not.toHaveBeenCalled();
  });
});

describe("saveMigrationImportReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("updates importReport, sets status to connected, and revalidates path", async () => {
    const existing = {
      id: "conn-4",
      tenantId: tenantCtx.tenantId,
      source: "trello",
    };
    const report = { imported: 42, skipped: 3, errors: [] };
    const updated = { ...existing, importReport: report, status: "connected" };
    mocks.connFindFirst.mockResolvedValue(existing);
    mocks.connUpdate.mockResolvedValue(updated);

    const result = await saveMigrationImportReport("conn-4", report);

    expect(result).toEqual(updated);
    expect(mocks.connUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conn-4" },
        data: expect.objectContaining({
          importReport: report,
          status: "connected",
        }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/onboarding/migration");
  });

  it("throws when the connection is not found", async () => {
    mocks.connFindFirst.mockResolvedValue(null);

    await expect(
      saveMigrationImportReport("missing-conn", { imported: 0 })
    ).rejects.toThrow("Migration connection not found.");
    expect(mocks.connUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
