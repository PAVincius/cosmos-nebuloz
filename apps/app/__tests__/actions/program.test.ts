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
  featureFindMany: vi.fn(),
  featureFindFirst: vi.fn(),
  sprintFindMany: vi.fn(),
  sprintFindFirst: vi.fn(),
  assignmentFindMany: vi.fn(),
  assignmentUpsert: vi.fn(),
  teamCapacitySnapshotFindMany: vi.fn(),
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
    feature: {
      create: h.featureCreate,
      findMany: h.featureFindMany,
      findFirst: h.featureFindFirst,
    },
    sprint: { findMany: h.sprintFindMany, findFirst: h.sprintFindFirst },
    pIPlanFeatureAssignment: {
      findMany: h.assignmentFindMany,
      upsert: h.assignmentUpsert,
    },
    teamCapacitySnapshot: { findMany: h.teamCapacitySnapshotFindMany },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  assignFeatureToCell,
  createFeature,
  getActiveProgramBoard,
} from "../../app/(cosmos)/actions/program";

const feature = (over: Record<string, unknown>) => ({
  id: "f1",
  title: "Feature A",
  storyPoints: 5,
  statusId: "IN_PROGRESS",
  milestone: false,
  _count: { blocks: 0, blockedBy: 0 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.featureFindMany.mockResolvedValue([]);
  h.sprintFindMany.mockResolvedValue([]);
  h.assignmentFindMany.mockResolvedValue([]);
  h.teamFindMany.mockResolvedValue([]);
  h.teamCapacitySnapshotFindMany.mockResolvedValue([]);
});

describe("getActiveProgramBoard", () => {
  it("returns null when there is no active PI (honest empty state)", async () => {
    h.piPlanFindFirst.mockResolvedValue(null);

    const r = await getActiveProgramBoard();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toBeNull();
    }
    expect(h.featureFindMany).not.toHaveBeenCalled();
  });

  it("places features in the team × sprint cell PIPlanFeatureAssignment names", async () => {
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "PLANNING",
    });
    h.featureFindMany.mockResolvedValue([
      feature({
        id: "f1",
        title: "Feature A",
        storyPoints: 5,
        milestone: true,
      }),
      feature({
        id: "f2",
        title: "Feature B",
        storyPoints: 3,
        _count: { blocks: 1, blockedBy: 0 },
      }),
    ]);
    h.sprintFindMany.mockResolvedValue([
      { id: "sp1", name: "Sprint 1", teamId: "tm1" },
      { id: "sp2", name: "Sprint 2", teamId: "tm1" },
    ]);
    h.teamFindMany.mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]);
    h.assignmentFindMany.mockResolvedValue([
      { featureId: "f1", teamId: "tm1", sprintId: "sp1" },
    ]);

    const r = await getActiveProgramBoard();

    expect(r.ok).toBe(true);
    expect(database.pIPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenantCtx.tenantId }),
      })
    );
    expect(h.assignmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, piPlanId: "pi1" },
      })
    );
    if (r.ok && r.data) {
      expect(r.data.sprintCount).toBe(2);
      expect(r.data.teams[0].name).toBe("Squad Alpha");
      expect(r.data.teams[0].cells[0]?.features[0].title).toBe("Feature A");
      expect(r.data.teams[0].cells[0]?.features[0].milestone).toBe(true);
      expect(r.data.teams[0].cells[1]?.features).toEqual([]);
      // Feature sem célula não some do quadro: vai para a lista de pendentes.
      expect(r.data.unassigned.map((f) => f.id)).toEqual(["f2"]);
      expect(r.data.unassigned[0].hasDependency).toBe(true);
    }
  });

  it("computes cell load against the sprint capacity snapshot (story-020 AC-002)", async () => {
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "PLANNING",
    });
    h.featureFindMany.mockResolvedValue([
      feature({ id: "f1", storyPoints: 35 }),
      feature({ id: "f2", storyPoints: 8 }),
    ]);
    h.sprintFindMany.mockResolvedValue([
      { id: "sp1", name: "Sprint 1", teamId: "tm1" },
    ]);
    h.teamFindMany.mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]);
    h.assignmentFindMany.mockResolvedValue([
      { featureId: "f1", teamId: "tm1", sprintId: "sp1" },
      { featureId: "f2", teamId: "tm1", sprintId: "sp1" },
    ]);
    h.teamCapacitySnapshotFindMany.mockResolvedValue([
      { sprintId: "sp1", teamId: "tm1", expectedSpNextSprint: 40 },
    ]);

    const r = await getActiveProgramBoard();

    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      const cell = r.data.teams[0].cells[0];
      // O cenário 35+8 pontos contra capacidade 40 é o do AC-002 da story-020.
      // O AC escreve "43/40 = 107%" truncando; aqui a utilização arredonda
      // (107,5 → 108), como já faz a grade de capacidade. O que o AC decide é
      // que a célula fica acima da capacidade e avisa sem bloquear.
      expect(cell?.assignedSp).toBe(43);
      expect(cell?.capacitySp).toBe(40);
      expect(cell?.utilizationPct).toBe(108);
      expect(cell?.overCapacity).toBe(true);
    }
  });

  it("leaves utilization null when the cell has no capacity snapshot", async () => {
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "PLANNING",
    });
    h.featureFindMany.mockResolvedValue([
      feature({ id: "f1", storyPoints: 5 }),
    ]);
    h.sprintFindMany.mockResolvedValue([
      { id: "sp1", name: "Sprint 1", teamId: "tm1" },
    ]);
    h.teamFindMany.mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]);
    h.assignmentFindMany.mockResolvedValue([
      { featureId: "f1", teamId: "tm1", sprintId: "sp1" },
    ]);

    const r = await getActiveProgramBoard();

    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      expect(r.data.teams[0].cells[0]?.capacitySp).toBeNull();
      expect(r.data.teams[0].cells[0]?.utilizationPct).toBeNull();
      expect(r.data.teams[0].cells[0]?.overCapacity).toBe(false);
    }
  });

  it("drops an assignment whose sprint does not belong to the named team", async () => {
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "PLANNING",
    });
    h.featureFindMany.mockResolvedValue([feature({ id: "f1" })]);
    h.sprintFindMany.mockResolvedValue([
      { id: "sp1", name: "Sprint 1", teamId: "tm1" },
    ]);
    h.teamFindMany.mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]);
    // Célula inconsistente: a sprint é do tm1, mas a atribuição diz tm2.
    h.assignmentFindMany.mockResolvedValue([
      { featureId: "f1", teamId: "tm2", sprintId: "sp1" },
    ]);

    const r = await getActiveProgramBoard();

    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      expect(r.data.teams[0].cells[0]?.features).toEqual([]);
      expect(r.data.unassigned.map((f) => f.id)).toEqual(["f1"]);
    }
  });

  it("marks the board read-only for a COMMITTED PI (story-020 AC-004)", async () => {
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "COMMITTED",
    });

    const r = await getActiveProgramBoard();

    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      expect(r.data.piPlanStatus).toBe("COMMITTED");
      expect(r.data.readOnly).toBe(true);
    }
  });

  it("keeps the board editable while the PI is PLANNING", async () => {
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "PLANNING",
    });

    const r = await getActiveProgramBoard();

    expect(r.ok).toBe(true);
    if (r.ok && r.data) {
      expect(r.data.readOnly).toBe(false);
    }
  });
});

