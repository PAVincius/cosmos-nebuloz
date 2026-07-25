import { beforeEach, describe, expect, it, vi } from "vitest";

const CTX = { tenantId: "t1", userId: "u1", role: "PO" as const };

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  layoutFindUnique: vi.fn(),
  layoutUpsert: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    userDashboardLayout: {
      findUnique: mocks.layoutFindUnique,
      upsert: mocks.layoutUpsert,
    },
  },
}));

import {
  getDashboardLayout,
  upsertDashboardLayout,
} from "../../../app/actions/reporting/dashboard-layout";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(CTX);
});

describe("getDashboardLayout", () => {
  it("returns empty tiles when no layout exists", async () => {
    mocks.layoutFindUnique.mockResolvedValue(null);

    const result = await getDashboardLayout();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ tiles: [] });
  });

  it("returns saved layout config", async () => {
    const tiles = [{ id: "t1", type: "pi-burndown", x: 0, y: 0, w: 4, h: 3 }];
    mocks.layoutFindUnique.mockResolvedValue({ config: { tiles } });

    const result = await getDashboardLayout();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tiles).toEqual(tiles);
  });

  it("queries with correct tenant+user compound key", async () => {
    mocks.layoutFindUnique.mockResolvedValue(null);

    await getDashboardLayout();

    expect(mocks.layoutFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: "t1", userId: "u1" } },
      })
    );
  });
});

describe("upsertDashboardLayout", () => {
  it("saves valid layout", async () => {
    const tiles = [{ id: "t1", type: "velocity", x: 0, y: 0, w: 6, h: 4 }];
    mocks.layoutUpsert.mockResolvedValue({ config: { tiles } });

    const result = await upsertDashboardLayout({ tiles });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tiles).toEqual(tiles);
  });

  it("upserts with tenantId and userId from session — never from body", async () => {
    const tiles = [{ id: "t1", type: "velocity", x: 0, y: 0, w: 6, h: 4 }];
    mocks.layoutUpsert.mockResolvedValue({ config: { tiles } });

    await upsertDashboardLayout({ tiles, tenantId: "evil", userId: "evil" });

    expect(mocks.layoutUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tenantId: "t1", userId: "u1" }),
      })
    );
  });

  it("rejects layout exceeding 50 tiles", async () => {
    const tiles = Array.from({ length: 51 }, (_, i) => ({
      id: `t${i}`,
      type: "widget",
      x: 0,
      y: i,
      w: 1,
      h: 1,
    }));

    const result = await upsertDashboardLayout({ tiles });

    expect(result.ok).toBe(false);
    expect(mocks.layoutUpsert).not.toHaveBeenCalled();
  });

  it("rejects tile with negative coordinates", async () => {
    const result = await upsertDashboardLayout({
      tiles: [{ id: "t1", type: "chart", x: -1, y: 0, w: 2, h: 2 }],
    });

    expect(result.ok).toBe(false);
  });
});
