import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: { findFirst: vi.fn() },
    feature: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { database } from "@repo/database";
import { getEpic, getFeature } from "../../app/(cosmos)/actions/epics";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getEpic", () => {
  it("returns tenant-scoped epic with features", async () => {
    (
      database.epic.findFirst as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "e1",
      title: "X",
      lifecycleStatus: "IMPLEMENTING",
      wsjf: 12,
      sizePoints: 8,
      investScore: 70,
      investBreakdown: null,
      hypothesis: null,
      descriptionMd: null,
      features: [{ id: "f1", title: "F", wsjfScore: 3, progressPct: 50 }],
    });
    const r = await getEpic("e1");
    expect(r.ok).toBe(true);
    expect(database.epic.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e1", tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data?.features[0].id).toBe("f1");
    }
  });
});

describe("getFeature", () => {
  it("returns tenant-scoped feature with its parent epic title and no siblings", async () => {
    (
      database.feature.findFirst as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "f1",
      title: "F",
      statusId: "IN_PROGRESS",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 2,
      wsjfScore: 8,
      storyPoints: 5,
      progressPct: 40,
      acceptanceCriteria: ["a"],
      epicId: "e1",
      epic: { title: "Épico Pai" },
      stories: [],
    });
    (
      database.feature.findMany as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue([{ id: "f1" }]);

    const r = await getFeature("f1");
    expect(r.ok).toBe(true);
    expect(database.feature.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f1", tenantId: "t1" },
      })
    );
    if (r.ok) {
      expect(r.data?.wsjfScore).toBe(8);
      expect(r.data?.epicTitle).toBe("Épico Pai");
      expect(r.data?.prevFeatureId).toBeNull();
      expect(r.data?.nextFeatureId).toBeNull();
    }
  });

  it("returns nested stories with their tasks", async () => {
    (
      database.feature.findFirst as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "f1",
      title: "F",
      statusId: "IN_PROGRESS",
      bv: 8,
      tc: 5,
      rr: 3,
      js: 2,
      wsjfScore: 8,
      storyPoints: 5,
      progressPct: 40,
      acceptanceCriteria: [],
      epicId: null,
      epic: null,
      stories: [
        {
          id: "s1",
          title: "Story 1",
          status: "IN_PROGRESS",
          storyPoints: 3,
          tasks: [
            { id: "tk1", title: "Task 1", status: "DONE" },
            { id: "tk2", title: "Task 2", status: "TODO" },
          ],
        },
      ],
    });

    const r = await getFeature("f1");
    expect(r.ok).toBe(true);
    // No epicId → the sibling-ordering query must not run at all.
    expect(database.feature.findMany).not.toHaveBeenCalled();
    if (r.ok) {
      expect(r.data?.stories).toHaveLength(1);
      expect(r.data?.stories[0].tasks).toEqual([
        { id: "tk1", title: "Task 1", status: "DONE" },
        { id: "tk2", title: "Task 2", status: "TODO" },
      ]);
      expect(r.data?.epicTitle).toBeNull();
    }
  });

  it("scopes the sibling-ordering query to the tenant and the feature's epic", async () => {
    (
      database.feature.findFirst as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "f2",
      title: "F2",
      statusId: "BACKLOG",
      bv: 1,
      tc: 1,
      rr: 1,
      js: 1,
      wsjfScore: 3,
      storyPoints: 1,
      progressPct: 0,
      acceptanceCriteria: [],
      epicId: "e1",
      epic: { title: "E" },
      stories: [],
    });
    (
      database.feature.findMany as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue([{ id: "f1" }, { id: "f2" }, { id: "f3" }]);

    const r = await getFeature("f2");
    expect(database.feature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { epicId: "e1", tenantId: "t1" },
      })
    );
    if (r.ok) {
      // f2 is the middle sibling in the mocked wsjfScore-desc order.
      expect(r.data?.prevFeatureId).toBe("f1");
      expect(r.data?.nextFeatureId).toBe("f3");
    }
  });

  it("never lets a cross-tenant feature id leak into prev/next", async () => {
    (
      database.feature.findFirst as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "f1",
      title: "F1",
      statusId: "BACKLOG",
      bv: 1,
      tc: 1,
      rr: 1,
      js: 1,
      wsjfScore: 5,
      storyPoints: 1,
      progressPct: 0,
      acceptanceCriteria: [],
      epicId: "e1",
      epic: { title: "E" },
      stories: [],
    });
    // The tenant-scoped findMany already excludes other tenants' rows; a
    // sibling id from another tenant must never appear in this list, so
    // it can never surface as prev/next.
    (
      database.feature.findMany as never as ReturnType<typeof vi.fn>
    ).mockResolvedValue([{ id: "f1" }]);

    await getFeature("f1");

    const call = (
      database.feature.findMany as never as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(call.where.tenantId).toBe("t1");
  });
});
