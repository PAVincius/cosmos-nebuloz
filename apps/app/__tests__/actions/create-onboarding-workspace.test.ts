import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  userFindUnique: vi.fn(),
  tenantFindUnique: vi.fn(),
  tenantCreate: vi.fn(),
  sessionUpdateMany: vi.fn(),
  onboardingProgressUpsert: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}));
vi.mock("@repo/database", () => ({
  database: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    tenant: {
      findUnique: mocks.tenantFindUnique,
      create: mocks.tenantCreate,
    },
    session: {
      updateMany: mocks.sessionUpdateMany,
    },
    onboardingProgress: {
      upsert: mocks.onboardingProgressUpsert,
    },
  },
}));

import { createOnboardingWorkspace } from "../../app/actions/onboarding";

const defaultSession = {
  user: { id: "user-1", email: "user@example.com" },
};

const defaultTenant = {
  id: "tenant-new",
  slug: "acme-corp",
  name: "Acme Corp",
};

describe("createOnboardingWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.getSession.mockResolvedValue(defaultSession);
    mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
    mocks.tenantFindUnique.mockResolvedValue(null); // slug is available
    mocks.tenantCreate.mockResolvedValue(defaultTenant);
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.onboardingProgressUpsert.mockResolvedValue({});
  });

  it("creates workspace and returns tenantId and slug", async () => {
    const result = await createOnboardingWorkspace("Acme Corp");

    expect(result).toEqual({ tenantId: "tenant-new", slug: "acme-corp" });
    expect(mocks.tenantCreate).toHaveBeenCalledOnce();
  });

  it("throws UNAUTHORIZED when session has no user", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(createOnboardingWorkspace("Acme Corp")).rejects.toThrow(
      "UNAUTHORIZED"
    );
  });

  it("throws when name is too short (< 2 chars after trim)", async () => {
    await expect(createOnboardingWorkspace("A")).rejects.toThrow(
      "Nome muito curto."
    );
  });

  it("throws when name is only whitespace", async () => {
    await expect(createOnboardingWorkspace("  ")).rejects.toThrow(
      "Nome muito curto."
    );
  });

  it("appends numeric suffix on slug collision and retries", async () => {
    // First call: slug taken; second call: slug available
    mocks.tenantFindUnique
      .mockResolvedValueOnce({ id: "existing-tenant" }) // "acme-corp" taken
      .mockResolvedValueOnce(null); // "acme-corp-1" available

    await createOnboardingWorkspace("Acme Corp");

    // tenant.create should receive slug with -1 suffix
    expect(mocks.tenantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "acme-corp-1" }),
      })
    );
  });

  it("sets activeTenantId on all user sessions after creation", async () => {
    await createOnboardingWorkspace("Acme Corp");

    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { activeTenantId: "tenant-new" },
    });
  });

  it("upserts onboardingProgress with completed status", async () => {
    await createOnboardingWorkspace("Acme Corp");

    expect(mocks.onboardingProgressUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: "tenant-new",
          flowType: "company_setup",
          status: "completed",
        }),
        update: { status: "completed" },
      })
    );
  });
});
