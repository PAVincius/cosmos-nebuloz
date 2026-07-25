import { beforeEach, describe, expect, it, vi } from "vitest";
import { portfolioEpicsCacheTag } from "../../app/actions/epics/portfolio-cache";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidateTag: vi.fn(),
  epicUpdateMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));

vi.mock("@repo/database", () => ({
  database: {
    epic: {
      updateMany: mocks.epicUpdateMany,
    },
  },
}));

import { updateEpicStatus } from "../../app/actions/epics/update-status";

describe("updateEpicStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx });
    mocks.epicUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("updates epic status scoped to tenant and revalidates portfolio cache", async () => {
    await updateEpicStatus("epic-1", "IMPLEMENTING", 3);

    expect(mocks.epicUpdateMany).toHaveBeenCalledWith({
      where: { id: "epic-1", tenantId: tenantCtx.tenantId },
      data: { statusId: "IMPLEMENTING", order: 3 },
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      portfolioEpicsCacheTag(tenantCtx.tenantId),
      "max"
    );
  });

  it("throws when epic is not found for tenant", async () => {
    mocks.epicUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateEpicStatus("epic-missing", "BACKLOG", 0)
    ).rejects.toThrow(/not found or access denied/i);
  });

  it("rejects invalid portfolio status", async () => {
    await expect(updateEpicStatus("epic-1", "FUNNEL", 0)).rejects.toThrow();
    expect(mocks.epicUpdateMany).not.toHaveBeenCalled();
  });
});
