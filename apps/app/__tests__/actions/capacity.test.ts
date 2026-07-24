import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  logAudit: vi.fn(),
  teamFindMany: vi.fn(),
  teamFindFirst: vi.fn(),
  teamCapacitySnapshotFindMany: vi.fn(),
  sprintFindMany: vi.fn(),
  sprintFindFirst: vi.fn(),
  capacityAdjustmentNoteFindMany: vi.fn(),
  capacityAdjustmentNoteCreate: vi.fn(),
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
    },
    teamCapacitySnapshot: {
      findMany: h.teamCapacitySnapshotFindMany,
    },
    sprint: {
      findMany: h.sprintFindMany,
      findFirst: h.sprintFindFirst,
    },
    capacityAdjustmentNote: {
      findMany: h.capacityAdjustmentNoteFindMany,
      create: h.capacityAdjustmentNoteCreate,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createCapacityAdjustmentNote,
  listCapacityAdjustmentNotes,
  listTeamCapacity,
  listTeamSprints,
} from "../../app/(cosmos)/actions/capacity";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.teamFindMany.mockResolvedValue([
    { id: "tm1", name: "Squad Alpha", velocity: 40 },
  ]);
  h.teamCapacitySnapshotFindMany.mockResolvedValue([
    {
      teamId: "tm1",
      expectedSpNextSprint: 38,
      actualSpDelivered: 35,
      actualCapacityUtil: 0.92,
      recordedAt: new Date(),
    },
  ]);
});

describe("listTeamCapacity", () => {
  it("returns tenant-scoped teams joined to their latest capacity snapshot", async () => {
    const r = await listTeamCapacity();
    expect(r.ok).toBe(true);
    expect(database.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].teamName).toBe("Squad Alpha");
      expect(r.data[0].actualSp).toBe(35);
      expect(r.data[0].utilizationPct).toBe(92);
    }
  });
});

describe("listTeamSprints", () => {
  it("is tenant-scoped and filters by the given teamId", async () => {
    h.sprintFindMany.mockResolvedValue([{ id: "sp1", name: "Sprint 12" }]);
    const r = await listTeamSprints("tm1");
    expect(r.ok).toBe(true);
    expect(h.sprintFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, teamId: "tm1" },
      })
    );
    if (r.ok) {
      expect(r.data[0].name).toBe("Sprint 12");
    }
  });
});

describe("listCapacityAdjustmentNotes", () => {
  it("is tenant-scoped and joins team/sprint names", async () => {
    h.capacityAdjustmentNoteFindMany.mockResolvedValue([
      {
        id: "note1",
        teamId: "tm1",
        sprintId: "sp1",
        text: "−4 pts: treinamento",
        tone: "amber",
        createdAt: new Date("2026-01-01"),
      },
    ]);
    h.sprintFindMany.mockResolvedValue([{ id: "sp1", name: "Sprint 12" }]);

    const r = await listCapacityAdjustmentNotes();

    expect(r.ok).toBe(true);
    expect(h.capacityAdjustmentNoteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].teamName).toBe("Squad Alpha");
      expect(r.data[0].sprintName).toBe("Sprint 12");
      expect(r.data[0].text).toBe("−4 pts: treinamento");
    }
  });

  it("returns an empty list when there are no notes", async () => {
    h.capacityAdjustmentNoteFindMany.mockResolvedValue([]);
    const r = await listCapacityAdjustmentNotes();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual([]);
    }
    expect(h.teamFindMany).not.toHaveBeenCalled();
  });
});

describe("createCapacityAdjustmentNote", () => {
  const validInput = {
    teamId: "tm1",
    text: "−2 pts: feriado local",
    tone: "neutral" as const,
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createCapacityAdjustmentNote(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "SM"],
      tenantCtx
    );
    expect(h.capacityAdjustmentNoteCreate).not.toHaveBeenCalled();
  });

  it("rejects a teamId that is not owned by the tenant (IDOR guard)", async () => {
    h.teamFindFirst.mockResolvedValue(null);

    const res = await createCapacityAdjustmentNote({
      ...validInput,
      teamId: "foreign-team",
    });

    expect(res.ok).toBe(false);
    expect(h.teamFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-team", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.capacityAdjustmentNoteCreate).not.toHaveBeenCalled();
  });

  it("rejects a sprintId that is not owned by the tenant (IDOR guard)", async () => {
    h.teamFindFirst.mockResolvedValue({ id: "tm1" });
    h.sprintFindFirst.mockResolvedValue(null);

    const res = await createCapacityAdjustmentNote({
      ...validInput,
      sprintId: "foreign-sprint",
    });

    expect(res.ok).toBe(false);
    expect(h.sprintFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-sprint", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.capacityAdjustmentNoteCreate).not.toHaveBeenCalled();
  });

  it("creates, audits and revalidates on a valid tenant-scoped input", async () => {
    h.teamFindFirst.mockResolvedValue({ id: "tm1" });
    h.capacityAdjustmentNoteCreate.mockResolvedValue({ id: "new-note" });

    const res = await createCapacityAdjustmentNote(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-note");
    }
    expect(h.sprintFindFirst).not.toHaveBeenCalled();
    expect(h.capacityAdjustmentNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          teamId: "tm1",
          sprintId: null,
          text: "−2 pts: feriado local",
          tone: "neutral",
          createdById: tenantCtx.userId,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "CapacityAdjustmentNote",
        entityId: "new-note",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});