// story-020 AC-002/AC-004 — PIPlanFeatureAssignment tinha exatamente a forma da
// célula e nenhuma tela do Cosmos a escrevia.
describe("assignFeatureToCell", () => {
  const input = { featureId: "f1", teamId: "tm1", sprintId: "sp1" };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await assignFeatureToCell(input);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "PO"],
      tenantCtx
    );
    expect(h.assignmentUpsert).not.toHaveBeenCalled();
  });

  it("rejects a feature that is not owned by the tenant (IDOR guard)", async () => {
    h.featureFindFirst.mockResolvedValue(null);

    const res = await assignFeatureToCell(input);

    expect(res.ok).toBe(false);
    expect(h.featureFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f1", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.assignmentUpsert).not.toHaveBeenCalled();
  });

  it("rejects a feature that is not committed to any PI", async () => {
    h.featureFindFirst.mockResolvedValue({ id: "f1", piPlanId: null });

    const res = await assignFeatureToCell(input);

    expect(res.ok).toBe(false);
    expect(h.assignmentUpsert).not.toHaveBeenCalled();
  });

  it("refuses to move a feature while the PI is COMMITTED (AC-004)", async () => {
    h.featureFindFirst.mockResolvedValue({ id: "f1", piPlanId: "pi1" });
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "COMMITTED",
    });

    const res = await assignFeatureToCell(input);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("somente leitura");
    }
    expect(h.assignmentUpsert).not.toHaveBeenCalled();
  });

  it("rejects a sprint that is not this team's sprint in this PI (IDOR guard)", async () => {
    h.featureFindFirst.mockResolvedValue({ id: "f1", piPlanId: "pi1" });
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "PLANNING",
    });
    h.sprintFindFirst.mockResolvedValue(null);

    const res = await assignFeatureToCell(input);

    expect(res.ok).toBe(false);
    expect(h.sprintFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "sp1",
          tenantId: tenantCtx.tenantId,
          piPlanId: "pi1",
          teamId: "tm1",
        },
      })
    );
    expect(h.assignmentUpsert).not.toHaveBeenCalled();
  });

  it("upserts one cell per feature per PI, audits and revalidates", async () => {
    h.featureFindFirst.mockResolvedValue({ id: "f1", piPlanId: "pi1" });
    h.piPlanFindFirst.mockResolvedValue({
      id: "pi1",
      name: "PI-26",
      status: "PLANNING",
    });
    h.sprintFindFirst.mockResolvedValue({ id: "sp1" });
    h.assignmentUpsert.mockResolvedValue({ id: "a1" });

    const res = await assignFeatureToCell(input);

    expect(res.ok).toBe(true);
    expect(h.assignmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { piPlanId_featureId: { piPlanId: "pi1", featureId: "f1" } },
        update: expect.objectContaining({ teamId: "tm1", sprintId: "sp1" }),
        create: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          piPlanId: "pi1",
          featureId: "f1",
          teamId: "tm1",
          sprintId: "sp1",
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "updated",
        entityType: "feature",
        entityId: "f1",
        diff: expect.objectContaining({ teamId: "tm1", sprintId: "sp1" }),
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
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
