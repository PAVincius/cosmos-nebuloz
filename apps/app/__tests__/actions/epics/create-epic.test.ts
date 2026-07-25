import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  epicCount: vi.fn(),
  epicCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: vi.fn(),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    $transaction: mocks.transaction,
    epic: { count: mocks.epicCount, create: mocks.epicCreate },
  },
}));

import { createEpic } from "../../../app/actions/epics/create-epic";

const CREATED_EPIC = {
  id: "epic-1",
  title: "My Epic",
  statusId: "BACKLOG",
  order: 2,
};

const validInput = {
  title: "My Epic",
  statusId: "BACKLOG",
  epicType: "EPIC" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        epic: {
          count: mocks.epicCount,
          create: mocks.epicCreate,
        },
      };
      return fn(tx);
    }
  );
  mocks.epicCount.mockResolvedValue(2);
  mocks.epicCreate.mockResolvedValue(CREATED_EPIC);
  mocks.revalidatePath.mockReturnValue(undefined);
});

describe("createEpic", () => {
  it("creates epic with correct data (title, statusId, tenantId scoped, order = count)", async () => {
    await createEpic(validInput);

    expect(mocks.epicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "My Epic",
          statusId: "BACKLOG",
          tenantId: tenantCtx.tenantId,
          order: 2,
        }),
      })
    );
  });

  it("returns { ok: true, data: { id, title, statusId, order } } on success", async () => {
    const result = await createEpic(validInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        id: "epic-1",
        title: "My Epic",
        statusId: "BACKLOG",
        order: 2,
      });
    }
  });

  it("returns { ok: false, error: '...' } on Zod error — does not throw", async () => {
    // passing invalid raw input (too long title) to trigger Zod
    const result = await createEpic({
      title: "a".repeat(201),
      statusId: "BACKLOG",
      epicType: "EPIC" as const,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
    // must not throw
  });

  it("calls $transaction for counting order and creating epic", async () => {
    await createEpic(validInput);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.epicCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          statusId: "BACKLOG",
        }),
      })
    );
  });

  it("calls revalidatePath('/dashboard/portfolio') on success", async () => {
    await createEpic(validInput);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/portfolio");
  });

  it("returns { ok: false } for empty title", async () => {
    const result = await createEpic({
      title: "",
      statusId: "BACKLOG",
      epicType: "EPIC" as const,
    });

    expect(result.ok).toBe(false);
    expect(mocks.epicCreate).not.toHaveBeenCalled();
  });
});
