import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  unstable_cache: vi.fn(),
  epicFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/cache", () => ({
  unstable_cache: (
    loader: () => Promise<unknown>,
    _keyParts: string[],
    _options: { revalidate: number; tags: string[] }
  ) => loader,
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));

vi.mock("@repo/database", () => ({
  database: {
    epic: {
      findMany: mocks.epicFindMany,
    },
  },
}));

import { getPortfolioEpics } from "../../app/actions/epics/get-portfolio";

describe("getPortfolioEpics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx });
    mocks.epicFindMany.mockResolvedValue([
      {
        id: "epic-1",
        title: "Payments",
        statusId: "BACKLOG",
        order: 0,
        features: [
          { bv: 8, tc: 5, rr: 2, js: 3, wsjfScore: 0 },
          { bv: 3, tc: 3, rr: 3, js: 3, wsjfScore: 3 },
        ],
        _count: { features: 2 },
      },
    ]);
  });

  it("loads epics for the session tenant and aggregates WSJF", async () => {
    const epics = await getPortfolioEpics();

    expect(mocks.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    expect(epics).toHaveLength(1);
    expect(epics[0]).toMatchObject({
      id: "epic-1",
      title: "Payments",
      statusId: "BACKLOG",
      wsjfScore: 4,
      featureCount: 2,
      bv: 11,
    });
  });

  it("returns empty list when tenant has no epics", async () => {
    mocks.epicFindMany.mockResolvedValue([]);

    const epics = await getPortfolioEpics();

    expect(epics).toEqual([]);
  });
});
