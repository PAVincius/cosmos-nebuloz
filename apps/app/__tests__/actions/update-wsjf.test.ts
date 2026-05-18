import { beforeEach, describe, expect, it, vi } from "vitest";
import { portfolioEpicsCacheTag } from "../../app/actions/epics/portfolio-cache";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  dispatchEvent: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  requireRole: mocks.requireRole,
  AuthError: MockAuthError,
}));

vi.mock("@repo/database", () => ({
  database: {
    feature: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("../../app/actions/events", () => ({
  dispatchEvent: mocks.dispatchEvent,
}));

import { updateFeatureWSJF } from "../../app/actions/features/update-wsjf";

describe("updateFeatureWSJF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx });
    mocks.findFirst.mockResolvedValue({ title: "Feature A", wsjfScore: 2 });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("calculates WSJF, persists with tenant scope, and revalidates cache", async () => {
    const result = await updateFeatureWSJF({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 2,
      js: 3,
    });

    expect(result).toEqual({ featureId: "feat-1", wsjfScore: 5 });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "feat-1", tenantId: tenantCtx.tenantId },
      data: { bv: 8, tc: 5, rr: 2, js: 3, wsjfScore: 5 },
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      portfolioEpicsCacheTag(tenantCtx.tenantId),
      "max"
    );
    expect(mocks.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "feature.wsjf_updated",
        featureId: "feat-1",
        newScore: 5,
        tenantId: tenantCtx.tenantId,
      })
    );
  });

  it("throws when feature is missing for tenant", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateFeatureWSJF({
        featureId: "missing",
        bv: 1,
        tc: 1,
        rr: 1,
        js: 2,
      })
    ).rejects.toThrow(/not found or access denied/i);
  });

  it("rejects invalid job size at schema boundary", async () => {
    await expect(
      updateFeatureWSJF({
        featureId: "feat-1",
        bv: 1,
        tc: 1,
        rr: 1,
        js: 0,
      })
    ).rejects.toThrow();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("denies WSJF update for DEV role", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "DEV",
    });

    await expect(
      updateFeatureWSJF({
        featureId: "feat-1",
        bv: 1,
        tc: 1,
        rr: 1,
        js: 2,
      })
    ).rejects.toThrow(/não tem permissão/);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
