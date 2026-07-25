import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  artFindMany: vi.fn(),
  artFindFirst: vi.fn(),
  artCreate: vi.fn(),
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
    aRT: {
      findMany: mocks.artFindMany,
      findFirst: mocks.artFindFirst,
      create: mocks.artCreate,
    },
  },
}));

import {
  createART,
  getARTById,
  getARTs,
} from "../../../app/actions/arts/get-arts";

describe("getARTs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("happy path returns ART list scoped to tenant", async () => {
    const artList = [
      {
        id: "art-1",
        name: "ART One",
        tenantId: tenantCtx.tenantId,
        piPlans: [],
      },
      {
        id: "art-2",
        name: "ART Two",
        tenantId: tenantCtx.tenantId,
        piPlans: [],
      },
    ];
    mocks.artFindMany.mockResolvedValue(artList);

    const result = await getARTs();

    expect(result).toEqual(artList);
    expect(mocks.artFindMany).toHaveBeenCalledOnce();
    expect(mocks.artFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
  });
});

describe("getARTById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("returns single ART with nested piPlans+piSessions+confidenceSessions", async () => {
    const artId = "art-1";
    const artRecord = {
      id: artId,
      name: "ART One",
      tenantId: tenantCtx.tenantId,
      piPlans: [
        {
          id: "pi-1",
          piSessions: [
            {
              id: "session-1",
              confidenceSessions: [{ id: "conf-1", roundNumber: 1 }],
            },
          ],
        },
      ],
    };
    mocks.artFindFirst.mockResolvedValue(artRecord);

    const result = await getARTById(artId);

    expect(result).toEqual(artRecord);
    expect(mocks.artFindFirst).toHaveBeenCalledOnce();
    expect(mocks.artFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: artId, tenantId: tenantCtx.tenantId },
        include: expect.objectContaining({
          piPlans: expect.objectContaining({
            include: expect.objectContaining({
              piSessions: expect.objectContaining({
                include: expect.objectContaining({
                  confidenceSessions: expect.anything(),
                }),
              }),
            }),
          }),
        }),
      })
    );
  });
});

describe("createART", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
    mocks.requireRole.mockReturnValue(undefined);
  });

  it("happy path creates ART and calls revalidatePath('/arts')", async () => {
    const newArt = {
      id: "art-new",
      name: "New ART",
      cadence: 10,
      tenantId: tenantCtx.tenantId,
    };
    mocks.artCreate.mockResolvedValue(newArt);

    const result = await createART({ name: "New ART", cadence: 10 });

    expect(result).toEqual(newArt);
    expect(mocks.artCreate).toHaveBeenCalledOnce();
    expect(mocks.artCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          name: "New ART",
          cadence: 10,
        }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/arts");
  });

  it("throws when role check fails (VIEWER can't create)", async () => {
    mocks.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "Insufficient role");
    });

    await expect(createART({ name: "New ART", cadence: 10 })).rejects.toThrow(
      "Insufficient role"
    );

    expect(mocks.artCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("throws Zod error on invalid input (missing name)", async () => {
    await expect(createART({ cadence: 10, name: "" })).rejects.toThrow();

    expect(mocks.artCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
