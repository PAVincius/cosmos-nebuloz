import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    pIPlan: {
      findFirst: vi.fn().mockResolvedValue({
        id: "pi1",
        name: "PI-26",
        piObjectives: [
          {
            id: "o1",
            title: "Objetivo A",
            businessValue: 8,
            status: "IN_PROGRESS",
            isStretch: false,
            plannedValue: 10,
            achievedValue: 7,
            teamId: "tm1",
          },
        ],
        risks: [{ id: "r1", title: "Risco A", roamStatus: "OWNED" }],
        sprints: [{ name: "Sprint 3" }],
      }),
      findMany: vi.fn().mockResolvedValue([
        { id: "piB", name: "PI Mais Recente", ppm: 88 },
        { id: "piA", name: "PI Anterior", ppm: 81.4 },
      ]),
    },
    team: {
      findMany: vi.fn().mockResolvedValue([{ id: "tm1", name: "Squad Alpha" }]),
    },
    confidenceVoteTally: {
      findFirst: vi.fn().mockResolvedValue({ aggregateScore: 3.8 }),
    },
    aRT: {
      count: vi.fn().mockResolvedValue(3),
    },
  },
}));

import { database } from "@repo/database";
import {
  getActiveArtCount,
  getActivePiPlanning,
  listRecentPiPredictability,
} from "../../app/(cosmos)/actions/piplanning";

describe("getActivePiPlanning", () => {
  it("returns tenant-scoped objectives, risks, and confidence average", async () => {
    const r = await getActivePiPlanning();
    expect(r.ok).toBe(true);
    expect(database.pIPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
    if (r.ok && r.data) {
      expect(r.data.objectives[0].title).toBe("Objetivo A");
      expect(r.data.risks[0].roamStatus).toBe("OWNED");
      expect(r.data.confidenceAvg).toBe(3.8);
      expect(r.data.activeSprintName).toBe("Sprint 3");
      expect(r.data.objectives[0].plannedValue).toBe(10);
      expect(r.data.objectives[0].achievedValue).toBe(7);
      expect(r.data.objectives[0].teamName).toBe("Squad Alpha");
    }
    expect(database.confidenceVoteTally.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", piPlanId: "pi1" }),
      })
    );
    expect(database.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", id: { in: ["tm1"] } }),
      })
    );
  });
});

describe("listRecentPiPredictability", () => {
  it("returns tenant-scoped closed-PI PPM history, oldest→newest", async () => {
    const r = await listRecentPiPredictability();
    expect(r.ok).toBe(true);
    expect(database.pIPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          status: "CLOSED",
          ppm: { not: null },
        }),
      })
    );
    if (r.ok) {
      expect(r.data.map((p) => p.label)).toEqual([
        "PI Anterior",
        "PI Mais Recente",
      ]);
      expect(r.data[1].ppmPct).toBe(88);
    }
  });

  it("excludes a null-endDate CLOSED PI so it can't hijack the 'most recent' slot (Postgres sorts NULLs first on DESC)", async () => {
    const fakeRows = [
      {
        id: "null-end",
        name: "PI Sem Data de Fim",
        ppm: 50,
        endDate: null as Date | null,
        status: "CLOSED",
        tenantId: "t1",
      },
      {
        id: "pi-newest",
        name: "PI Mais Recente",
        ppm: 90,
        endDate: new Date("2026-06-01"),
        status: "CLOSED",
        tenantId: "t1",
      },
      {
        id: "pi-older",
        name: "PI Anterior",
        ppm: 70,
        endDate: new Date("2026-01-01"),
        status: "CLOSED",
        tenantId: "t1",
      },
    ];

    // Minimal in-memory stand-in for the real query: honors the same where
    // filters the action passes, and replicates Postgres's NULLS FIRST on
    // ORDER BY ... DESC — the exact behavior that let a null-endDate row
    // hijack the "most recent" slot before the fix.
    vi.mocked(database.pIPlan.findMany).mockImplementationOnce(
      // biome-ignore lint/suspicious/noExplicitAny: minimal Prisma stand-in for this one test
      (async (args: any) => {
        let rows = fakeRows.filter(
          (row) =>
            row.tenantId === args.where.tenantId &&
            row.status === args.where.status
        );
        if (args.where.ppm) {
          rows = rows.filter((row) => row.ppm !== null);
        }
        if (args.where.endDate) {
          rows = rows.filter((row) => row.endDate !== null);
        }
        rows = [...rows].sort((a, b) => {
          if (a.endDate === null || b.endDate === null) {
            return a.endDate === null ? -1 : 1;
          }
          return b.endDate.getTime() - a.endDate.getTime();
        });
        return rows
          .slice(0, args.take)
          .map((row) => ({ id: row.id, name: row.name, ppm: row.ppm }));
        // biome-ignore lint/suspicious/noExplicitAny: matches Prisma's findMany signature loosely enough for this stand-in
      }) as any
    );

    const r = await listRecentPiPredictability();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.map((p) => p.id)).not.toContain("null-end");
      // oldest → newest; the last entry is the one treated as "latest".
      expect(r.data.at(-1)?.id).toBe("pi-newest");
    }
  });
});

describe("getActiveArtCount", () => {
  it("returns the tenant-scoped count of active ARTs", async () => {
    const r = await getActiveArtCount();
    expect(r.ok).toBe(true);
    expect(database.aRT.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", status: "ACTIVE" }),
      })
    );
    if (r.ok) {
      expect(r.data).toBe(3);
    }
  });
});
