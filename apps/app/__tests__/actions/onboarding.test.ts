import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
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
    onboardingProgress: {
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

import {
  getOrCreateProgress,
  saveStep,
  completeFlow,
} from "../../app/actions/onboarding/index";

const tenantCtx = { tenantId: "t1", userId: "u1", role: "RTE" as const };

describe("getOrCreateProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("returns existing progress if found", async () => {
    const existing = {
      id: "p1",
      tenantId: "t1",
      flowType: "company_setup",
      currentStep: 2,
      completedSteps: ["company_profile"],
      data: {},
      status: "in_progress",
    };
    mocks.findFirst.mockResolvedValue(existing);

    const result = await getOrCreateProgress("company_setup");

    expect(result).toEqual(existing);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates new progress if not found", async () => {
    const created = {
      id: "p2",
      tenantId: "t1",
      flowType: "company_setup",
      currentStep: 0,
      completedSteps: [],
      data: {},
      status: "in_progress",
    };
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue(created);

    const result = await getOrCreateProgress("company_setup");

    expect(result.id).toBe("p2");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "t1", flowType: "company_setup" }),
      })
    );
  });
});

describe("saveStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("merges step data and advances currentStep", async () => {
    const existing = {
      id: "p1",
      tenantId: "t1",
      flowType: "company_setup",
      currentStep: 0,
      completedSteps: [],
      data: {},
      status: "in_progress",
    };
    mocks.findFirst.mockResolvedValue(existing);
    mocks.update.mockResolvedValue({
      ...existing,
      currentStep: 1,
      completedSteps: ["company_profile"],
    });

    await saveStep({
      flowType: "company_setup",
      stepKey: "company_profile",
      stepIndex: 0,
      data: { name: "Acme" },
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStep: 1,
          completedSteps: ["company_profile"],
        }),
      })
    );
  });

  it("does not duplicate stepKey in completedSteps", async () => {
    const existing = {
      id: "p1",
      tenantId: "t1",
      flowType: "company_setup",
      currentStep: 1,
      completedSteps: ["company_profile"],
      data: {},
      status: "in_progress",
    };
    mocks.findFirst.mockResolvedValue(existing);
    mocks.update.mockResolvedValue(existing);

    await saveStep({
      flowType: "company_setup",
      stepKey: "company_profile",
      stepIndex: 0,
      data: {},
    });

    const call = mocks.update.mock.calls[0][0];
    expect(call.data.completedSteps).toEqual(["company_profile"]);
  });

  it("throws if progress record does not exist", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      saveStep({
        flowType: "company_setup",
        stepKey: "company_profile",
        stepIndex: 0,
        data: {},
      })
    ).rejects.toThrow("OnboardingProgress not found.");
  });
});

describe("completeFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("sets status to completed", async () => {
    const existing = {
      id: "p1",
      tenantId: "t1",
      flowType: "company_setup",
      currentStep: 6,
      completedSteps: ["company_profile"],
      data: {},
      status: "in_progress",
    };
    mocks.findFirst.mockResolvedValue(existing);
    mocks.update.mockResolvedValue({ ...existing, status: "completed" });

    await completeFlow("company_setup");

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed" }),
      })
    );
  });

  it("throws if progress record does not exist", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(completeFlow("company_setup")).rejects.toThrow(
      "OnboardingProgress not found."
    );
  });
});
