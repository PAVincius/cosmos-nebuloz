import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const rteCtx = { ...tenantCtx, role: "RTE" as const };

const txMock = {
  pIPlan: { create: vi.fn() },
  feature: { updateMany: vi.fn() },
  pIObjective: { createMany: vi.fn() },
  risk: { createMany: vi.fn() },
  artSequenceCounter: { upsert: vi.fn() },
};

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  artFindFirst: vi.fn(),
  pIPlanCreate: vi.fn(),
  pIPlanFindFirst: vi.fn(),
  featureFindMany: vi.fn(),
  teamFindMany: vi.fn(),
  pIObjectiveFindMany: vi.fn(),
  pIObjectiveFindFirst: vi.fn(),
  pIObjectiveCreate: vi.fn(),
  pIObjectiveUpdate: vi.fn(),
  riskFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    $transaction: mocks.transaction,
    aRT: { findFirst: mocks.artFindFirst },
    pIPlan: { create: mocks.pIPlanCreate, findFirst: mocks.pIPlanFindFirst },
    feature: { findMany: mocks.featureFindMany },
    team: { findMany: mocks.teamFindMany },
    pIObjective: {
      findMany: mocks.pIObjectiveFindMany,
      findFirst: mocks.pIObjectiveFindFirst,
      create: mocks.pIObjectiveCreate,
      update: mocks.pIObjectiveUpdate,
    },
    risk: { findMany: mocks.riskFindMany },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    oKR: { findMany: vi.fn().mockResolvedValue([]) },
    themeART: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import {
  createPIObjective,
  createPIPlan,
  createPIPlanWithDetails,
  getBacklogFeatures,
  getPIPlanById,
  getPIPlanFullDetails,
  getPIPlanWithDetails,
  getTeamsForART,
  updatePIObjective,
} from "../../app/actions/arts/pi-plans";

const ART_ID = "art-1";
const PI_ID = "pi-1";
const ART = { id: ART_ID, name: "SAFe ART", artId: ART_ID };
const PI = { id: PI_ID, artId: ART_ID, name: "PI-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(rteCtx);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.artFindFirst.mockResolvedValue(ART);
  mocks.pIPlanCreate.mockResolvedValue(PI);
  mocks.pIPlanFindFirst.mockResolvedValue(null);
  mocks.featureFindMany.mockResolvedValue([]);
  mocks.teamFindMany.mockResolvedValue([]);
  mocks.pIObjectiveFindMany.mockResolvedValue([]);
  mocks.pIObjectiveFindFirst.mockResolvedValue(null);
  mocks.riskFindMany.mockResolvedValue([]);
  mocks.transaction.mockImplementation(
    async (cb: (tx: typeof txMock) => Promise<unknown>) => {
      txMock.pIPlan.create.mockResolvedValue(PI);
      txMock.feature.updateMany.mockResolvedValue({ count: 0 });
      txMock.pIObjective.createMany.mockResolvedValue({ count: 0 });
      txMock.risk.createMany.mockResolvedValue({ count: 0 });
      return cb(txMock);
    }
  );
});

// ─── createPIPlan ─────────────────────────────────────────────────────────────

describe("createPIPlan", () => {
  it("creates plan with tenant scope and revalidates", async () => {
    const result = await createPIPlan({ artId: ART_ID, name: "PI-1" });
    expect(mocks.pIPlanCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: rteCtx.tenantId,
          artId: ART_ID,
        }),
      })
    );
    expect(result).toMatchObject({ id: PI_ID });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("throws when ART not found in tenant", async () => {
    mocks.artFindFirst.mockResolvedValue(null);
    await expect(
      createPIPlan({ artId: "missing", name: "PI" })
    ).rejects.toThrow(/not found/i);
  });

  it("rejects invalid input (missing name)", async () => {
    await expect(createPIPlan({ artId: ART_ID, name: "" })).rejects.toThrow();
  });
});

// ─── createPIPlanWithDetails ──────────────────────────────────────────────────

describe("createPIPlanWithDetails", () => {
  const validInput = {
    artId: ART_ID,
    name: "PI-1",
    featureIds: ["f1"],
    objectives: [
      { title: "Obj 1", businessValue: 8, isStretch: false, description: "" },
    ],
    risks: [
      {
        title: "Risk 1",
        impact: "high",
        probability: "medium",
        status: "owned",
        description: "",
        category: "",
      },
    ],
  };

  it("runs DB transaction and revalidates paths", async () => {
    await createPIPlanWithDetails(validInput);
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      expect.stringContaining(ART_ID)
    );
  });

  it("throws when ART not found", async () => {
    mocks.artFindFirst.mockResolvedValue(null);
    await expect(createPIPlanWithDetails(validInput)).rejects.toThrow(
      /not found/i
    );
  });
});

