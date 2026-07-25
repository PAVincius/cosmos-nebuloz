import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  findManyMock: vi.fn(),
  governedFindFirstMock: vi.fn(),
  requireTenantSessionMock: vi.fn(async () => ({
    tenantId: "tenant-1",
    userId: "user-1",
  })),
}));

vi.mock("@repo/database", () => ({
  database: {
    epic: { findFirst: h.findFirstMock },
    pIObjective: { findMany: h.findManyMock },
    governedEpic: { findFirst: h.governedFindFirstMock },
  },
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSessionMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { getEpicDetailFull } from "../../app/(cosmos)/actions/epic-detail";

describe("getEpicDetailFull", () => {
  it("scopes epic, PI objectives, and governance lookups to the tenant", async () => {
    h.findFirstMock.mockResolvedValue({
      id: "epic-1",
      title: "Epic 1",
      lifecycleStatus: "IMPLEMENTING",
      wsjf: 12.5,
      sizePoints: 8,
      investScore: 70,
      hypothesis: "We believe...",
      hypothesisResolution: null,
      businessOutcomes: [],
      leadingIndicators: [],
      nfrs: null,
      mvp: null,
      sizeEstimate: "M",
      descriptionVersions: [],
      leanBudgetAllocation: 50_000,
      features: [
        {
          id: "f1",
          title: "Feature 1",
          statusId: "IN_PROGRESS",
          wsjfScore: 9,
          progressPct: 40,
          storyPoints: 13,
          piPlanId: "pi-1",
        },
      ],
    });
    h.findManyMock.mockResolvedValue([
      {
        id: "obj-1",
        title: "Objective 1",
        status: "IN_PROGRESS",
        businessValue: 8,
        achievedValue: 3,
      },
    ]);
    h.governedFindFirstMock.mockResolvedValue({
      id: "ge-1",
      governanceStatus: "review",
      currentApprovalRequestId: "req-1",
    });

    const result = await getEpicDetailFull("epic-1");

    expect(result.ok).toBe(true);
    expect(h.findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "epic-1", tenantId: "tenant-1" },
      })
    );
    expect(h.findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", piPlanId: { in: ["pi-1"] } },
      })
    );
    expect(h.governedFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { epicId: "epic-1", tenantId: "tenant-1" },
      })
    );
    if (result.ok && result.data) {
      expect(result.data.piObjectives).toHaveLength(1);
      expect(result.data.governance.governanceStatus).toBe("review");
      expect(result.data.features[0]).not.toHaveProperty("piPlanId");
    }
  });

  it("returns null when the epic does not exist for this tenant", async () => {
    h.findFirstMock.mockResolvedValue(null);
    const result = await getEpicDetailFull("missing");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });
});
