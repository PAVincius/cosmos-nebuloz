import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  strategyPillarFindMany: vi.fn(),
  strategyPillarFindFirst: vi.fn(),
  strategyPillarCreate: vi.fn(),
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
    strategyPillar: {
      findMany: h.strategyPillarFindMany,
      findFirst: h.strategyPillarFindFirst,
      create: h.strategyPillarCreate,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createPillar,
  getStrategyPillar,
  listStrategyPillars,
} from "../../app/(cosmos)/actions/strategy";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listStrategyPillars", () => {
  it("returns tenant-scoped pillars with nested themes", async () => {
    h.strategyPillarFindMany.mockResolvedValue([
      {
        id: "p1",
        name: "Crescimento",
        tone: "accent",
        themes: [
          {
            id: "th1",
            title: "Expansão LATAM",
            healthStatus: "on",
            targetAllocationPct: 25,
            epics: [],
          },
        ],
      },
    ]);

    const r = await listStrategyPillars();
    expect(r.ok).toBe(true);
    expect(database.strategyPillar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].themes[0].title).toBe("Expansão LATAM");
    }
  });

  it("computes the epic rollup (through themes[].epics) per pillar, same as getStrategyPillar", async () => {
    h.strategyPillarFindMany.mockResolvedValue([
      {
        id: "p1",
        name: "Crescimento",
        tone: "accent",
        themes: [
          {
            id: "th1",
            title: "Expansão LATAM",
            healthStatus: "on",
            targetAllocationPct: 25,
            epics: [
              { featureCount: 4, doneFeatureCount: 2 },
              { featureCount: 4, doneFeatureCount: 4 },
            ],
          },
          {
            id: "th2",
            title: "Tema sem épicos",
            healthStatus: "watch",
            targetAllocationPct: null,
            epics: [],
          },
        ],
      },
      {
        id: "p2",
        name: "Sem temas",
        tone: "neutral",
        themes: [],
      },
    ]);

    const r = await listStrategyPillars();

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data[0].epicCount).toBe(2);
    expect(r.data[0].avgProgress).toBe(75); // (50 + 100) / 2
    expect(r.data[1].epicCount).toBe(0);
    expect(r.data[1].avgProgress).toBe(0);
    // themes[] in the response never leaks the raw epics rows.
    expect(r.data[0].themes[0]).not.toHaveProperty("epics");
  });
});

describe("getStrategyPillar", () => {
  it("is tenant-scoped and returns not-found for a cross-tenant pillar id", async () => {
    // Simulates the real Prisma behavior when `id` belongs to another tenant:
    // a `where: { id, tenantId }` finds nothing. This assertion also pins the
    // exact where-clause shape, so it fails if `tenantId` were ever dropped
    // from the query (the pillar would then resolve across tenants).
    h.strategyPillarFindFirst.mockResolvedValue(null);

    const res = await getStrategyPillar("foreign-pillar");

    expect(res.ok).toBe(false);
    expect(h.strategyPillarFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-pillar", tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("computes the epic rollup from the real StrategicTheme -> Epic relation", async () => {
    h.strategyPillarFindFirst.mockResolvedValue({
      id: "p1",
      name: "Crescimento",
      tone: "accent",
      themes: [
        {
          id: "th1",
          title: "Expansão LATAM",
          healthStatus: "on",
          targetAllocationPct: 25,
          epics: [
            {
              id: "e1",
              title: "Epic A",
              wsjf: 12,
              featureCount: 4,
              doneFeatureCount: 2,
            },
            {
              id: "e2",
              title: "Epic B",
              wsjf: 8,
              featureCount: 4,
              doneFeatureCount: 4,
            },
          ],
        },
        {
          id: "th2",
          title: "Tema sem épicos",
          healthStatus: "watch",
          targetAllocationPct: null,
          epics: [],
        },
      ],
    });

    const r = await getStrategyPillar("p1");

    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    // Rollup is derived from the nested themes[].epics, not a direct
    // pillar->epic relation (none exists) — verifies the join is walked.
    expect(r.data.epicCount).toBe(2);
    expect(r.data.doneEpicCount).toBe(1);
    expect(r.data.avgProgress).toBe(75);
    expect(r.data.epics.map((e) => e.themeTitle)).toEqual([
      "Expansão LATAM",
      "Expansão LATAM",
    ]);
    expect(r.data.epics.find((e) => e.id === "e2")?.progressPct).toBe(100);
    expect(r.data.themes[0].epicCount).toBe(2);
    expect(r.data.themes[0].avgProgress).toBe(75);
    expect(r.data.themes[1].epicCount).toBe(0);
    expect(r.data.themes[1].avgProgress).toBe(0);
  });
});

describe("createPillar", () => {
  const validInput = {
    name: "Excelência Operacional",
    tone: "blue",
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createPillar(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.strategyPillarCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and revalidates on success", async () => {
    h.strategyPillarCreate.mockResolvedValue({ id: "new-pillar" });

    const res = await createPillar(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-pillar");
    }
    expect(h.strategyPillarCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          name: validInput.name,
          tone: validInput.tone,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "pillar",
        entityId: "new-pillar",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("defaults tone to accent when omitted", async () => {
    h.strategyPillarCreate.mockResolvedValue({ id: "new-pillar-2" });

    await createPillar({ name: "Tema simples" });

    expect(h.strategyPillarCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tone: "accent",
        }),
      })
    );
  });
});
