import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  teamFindMany: vi.fn(),
  teamFindFirst: vi.fn(),
  teamCreate: vi.fn(),
  teamCapacitySnapshotFindMany: vi.fn(),
  sprintFindMany: vi.fn(),
  featureFindMany: vi.fn(),
  pIObjectiveFindMany: vi.fn(),
  aRTFindFirst: vi.fn(),
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
    team: {
      findMany: h.teamFindMany,
      findFirst: h.teamFindFirst,
      create: h.teamCreate,
    },
    teamCapacitySnapshot: {
      findMany: h.teamCapacitySnapshotFindMany,
    },
    sprint: {
      findMany: h.sprintFindMany,
    },
    feature: {
      findMany: h.featureFindMany,
    },
    pIObjective: {
      findMany: h.pIObjectiveFindMany,
    },
    aRT: {
      findFirst: h.aRTFindFirst,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createTeam,
  getTeam,
  listTeams,
} from "../../app/(cosmos)/actions/teams";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.sprintFindMany.mockResolvedValue([]);
  h.featureFindMany.mockResolvedValue([]);
  h.pIObjectiveFindMany.mockResolvedValue([]);
});

describe("listTeams", () => {
  it("returns tenant-scoped teams with computed member count", async () => {
    h.teamFindMany.mockResolvedValue([
      {
        id: "tm1",
        name: "Squad Alpha",
        focusArea: "Pagamentos",
        color: "#2563eb",
        wip: 5,
        velocity: 40,
        members: [{ name: "Ana" }, { name: "Bruno" }],
        artId: null,
        art: null,
      },
    ]);
    h.teamCapacitySnapshotFindMany.mockResolvedValue([]);

    const r = await listTeams();
    expect(r.ok).toBe(true);
    expect(database.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].memberCount).toBe(2);
    }
  });

  it("scopes the TeamCapacitySnapshot aggregate query to the tenant", async () => {
    h.teamFindMany.mockResolvedValue([
      {
        id: "tm1",
        name: "Squad Alpha",
        focusArea: "Pagamentos",
        color: "#2563eb",
        wip: 5,
        velocity: 40,
        members: [],
        artId: "art-1",
        art: { name: "ART Pagamentos" },
      },
    ]);
    h.teamCapacitySnapshotFindMany.mockResolvedValue([]);

    await listTeams();

    expect(database.teamCapacitySnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, teamId: { in: ["tm1"] } },
      })
    );
  });

  it("surfaces the latest capacity snapshot and avg predictability per team, tenant-scoped", async () => {
    h.teamFindMany.mockResolvedValue([
      {
        id: "tm1",
        name: "Squad Alpha",
        focusArea: "Pagamentos",
        color: "#2563eb",
        wip: 5,
        velocity: 40,
        members: [],
        artId: "art-1",
        art: { name: "ART Pagamentos" },
      },
    ]);
    // Newest-first, as the real orderBy: recordedAt desc produces.
    h.teamCapacitySnapshotFindMany.mockResolvedValue([
      {
        teamId: "tm1",
        expectedSpNextSprint: 40,
        actualSpDelivered: 44,
      },
      {
        teamId: "tm1",
        expectedSpNextSprint: 40,
        actualSpDelivered: 36,
      },
    ]);

    const r = await listTeams();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].artId).toBe("art-1");
      expect(r.data[0].artName).toBe("ART Pagamentos");
      // Latest snapshot (first row) is the capacity shown on the card.
      expect(r.data[0].capacity).toEqual({ expectedSp: 40, actualSp: 44 });
      // (110% + 90%) / 2 = 100%
      expect(r.data[0].predictabilityPct).toBe(100);
    }
  });

  it("does not surface a team belonging to another tenant even if it shares a name", async () => {
    // The tenant-scoped team.findMany already filters to this tenant; a
    // snapshot referencing an id outside that result set must never appear
    // as this team's capacity — the aggregate join is keyed off `teamId`
    // returned by the tenant-scoped team query only.
    h.teamFindMany.mockResolvedValue([
      {
        id: "tm1",
        name: "Squad Alpha",
        focusArea: null,
        color: null,
        wip: 0,
        velocity: null,
        members: [],
        artId: null,
        art: null,
      },
    ]);
    h.teamCapacitySnapshotFindMany.mockResolvedValue([]);

    await listTeams();

    const call = h.teamCapacitySnapshotFindMany.mock.calls[0][0];
    expect(call.where.teamId.in).toEqual(["tm1"]);
    expect(call.where.teamId.in).not.toContain("other-tenant-team");
  });
});

