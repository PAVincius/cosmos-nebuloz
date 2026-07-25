// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

// "epic1" is not a valid cuid; z.string().cuid() rejects it. Using a valid
// cuid so the schema parse passes and the GREEN test exercises the real path.
const EPIC_ID = "cjld2cjxh0000qzrmn831i7rn";

// vi.mock is hoisted above module-level consts, so the db mock object must be
// declared via vi.hoisted() to be referenceable inside the factory.
const db = vi.hoisted(() => ({
  epic: { findFirst: vi.fn(), findMany: vi.fn() },
  feature: { findMany: vi.fn() },
  flowMetricSnapshot: { findMany: vi.fn() },
  sprint: { findMany: vi.fn() },
}));

vi.mock("@repo/database", () => ({ database: db }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue(tenantCtx),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import {
  getEpicConfidence,
  getPortfolioConfidence,
} from "../../../app/actions/analytics/epic-confidence";

describe("getEpicConfidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a GREEN verdict for an on-track epic", async () => {
    db.epic.findFirst.mockResolvedValue({
      id: EPIC_ID,
      dueDate: new Date("2027-01-01"),
    });
    db.feature.findMany.mockResolvedValue([
      { assignedTeamId: "team1" },
      { assignedTeamId: "team1" },
    ]);
    db.flowMetricSnapshot.findMany.mockResolvedValue([
      { periodRef: "s1", flowVelocityTotal: 10, recordedAt: new Date() },
      { periodRef: "s2", flowVelocityTotal: 10, recordedAt: new Date() },
      { periodRef: "s3", flowVelocityTotal: 10, recordedAt: new Date() },
    ]);
    db.sprint.findMany.mockResolvedValue([
      {
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-15"),
      },
    ]);

    const res = await getEpicConfidence({ id: EPIC_ID });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rag).toBe("GREEN");
    }
  });

  it("returns an error result when the epic is missing", async () => {
    db.epic.findFirst.mockResolvedValue(null);
    const res = await getEpicConfidence({ id: EPIC_ID });
    expect(res.ok).toBe(false);
  });
});

describe("getPortfolioConfidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates RAG counts and lists at-risk epics", async () => {
    db.epic.findMany.mockResolvedValue([
      { id: "e1", title: "Green Epic", dueDate: new Date("2027-01-01") },
      { id: "e2", title: "Red Epic", dueDate: new Date("2020-01-01") },
    ]);
    // computeEpicConfidence re-queries per epic:
    db.epic.findFirst
      .mockResolvedValueOnce({ id: "e1", dueDate: new Date("2027-01-01") })
      .mockResolvedValueOnce({ id: "e2", dueDate: new Date("2020-01-01") });
    db.feature.findMany.mockResolvedValue([
      { assignedTeamId: "team1" },
      { assignedTeamId: "team1" },
    ]);
    db.flowMetricSnapshot.findMany.mockResolvedValue([
      { periodRef: "s1", flowVelocityTotal: 10, recordedAt: new Date() },
      { periodRef: "s2", flowVelocityTotal: 10, recordedAt: new Date() },
      { periodRef: "s3", flowVelocityTotal: 10, recordedAt: new Date() },
    ]);
    db.sprint.findMany.mockResolvedValue([
      { startDate: new Date("2026-01-01"), endDate: new Date("2026-01-15") },
    ]);

    const res = await getPortfolioConfidence();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.green).toBe(1);
      expect(res.data.red).toBe(1);
      expect(res.data.atRisk).toHaveLength(1);
      expect(res.data.atRisk[0].title).toBe("Red Epic");
    }
  });
});
