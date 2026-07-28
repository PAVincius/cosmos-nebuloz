import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  piPlanFindFirst: vi.fn(),
  teamFindMany: vi.fn(),
  epicFindFirst: vi.fn(),
  teamFindFirst: vi.fn(),
  featureCreate: vi.fn(),
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
    pIPlan: { findFirst: h.piPlanFindFirst },
    team: { findMany: h.teamFindMany, findFirst: h.teamFindFirst },
    epic: { findFirst: h.epicFindFirst },
    feature: { create: h.featureCreate },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createFeature,
  getActiveProgramBoard,
} from "../../app/(cosmos)/actions/program";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("getActiveProgramBoard", () => {
  it("returns tenant-scoped teams with their assigned features", async () => {
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      features: [
        {
          id: "f1",
          title: "Feature A",
          storyPoints: 5,
          statusId: "IN_PROGRESS",
          assignedTeamId: "tm1",
          milestone: true,
          _count: { blocks: 1, blockedBy: 0 },
        },
      ],
    });
    h.teamFindMany.mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]);

    const r = await getActiveProgramBoard();
    expect(r.ok).toBe(true);
    expect(database.pIPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    if (r.ok && r.data) {
      expect(r.data.teams[0].name).toBe("Squad Alpha");
      expect(r.data.teams[0].features[0].title).toBe("Feature A");
      expect(r.data.teams[0].features[0].milestone).toBe(true);
      expect(r.data.teams[0].features[0].hasDependency).toBe(true);
    }
  });

  it("marks hasDependency false when the feature has no blocking/blocked links", async () => {
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      features: [
        {
          id: "f2",
          title: "Feature B",
          storyPoints: 3,
          statusId: "BACKLOG",
          assignedTeamId: "tm1",
          milestone: false,
          _count: { blocks: 0, blockedBy: 0 },
        },
      ],
    });
    h.teamFindMany.mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]);

    const r = await getActiveProgramBoard();
    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      expect(r.data.teams[0].features[0].milestone).toBe(false);
      expect(r.data.teams[0].features[0].hasDependency).toBe(false);
    }
  });
});

describe("createFeature", () => {
  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await createFeature({ title: "Nova feature" });
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "PO"],
      tenantCtx
    );
    expect(h.featureCreate).not.toHaveBeenCalled();
  });

  it("rejects an epicId that is not owned by the tenant (IDOR guard)", async () => {
    h.epicFindFirst.mockResolvedValue(null);
    const res = await createFeature({
      title: "Nova feature",
      epicId: "foreign-epic",
    });
    expect(res.ok).toBe(false);
    expect(h.epicFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-epic", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.featureCreate).not.toHaveBeenCalled();
  });

  it("rejects an assignedTeamId that is not owned by the tenant (IDOR guard)", async () => {
    h.epicFindFirst.mockResolvedValue({ id: "ep-1" });
    h.teamFindFirst.mockResolvedValue(null);
    const res = await createFeature({
      title: "Nova feature",
      epicId: "ep-1",
      assignedTeamId: "foreign-team",
    });
    expect(res.ok).toBe(false);
    expect(h.teamFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-team", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.featureCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and returns the id on success", async () => {
    h.epicFindFirst.mockResolvedValue({ id: "ep-1" });
    h.teamFindFirst.mockResolvedValue({ id: "tm-1" });
    h.featureCreate.mockResolvedValue({ id: "new-feat" });

    const res = await createFeature({
      title: "Checkout PIX",
      epicId: "ep-1",
      assignedTeamId: "tm-1",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 5,
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe("new-feat");
    expect(h.featureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: "Checkout PIX",
          epicId: "ep-1",
          assignedTeamId: "tm-1",
          bv: 8,
          tc: 5,
          rr: 3,
          js: 5,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "feature",
        entityId: "new-feat",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});