describe("getTeam", () => {
  it("returns tenant-scoped team detail with members and recent capacity", async () => {
    h.teamCapacitySnapshotFindMany.mockResolvedValue([
      {
        recordedAt: new Date("2026-01-01"),
        expectedSpNextSprint: 38,
        actualSpDelivered: 35,
        actualCapacityUtil: 0.92,
      },
    ]);
    h.teamFindFirst.mockResolvedValue({
      id: "tm1",
      name: "Squad Alpha",
      focusArea: "Pagamentos",
      velocity: 40,
      wip: 5,
      members: [{ name: "Ana", role: "Lead" }],
    });

    const r = await getTeam("tm1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data?.members[0].name).toBe("Ana");
      expect(r.data?.recentCapacity[0].actualSp).toBe(35);
      expect(r.data?.recentCapacity[0].utilizationPct).toBe(92);
    }
  });

  it("scopes the sprint/feature/PIObjective reads to the tenant and team", async () => {
    h.teamCapacitySnapshotFindMany.mockResolvedValue([]);
    h.teamFindFirst.mockResolvedValue({
      id: "tm1",
      name: "Squad Alpha",
      focusArea: null,
      velocity: null,
      wip: 0,
      members: [],
    });

    await getTeam("tm1");

    expect(h.sprintFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: tenantCtx.tenantId,
          teamId: "tm1",
          status: "CLOSED",
        },
      })
    );
    expect(h.featureFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, assignedTeamId: "tm1" },
      })
    );
    expect(h.pIObjectiveFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, teamId: "tm1" },
      })
    );
  });

  it("returns the team's real sprint series, features, and PI objectives", async () => {
    h.teamCapacitySnapshotFindMany.mockResolvedValue([]);
    h.teamFindFirst.mockResolvedValue({
      id: "tm1",
      name: "Squad Alpha",
      focusArea: null,
      velocity: 30,
      wip: 2,
      members: [],
    });
    h.sprintFindMany.mockResolvedValue([
      { id: "sp1", name: "Sprint 10", capacity: 40, velocity: 38 },
    ]);
    h.featureFindMany.mockResolvedValue([
      { id: "f1", title: "Checkout PIX", statusId: "DONE", progressPct: 100 },
    ]);
    h.pIObjectiveFindMany.mockResolvedValue([
      {
        id: "o1",
        title: "Reduzir latência",
        status: "IN_PROGRESS",
        businessValue: 8,
        plannedValue: 100,
        achievedValue: 40,
      },
    ]);

    const r = await getTeam("tm1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data?.sprints).toEqual([
        { id: "sp1", name: "Sprint 10", capacity: 40, velocity: 38 },
      ]);
      expect(r.data?.features[0].title).toBe("Checkout PIX");
      expect(r.data?.piObjectives[0].title).toBe("Reduzir latência");
    }
  });
});

describe("createTeam", () => {
  const validInput = { name: "Squad Beta" };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createTeam(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "RTE"], tenantCtx);
    expect(h.teamCreate).not.toHaveBeenCalled();
  });

  it("creates without an artId, skipping the ART lookup", async () => {
    h.teamCreate.mockResolvedValue({ id: "new-team" });

    const res = await createTeam(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-team");
    }
    expect(h.aRTFindFirst).not.toHaveBeenCalled();
    expect(h.teamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          name: "Squad Beta",
          artId: null,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "team",
        entityId: "new-team",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("rejects an artId that is not owned by the tenant (IDOR guard)", async () => {
    h.aRTFindFirst.mockResolvedValue(null);

    const res = await createTeam({ ...validInput, artId: "foreign-art" });

    expect(res.ok).toBe(false);
    expect(h.aRTFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-art", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.teamCreate).not.toHaveBeenCalled();
  });

  it("creates with a valid tenant-scoped artId", async () => {
    h.aRTFindFirst.mockResolvedValue({ id: "art-ok" });
    h.teamCreate.mockResolvedValue({ id: "new-team-2" });

    const res = await createTeam({ ...validInput, artId: "art-ok" });

    expect(res.ok).toBe(true);
    expect(h.teamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ artId: "art-ok" }),
      })
    );
  });
});
