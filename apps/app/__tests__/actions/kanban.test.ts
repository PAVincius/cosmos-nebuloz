import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  epicFindMany: vi.fn(),
  epicFindFirst: vi.fn(),
  epicUpdate: vi.fn(),
  epicCreate: vi.fn(),
  tenantFindUnique: vi.fn(),
  themeFindFirst: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({
  revalidateTag: h.revalidateTag,
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  Prisma: {},
  database: {
    epic: {
      findMany: h.epicFindMany,
      findFirst: h.epicFindFirst,
      update: h.epicUpdate,
      create: h.epicCreate,
    },
    tenant: { findUnique: h.tenantFindUnique },
    strategicTheme: { findFirst: h.themeFindFirst },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import {
  createEpic,
  listEpics,
  moveEpic,
} from "../../app/(cosmos)/actions/kanban";

const epicRow = {
  id: "ep-1",
  title: "Antifraude",
  lifecycleStatus: "ANALYZING",
  order: 0,
  wsjf: 19.6,
  sizePoints: 55,
  hot: true,
  ownerName: "Letícia",
  artId: "data",
  artTone: "amber",
  featureCount: 100,
  doneFeatureCount: 6,
  strategicTheme: { title: "Confiança & Risco" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listEpics", () => {
  it("scopes the query to the caller tenant and maps the DTO", async () => {
    h.epicFindMany.mockResolvedValue([epicRow]);
    const res = await listEpics();
    expect(res.ok).toBe(true);
    expect(h.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    if (res.ok) {
      expect(res.data[0]).toMatchObject({
        id: "ep-1",
        column: "analyzing",
        theme: "Confiança & Risco",
        wsjf: 19.6,
        size: 55,
        artTone: "amber",
        owner: "Letícia",
        progress: 6,
        hot: true,
      });
    }
  });
});

describe("moveEpic", () => {
  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await moveEpic({ id: "ep-1", column: "done", order: 0 });
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "PO"],
      tenantCtx
    );
    expect(h.epicUpdate).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant epic id (tenant isolation)", async () => {
    h.epicFindFirst.mockResolvedValue(null); // id not found within tenant scope
    const res = await moveEpic({
      id: "other-tenant-epic",
      column: "done",
      order: 0,
    });
    expect(res.ok).toBe(false);
    expect(h.epicFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "other-tenant-epic",
          tenantId: tenantCtx.tenantId,
        }),
      })
    );
    expect(h.epicUpdate).not.toHaveBeenCalled();
  });

  it("updates lifecycle, audits, and revalidates on success", async () => {
    h.epicFindFirst.mockResolvedValue({
      id: "ep-1",
      lifecycleStatus: "ANALYZING",
    });
    h.epicUpdate.mockResolvedValue({ id: "ep-1" });
    const res = await moveEpic({ id: "ep-1", column: "done", order: 3 });
    expect(res.ok).toBe(true);
    expect(h.epicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ep-1" },
        data: { lifecycleStatus: "DONE", order: 3 },
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "epic",
        entityId: "ep-1",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});

describe("createEpic", () => {
  it("rejects a strategicThemeId that is not owned by the tenant (IDOR guard)", async () => {
    h.themeFindFirst.mockResolvedValue(null); // theme not in tenant
    const res = await createEpic({
      title: "X",
      column: "funnel",
      strategicThemeId: "foreign-theme",
    });
    expect(res.ok).toBe(false);
    expect(h.epicCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and returns the id on success", async () => {
    h.epicCreate.mockResolvedValue({ id: "new-ep" });
    const res = await createEpic({ title: "Novo", column: "funnel" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe("new-ep");
    expect(h.epicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: "Novo",
          lifecycleStatus: "FUNNEL",
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "epic",
        entityId: "new-ep",
      })
    );
  });
});
