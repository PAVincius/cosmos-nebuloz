import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  unstable_cache: vi.fn(),
  epicFindMany: vi.fn(),
  epicCount: vi.fn(),
  oKRGroupBy: vi.fn(),
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
      count: mocks.epicCount,
    },
    oKR: {
      groupBy: mocks.oKRGroupBy,
    },
  },
}));

import {
  getPortfolioEpics,
  getPortfolioEpicsPage,
} from "../../app/actions/epics/get-portfolio";
import { PORTFOLIO_EPICS_PAGE_SIZE } from "../../app/actions/epics/portfolio-constants";

const sampleEpic = {
  id: "epic-1",
  title: "Payments",
  statusId: "BACKLOG",
  order: 0,
  features: [
    {
      bv: 8,
      tc: 5,
      rr: 2,
      js: 3,
      wsjfScore: 0,
      startedAt: null,
      completedAt: null,
      piPlan: null,
    },
    {
      bv: 3,
      tc: 3,
      rr: 3,
      js: 3,
      wsjfScore: 3,
      startedAt: null,
      completedAt: null,
      piPlan: null,
    },
  ],
  _count: { features: 2 },
  strategicTheme: null,
  governedEpic: null,
};

describe("getPortfolioEpics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx });
    mocks.oKRGroupBy.mockResolvedValue([]);
    mocks.epicFindMany.mockResolvedValue([sampleEpic]);
    mocks.epicCount.mockResolvedValue(1);
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

describe("getPortfolioEpicsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx });
    mocks.oKRGroupBy.mockResolvedValue([]);
    mocks.epicFindMany.mockResolvedValue([sampleEpic]);
    mocks.epicCount.mockResolvedValue(45);
  });

  it("paginates epics by statusId with tenant scope", async () => {
    const page = await getPortfolioEpicsPage(
      "BACKLOG",
      1,
      PORTFOLIO_EPICS_PAGE_SIZE
    );

    expect(mocks.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, statusId: "BACKLOG" },
        skip: 0,
        take: PORTFOLIO_EPICS_PAGE_SIZE,
      })
    );
    expect(page).toMatchObject({
      items: expect.any(Array),
      total: 45,
      page: 1,
      limit: PORTFOLIO_EPICS_PAGE_SIZE,
      hasMore: true,
    });
  });

  it("calculates hasMore=false on last page", async () => {
    mocks.epicCount.mockResolvedValue(1);
    mocks.epicFindMany.mockResolvedValue([sampleEpic]);

    const page = await getPortfolioEpicsPage("BACKLOG", 1, 20);

    expect(page.hasMore).toBe(false);
  });
});
