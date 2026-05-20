import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  featureFindMany: vi.fn(),
  featureCount: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  AuthError: class AuthError extends Error {
    constructor(
      public readonly code: string,
      message?: string
    ) {
      super(message ?? code);
      this.name = "AuthError";
    }
  },
  requireTenantSession: mocks.requireTenantSession,
}));

vi.mock("@repo/database", () => ({
  database: {
    feature: {
      findMany: mocks.featureFindMany,
      count: mocks.featureCount,
    },
  },
}));

import { NextRequest } from "next/server";
import { GET } from "../../app/api/features/route";

function makeRequest(search = "") {
  return new NextRequest(`http://localhost/api/features${search}`, {
    method: "GET",
  });
}

describe("GET /api/features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx });
    mocks.featureFindMany.mockResolvedValue([
      {
        id: "feat-1",
        title: "Checkout",
        statusId: "BACKLOG",
        storyPoints: 5,
        bv: 8,
        tc: 5,
        rr: 2,
        js: 3,
        wsjfScore: 5,
        epicId: "epic-1",
        assigneeUserId: null,
        completedAt: null,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    mocks.featureCount.mockResolvedValue(1);
  });

  it("returns 401 when session is missing", async () => {
    const { AuthError } = await import("@repo/auth/server");
    mocks.requireTenantSession.mockRejectedValue(
      new AuthError("UNAUTHORIZED")
    );

    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it("returns paginated features scoped to tenant", async () => {
    const res = await GET(makeRequest("?epicId=epic-1&page=1&limit=50") as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: "feat-1", wsjfScore: 5 }),
      ]),
      total: 1,
      page: 1,
      limit: 50,
    });
    expect(mocks.featureFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, epicId: "epic-1" },
        skip: 0,
        take: 50,
      })
    );
  });

  it("applies pagination offset for page > 1", async () => {
    await GET(makeRequest("?page=2&limit=10") as never);

    expect(mocks.featureFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
        skip: 10,
        take: 10,
      })
    );
  });
});
