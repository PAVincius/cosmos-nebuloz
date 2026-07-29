import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  dependencyLinkFindMany: vi.fn(),
  dependencyLinkCreate: vi.fn(),
  featureFindFirst: vi.fn(),
  teamFindMany: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    dependencyLink: {
      findMany: h.dependencyLinkFindMany,
      create: h.dependencyLinkCreate,
    },
    feature: {
      findFirst: h.featureFindFirst,
    },
    team: {
      findMany: h.teamFindMany,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createDependency,
  listDependencies,
} from "../../app/(cosmos)/actions/dependencies";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listDependencies", () => {
  it("returns tenant-scoped dependencies with resolved feature titles", async () => {
    h.dependencyLinkFindMany.mockResolvedValue([
      {
        id: "d1",
        description: "Fila depende do isolamento",
        status: "at-risk",
        boardStatus: "IDENTIFIED",
        criticalPath: true,
        blockingFeature: {
          title: "Tenant isolation layer",
          assignedTeamId: null,
        },
        blockedFeature: { title: "Pix agendado · fila", assignedTeamId: null },
      },
    ]);
    h.teamFindMany.mockResolvedValue([]);

    const r = await listDependencies();
    expect(r.ok).toBe(true);
    expect(database.dependencyLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].blockingTitle).toBe("Tenant isolation layer");
      expect(r.data[0].blockedTitle).toBe("Pix agendado · fila");
    }
  });

  it("skips the team lookup entirely when no feature has an assigned team", async () => {
    h.dependencyLinkFindMany.mockResolvedValue([
      {
        id: "d1",
        description: null,
        status: "not-started",
        boardStatus: "IDENTIFIED",
        criticalPath: false,
        blockingFeature: { title: "A", assignedTeamId: null },
        blockedFeature: { title: "B", assignedTeamId: null },
      },
    ]);

    const r = await listDependencies();
    expect(r.ok).toBe(true);
    expect(h.teamFindMany).not.toHaveBeenCalled();
    if (r.ok) {
      expect(r.data[0].fromTeamId).toBeNull();
      expect(r.data[0].toTeamId).toBeNull();
    }
  });

  it("resolves from/to team name+color via a tenant-scoped Team lookup", async () => {
    h.dependencyLinkFindMany.mockResolvedValue([
      {
        id: "d1",
        description: null,
        status: "on-track",
        boardStatus: "IN_PROGRESS",
        criticalPath: false,
        blockingFeature: { title: "A", assignedTeamId: "team-a" },
        blockedFeature: { title: "B", assignedTeamId: "team-b" },
      },
    ]);
    h.teamFindMany.mockResolvedValue([
      { id: "team-a", name: "Squad Alpha", color: "#2563eb" },
      { id: "team-b", name: "Squad Beta", color: "#16a34a" },
    ]);

    const r = await listDependencies();
    expect(r.ok).toBe(true);
    expect(h.teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["team-a", "team-b"] },
          tenantId: tenantCtx.tenantId,
        },
      })
    );
    if (r.ok) {
      expect(r.data[0].fromTeamId).toBe("team-a");
      expect(r.data[0].fromTeamName).toBe("Squad Alpha");
      expect(r.data[0].fromTeamColor).toBe("#2563eb");
      expect(r.data[0].toTeamId).toBe("team-b");
      expect(r.data[0].toTeamName).toBe("Squad Beta");
    }
  });

  it("falls back to null (never leaks the id) when the assigned team doesn't resolve inside the tenant", async () => {
    // assignedTeamId points at a team the tenant-scoped Team query didn't
    // return (e.g. belongs to another tenant) — must not be surfaced.
    h.dependencyLinkFindMany.mockResolvedValue([
      {
        id: "d1",
        description: null,
        status: "blocked",
        boardStatus: "IDENTIFIED",
        criticalPath: true,
        blockingFeature: { title: "A", assignedTeamId: "foreign-team" },
        blockedFeature: { title: "B", assignedTeamId: null },
      },
    ]);
    h.teamFindMany.mockResolvedValue([]); // tenant-scoped query found nothing

    const r = await listDependencies();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].fromTeamId).toBeNull();
      expect(r.data[0].fromTeamName).toBeNull();
    }
  });
});

describe("createDependency", () => {
  const validInput = {
    blockingFeatureId: "feat-blocking",
    blockedFeatureId: "feat-blocked",
    description: "Fila depende do isolamento de tenant.",
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createDependency(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "PO"],
      tenantCtx
    );
    expect(h.dependencyLinkCreate).not.toHaveBeenCalled();
  });

  it("rejects a blockingFeatureId that is not owned by the tenant (IDOR guard)", async () => {
    h.featureFindFirst.mockResolvedValue(null);

    const res = await createDependency({
      ...validInput,
      blockingFeatureId: "foreign-feature",
    });

    expect(res.ok).toBe(false);
    expect(h.featureFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-feature", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.dependencyLinkCreate).not.toHaveBeenCalled();
  });

  it("rejects a blockedFeatureId that is not owned by the tenant (IDOR guard)", async () => {
    h.featureFindFirst.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        where.id === "feat-blocking" ? { id: "feat-blocking" } : null
    );

    const res = await createDependency({
      ...validInput,
      blockedFeatureId: "foreign-feature",
    });

    expect(res.ok).toBe(false);
    expect(h.featureFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-feature", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.dependencyLinkCreate).not.toHaveBeenCalled();
  });

  it("returns a friendly conflict error when the pair already exists (P2002)", async () => {
    h.featureFindFirst.mockResolvedValue({ id: "ok" });
    h.dependencyLinkCreate.mockRejectedValue({
      code: "P2002",
      name: "PrismaClientKnownRequestError",
    });

    const res = await createDependency(validInput);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/já existe/i);
    }
  });

  it("creates, audits, and revalidates on success", async () => {
    h.featureFindFirst.mockResolvedValue({ id: "ok" });
    h.dependencyLinkCreate.mockResolvedValue({ id: "new-dep" });

    const res = await createDependency(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-dep");
    }
    expect(h.dependencyLinkCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          blockingFeatureId: "feat-blocking",
          blockedFeatureId: "feat-blocked",
          description: validInput.description,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "dependency",
        entityId: "new-dep",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});
