import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  artCreate: vi.fn(),
  artFindFirst: vi.fn(),
  piPlanCreate: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));

vi.mock("@repo/database", () => ({
  database: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
    aRT: {
      create: mocks.artCreate,
      findFirst: mocks.artFindFirst,
    },
    pIPlan: {
      create: mocks.piPlanCreate,
    },
  },
}));

import {
  createSAFeStructureFromOnboarding,
  createPIsFromOnboarding,
} from "../../app/actions/onboarding/company";

const tenantCtx = { tenantId: "t1", userId: "u1", role: "RTE" as const };

describe("createSAFeStructureFromOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("creates portfolio, value streams, and ARTs returning their ids", async () => {
    mocks.artCreate.mockResolvedValue({ id: "art1", name: "Payments ART" });

    const input = {
      portfolioName: "Digital",
      valueStreams: [
        { name: "Payments", arts: [{ name: "Payments ART", cadence: 10 }] },
      ],
    };
    const result = await createSAFeStructureFromOnboarding(input);

    expect(result.portfolioName).toBe("Digital");
    expect(result.artIds).toEqual(["art1"]);
    expect(result.valueStreamCount).toBe(1);
    expect(mocks.artCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          name: "Payments ART",
          cadence: 10,
        }),
      })
    );
  });

  it("creates multiple ARTs per value stream", async () => {
    mocks.artCreate
      .mockResolvedValueOnce({ id: "art1" })
      .mockResolvedValueOnce({ id: "art2" });

    const input = {
      portfolioName: "P",
      valueStreams: [
        {
          name: "VS",
          arts: [
            { name: "ART1", cadence: 10 },
            { name: "ART2", cadence: 10 },
          ],
        },
      ],
    };
    const result = await createSAFeStructureFromOnboarding(input);

    expect(result.artIds).toEqual(["art1", "art2"]);
    expect(mocks.artCreate).toHaveBeenCalledTimes(2);
  });

  it("creates ARTs across multiple value streams", async () => {
    mocks.artCreate
      .mockResolvedValueOnce({ id: "art1" })
      .mockResolvedValueOnce({ id: "art2" });

    const input = {
      portfolioName: "Corp",
      valueStreams: [
        { name: "VS1", arts: [{ name: "ART1", cadence: 10 }] },
        { name: "VS2", arts: [{ name: "ART2", cadence: 12 }] },
      ],
    };
    const result = await createSAFeStructureFromOnboarding(input);

    expect(result.artIds).toEqual(["art1", "art2"]);
    expect(result.valueStreamCount).toBe(2);
  });

  it("revalidates /arts path after creation", async () => {
    mocks.artCreate.mockResolvedValue({ id: "art1" });

    await createSAFeStructureFromOnboarding({
      portfolioName: "P",
      valueStreams: [{ name: "VS", arts: [{ name: "A", cadence: 10 }] }],
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/arts");
  });
});

describe("createPIsFromOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("creates PI linked to the ART found by name", async () => {
    mocks.artFindFirst.mockResolvedValue({ id: "art1", name: "Payments ART" });
    mocks.piPlanCreate.mockResolvedValue({ id: "pi1", artId: "art1" });

    const result = await createPIsFromOnboarding({
      piName: "PI Q3",
      startDate: new Date("2026-07-01"),
      iterationCount: 5,
      sprintLengthDays: 14,
      artName: "Payments ART",
    });

    expect(result.piId).toBe("pi1");
    expect(result.artId).toBe("art1");
    expect(mocks.piPlanCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          artId: "art1",
          name: "PI Q3",
        }),
      })
    );
  });

  it("throws if ART not found", async () => {
    mocks.artFindFirst.mockResolvedValue(null);

    await expect(
      createPIsFromOnboarding({
        piName: "PI Q3",
        startDate: new Date("2026-07-01"),
        iterationCount: 5,
        sprintLengthDays: 14,
        artName: "Nonexistent ART",
      })
    ).rejects.toThrow("não encontrado");
  });

  it("revalidates the ART path after PI creation", async () => {
    mocks.artFindFirst.mockResolvedValue({ id: "art1", name: "Payments ART" });
    mocks.piPlanCreate.mockResolvedValue({ id: "pi1", artId: "art1" });

    await createPIsFromOnboarding({
      piName: "PI Q3",
      startDate: new Date("2026-07-01"),
      iterationCount: 5,
      sprintLengthDays: 14,
      artName: "Payments ART",
    });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/arts/art1");
  });

  it("looks up ART with correct tenantId", async () => {
    mocks.artFindFirst.mockResolvedValue({ id: "art1", name: "My ART" });
    mocks.piPlanCreate.mockResolvedValue({ id: "pi1", artId: "art1" });

    await createPIsFromOnboarding({
      piName: "PI 1",
      startDate: new Date("2026-01-01"),
      iterationCount: 5,
      sprintLengthDays: 14,
      artName: "My ART",
    });

    expect(mocks.artFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", name: "My ART" }),
      })
    );
  });
});