// ─── getPIPlanById ────────────────────────────────────────────────────────────

describe("getPIPlanById", () => {
  it("returns plan when found", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue({
      ...PI,
      art: ART,
      piSessions: [],
    });
    const result = await getPIPlanById(PI_ID);
    expect(result).toMatchObject({ id: PI_ID });
  });

  it("returns null when not found", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue(null);
    const result = await getPIPlanById("missing");
    expect(result).toBeNull();
  });
});

// ─── getBacklogFeatures ───────────────────────────────────────────────────────

describe("getBacklogFeatures", () => {
  it("returns features without piPlanId", async () => {
    mocks.featureFindMany.mockResolvedValue([{ id: "f1", title: "Feature A" }]);
    const result = await getBacklogFeatures();
    expect(result).toHaveLength(1);
    expect(mocks.featureFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: rteCtx.tenantId, piPlanId: null },
      })
    );
  });
});

// ─── getTeamsForART ───────────────────────────────────────────────────────────

describe("getTeamsForART", () => {
  it("returns teams scoped to ART and tenant", async () => {
    mocks.teamFindMany.mockResolvedValue([{ id: "t1", name: "Team Alpha" }]);
    const result = await getTeamsForART(ART_ID);
    expect(result).toHaveLength(1);
    expect(mocks.teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { artId: ART_ID, tenantId: rteCtx.tenantId },
      })
    );
  });
});

// ─── getPIPlanWithDetails ─────────────────────────────────────────────────────

describe("getPIPlanWithDetails", () => {
  it("returns null when no plan found for ART", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue(null);
    const result = await getPIPlanWithDetails(ART_ID);
    expect(result).toBeNull();
  });

  it("returns plan with objectives, risks, features, teams", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue({
      ...PI,
      art: ART,
      piSessions: [],
    });
    mocks.pIObjectiveFindMany.mockResolvedValue([{ id: "obj-1" }]);
    mocks.riskFindMany.mockResolvedValue([{ id: "r-1" }]);
    mocks.teamFindMany.mockResolvedValue([{ id: "t-1" }]);
    const result = await getPIPlanWithDetails(ART_ID);
    expect(result?.objectives).toHaveLength(1);
    expect(result?.risks).toHaveLength(1);
  });
});

// ─── getPIPlanFullDetails ─────────────────────────────────────────────────────

describe("getPIPlanFullDetails", () => {
  it("returns null when plan not found", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue(null);
    expect(await getPIPlanFullDetails("missing")).toBeNull();
  });

  it("returns plan details when found", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue({ ...PI, art: ART });
    mocks.pIObjectiveFindMany.mockResolvedValue([]);
    mocks.riskFindMany.mockResolvedValue([]);
    mocks.teamFindMany.mockResolvedValue([]);
    const result = await getPIPlanFullDetails(PI_ID);
    expect(result).toMatchObject({ id: PI_ID });
  });
});

// ─── updatePIObjective ────────────────────────────────────────────────────────

describe("updatePIObjective", () => {
  it("updates objective and revalidates PI planning path", async () => {
    mocks.pIObjectiveFindFirst.mockResolvedValue({
      id: "obj-1",
      piPlan: { art: { id: ART_ID } },
    });
    mocks.pIObjectiveUpdate.mockResolvedValue({ id: "obj-1", status: "DONE" });
    const result = await updatePIObjective("obj-1", { status: "DONE" });
    expect(result).toMatchObject({ status: "DONE" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      expect.stringContaining(ART_ID)
    );
  });

  it("throws when objective not found", async () => {
    mocks.pIObjectiveFindFirst.mockResolvedValue(null);
    await expect(updatePIObjective("missing", {})).rejects.toThrow(
      /não encontrado/i
    );
  });
});

// ─── createPIObjective ────────────────────────────────────────────────────────

describe("createPIObjective", () => {
  it("creates objective with defaults and revalidates", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue({ ...PI, art: { id: ART_ID } });
    mocks.pIObjectiveCreate.mockResolvedValue({ id: "obj-new" });
    const result = await createPIObjective({
      piPlanId: PI_ID,
      title: "New Obj",
    });
    expect(result).toMatchObject({ id: "obj-new" });
    expect(mocks.pIObjectiveCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "New Obj",
          isStretch: false,
          businessValue: 0,
          status: "NOT_STARTED",
        }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("throws when PI plan not found", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue(null);
    await expect(
      createPIObjective({ piPlanId: "missing", title: "T" })
    ).rejects.toThrow(/não encontrado/i);
  });
});
