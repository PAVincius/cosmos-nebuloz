import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  assignmentFindMany: vi.fn(),
  reconciliationLogCreate: vi.fn(),
  auditLogCreate: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    pIPlanFeatureAssignment: { findMany: dbMocks.assignmentFindMany },
    boardReconciliationLog: { create: dbMocks.reconciliationLogCreate },
    auditLog: { create: dbMocks.auditLogCreate },
    tenantMember: { findFirst: dbMocks.tenantMemberFindFirst },
  },
}));

import {
  type AssignmentSnapshot,
  reconcileBoard,
} from "../../../lib/collaboration/reconciliation";

const TENANT = "tenant-1";
const PI_PLAN = "pi-1";

const makeAssignment = (
  featureId: string,
  overrides: Partial<AssignmentSnapshot> = {}
): AssignmentSnapshot => ({
  featureId,
  teamId: "team-a",
  sprintId: "sprint-1",
  rank: 0,
  ...overrides,
});

describe("reconcileBoard (AC-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.reconciliationLogCreate.mockResolvedValue({ id: "log-1" });
  });

  it("returns NO_DIVERGENCE when LB matches DB exactly", async () => {
    const assignments = [makeAssignment("f1"), makeAssignment("f2")];
    dbMocks.assignmentFindMany.mockResolvedValue(assignments);

    const result = await reconcileBoard(TENANT, PI_PLAN, assignments);

    expect(result.diverged).toBe(false);
    expect(result.resolution).toBe("NO_DIVERGENCE");
    expect(dbMocks.reconciliationLogCreate).not.toHaveBeenCalled();
  });

  it("detects divergence when LB has extra assignment DB lacks", async () => {
    const dbAssignments = [makeAssignment("f1")];
    const lbAssignments = [makeAssignment("f1"), makeAssignment("f2")];
    dbMocks.assignmentFindMany.mockResolvedValue(dbAssignments);

    const result = await reconcileBoard(TENANT, PI_PLAN, lbAssignments);

    expect(result.diverged).toBe(true);
    expect(result.divergenceCount).toBeGreaterThan(0);
    expect(result.resolution).toBe("PRISMA_WINS");
  });

  it("detects divergence when positions differ (teamId mismatch)", async () => {
    const db = [makeAssignment("f1", { teamId: "team-a" })];
    const lb = [makeAssignment("f1", { teamId: "team-b" })];
    dbMocks.assignmentFindMany.mockResolvedValue(db);

    const result = await reconcileBoard(TENANT, PI_PLAN, lb);

    expect(result.diverged).toBe(true);
    expect(result.divergenceCount).toBe(1);
  });

  it("writes BoardReconciliationLog on divergence with PRISMA_WINS", async () => {
    dbMocks.assignmentFindMany.mockResolvedValue([makeAssignment("f1")]);
    const lb = [makeAssignment("f1", { sprintId: "sprint-99" })];

    await reconcileBoard(TENANT, PI_PLAN, lb);

    expect(dbMocks.reconciliationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT,
          entityId: PI_PLAN,
          resolution: "PRISMA_WINS",
          surface: "pi-planning",
        }),
      })
    );
  });

  it("counts lbCount and dbCount correctly", async () => {
    const db = [
      makeAssignment("f1"),
      makeAssignment("f2"),
      makeAssignment("f3"),
    ];
    const lb = [makeAssignment("f1"), makeAssignment("f2")];
    dbMocks.assignmentFindMany.mockResolvedValue(db);

    const result = await reconcileBoard(TENANT, PI_PLAN, lb);

    expect(result.dbCount).toBe(3);
    expect(result.lbCount).toBe(2);
  });

  it("returns NO_DIVERGENCE for empty state on both sides", async () => {
    dbMocks.assignmentFindMany.mockResolvedValue([]);

    const result = await reconcileBoard(TENANT, PI_PLAN, []);

    expect(result.diverged).toBe(false);
    expect(result.divergenceCount).toBe(0);
  });
});

const CROSS_TENANT_REGEX = /cross-tenant/i;

// ─── Auth route: cross-tenant blocking (AC-002/AC-003) ───────────────────────

const authMocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getOrgId: vi.fn(),
  authenticateRoom: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  currentUser: authMocks.currentUser,
  getOrgId: authMocks.getOrgId,
}));

vi.mock("@repo/collaboration/auth", () => ({
  authenticateRoom: authMocks.authenticateRoom,
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
}));

import { POST } from "../../../app/api/collaboration/auth/route";

describe("Collaboration auth route (AC-001/AC-002/AC-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.currentUser.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@org.com",
      image: null,
    });
    authMocks.getOrgId.mockResolvedValue("tenant-a");
    dbMocks.auditLogCreate.mockResolvedValue({});
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "ADMIN" });
    authMocks.authenticateRoom.mockResolvedValue(
      new Response('{"token":"test"}', { status: 200 })
    );
  });

  it("returns 403 and fires AuditLog for cross-tenant room access (AC-002)", async () => {
    const req = new Request("http://localhost/api/collaboration/auth", {
      method: "POST",
      body: JSON.stringify({ room: "tenant-b:pi-planning-board:pi-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(CROSS_TENANT_REGEX);
    expect(dbMocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "collaboration.cross_tenant_attempt",
        }),
      })
    );
    expect(authMocks.authenticateRoom).not.toHaveBeenCalled();
  });

  it("grants READ_ACCESS for MEMBER role (AC-003)", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "MEMBER" });

    const req = new Request("http://localhost/api/collaboration/auth", {
      method: "POST",
      body: JSON.stringify({ room: "tenant-a:pi-planning-board:pi-1" }),
    });

    await POST(req);

    expect(authMocks.authenticateRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        room: "tenant-a:pi-planning-board:pi-1",
        canWrite: false,
      })
    );
  });

  it("grants FULL_ACCESS for ADMIN role (AC-001)", async () => {
    dbMocks.tenantMemberFindFirst.mockResolvedValue({ role: "ADMIN" });

    const req = new Request("http://localhost/api/collaboration/auth", {
      method: "POST",
      body: JSON.stringify({ room: "tenant-a:pi-planning-board:pi-1" }),
    });

    await POST(req);

    expect(authMocks.authenticateRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        room: "tenant-a:pi-planning-board:pi-1",
        canWrite: true,
      })
    );
  });

  it("returns 401 when no session (AC-001)", async () => {
    authMocks.currentUser.mockResolvedValue(null);

    const req = new Request("http://localhost/api/collaboration/auth", {
      method: "POST",
      body: JSON.stringify({ room: "tenant-a:pi-planning-board:pi-1" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});
