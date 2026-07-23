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
    aRT: {
      findFirst: h.aRTFindFirst,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

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
      },
    ]);

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
});

describe("getTeam", () => {
  it("returns tenant-scoped team detail with members and recent capacity", async () => {
    h.teamCapacitySnapshotFindMany.mockResolvedValue([
      {
        recordedAt: new Date("2026-01-01"),
        expectedSpNextSprint: 38,
        actualSpDelivered: 35,
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
