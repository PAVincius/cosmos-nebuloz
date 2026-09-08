import { beforeEach, describe, expect, it, vi } from "vitest";

// A partir da Task 7, `createOnboardingWorkspace` delega criação de tenant e
// slug para `provisionTenant` (pacote `@repo/provisioning`) — geração de slug
// e resolução de colisão são responsabilidade dele e já têm cobertura própria
// em packages/provisioning/src/__tests__/tenant.test.ts. Este arquivo testa
// só o contrato observável de createOnboardingWorkspace.
const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  userFindUnique: vi.fn(),
  sessionUpdateMany: vi.fn(),
  onboardingProgressUpsert: vi.fn(),
  provisionTenant: vi.fn(),
  invalidateModuleCache: vi.fn(),
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
    session: {
      updateMany: mocks.sessionUpdateMany,
    },
    onboardingProgress: {
      upsert: mocks.onboardingProgressUpsert,
    },
  },
}));
// Mocka o caminho profundo, não o barrel: onboarding.ts importa de
// "@repo/provisioning/src/tenant" (ADR-0013 — ver adr-0013-boundary.test.ts).
vi.mock("@repo/provisioning/src/tenant", () => ({
  provisionTenant: mocks.provisionTenant,
}));
vi.mock("@repo/rbac", () => ({
  invalidateModuleCache: mocks.invalidateModuleCache,
}));

import { createOnboardingWorkspace } from "../../app/actions/onboarding";

const defaultSession = {
  user: { id: "user-1", email: "user@example.com" },
};

const defaultDbUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User One",
};

const defaultProvisionResult = {
  tenantId: "tenant-new",
  slug: "acme-corp",
  ownerLinked: true,
};

describe("createOnboardingWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.getSession.mockResolvedValue(defaultSession);
    mocks.userFindUnique.mockResolvedValue(defaultDbUser);
    mocks.provisionTenant.mockResolvedValue(defaultProvisionResult);
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.onboardingProgressUpsert.mockResolvedValue({});
  });

  it("creates workspace and returns tenantId and slug", async () => {
    const result = await createOnboardingWorkspace("Acme Corp");

    expect(result).toEqual({ tenantId: "tenant-new", slug: "acme-corp" });
    expect(mocks.provisionTenant).toHaveBeenCalledOnce();
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

  it("provisiona COSMOS em TRIAL — decisão do cadastro self-service", async () => {
    await createOnboardingWorkspace("Acme Corp");

    expect(mocks.provisionTenant).toHaveBeenCalledWith(
      expect.anything(),
      { invalidateModuleCache: mocks.invalidateModuleCache },
      expect.objectContaining({
        name: "Acme Corp",
        ownerEmail: "user@example.com",
        actorUserId: "user-1",
        actorName: "User One",
        modules: [
          expect.objectContaining({ module: "COSMOS", status: "TRIAL" }),
        ],
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
