// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn(),
}));

vi.mock("@repo/database", () => {
  const epicCount = vi.fn();
  const epicCreate = vi.fn();

  return {
    database: {
      epic: { count: epicCount, create: epicCreate },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ epic: { count: epicCount, create: epicCreate } })
      ),
    },
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { createEpic } from "@/app/actions/epics/create-epic";

const mockDb = database as {
  epic: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockRequireTenantSession = requireTenantSession as ReturnType<
  typeof vi.fn
>;
const mockRevalidatePath = revalidatePath as ReturnType<typeof vi.fn>;

const TENANT_ID = "tenant-abc";
const RE_TITULO = /título/i;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireTenantSession.mockResolvedValue({ tenantId: TENANT_ID });
  // Re-wire $transaction after clearAllMocks so it still delegates to epic fns
  mockDb.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ epic: { count: mockDb.epic.count, create: mockDb.epic.create } })
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createEpic", () => {
  it("creates an epic with correct data and returns it", async () => {
    mockDb.epic.count.mockResolvedValue(2);
    mockDb.epic.create.mockResolvedValue({
      id: "epic-1",
      title: "My Epic",
      statusId: "BACKLOG",
      order: 2,
    });

    const result = await createEpic({ title: "My Epic" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data).toEqual({
      id: "epic-1",
      title: "My Epic",
      statusId: "BACKLOG",
      order: 2,
    });

    expect(mockDb.epic.count).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, statusId: "BACKLOG" },
    });

    expect(mockDb.epic.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_ID,
        title: "My Epic",
        statusId: "BACKLOG",
        strategicThemeId: null,
        descriptionMd: null,
        order: 2,
      },
      select: { id: true, title: true, statusId: true, order: true },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/portfolio");
  });

  it("uses provided statusId for column count", async () => {
    mockDb.epic.count.mockResolvedValue(5);
    mockDb.epic.create.mockResolvedValue({
      id: "epic-2",
      title: "In Progress Epic",
      statusId: "IN_PROGRESS",
      order: 5,
    });

    const result = await createEpic({
      title: "In Progress Epic",
      statusId: "IN_PROGRESS",
    });

    expect(result.ok).toBe(true);
    expect(mockDb.epic.count).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, statusId: "IN_PROGRESS" },
    });
  });

  it("passes optional fields through", async () => {
    mockDb.epic.count.mockResolvedValue(0);
    mockDb.epic.create.mockResolvedValue({
      id: "epic-3",
      title: "Themed Epic",
      statusId: "BACKLOG",
      order: 0,
    });

    await createEpic({
      title: "Themed Epic",
      strategicThemeId: "theme-1",
      descriptionMd: "## Description",
    });

    expect(mockDb.epic.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          strategicThemeId: "theme-1",
          descriptionMd: "## Description",
        }),
      })
    );
  });

  it("returns err when title is empty", async () => {
    const result = await createEpic({ title: "" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toMatch(RE_TITULO);
  });

  it("returns err when database.epic.create throws", async () => {
    mockDb.epic.count.mockResolvedValue(0);
    mockDb.epic.create.mockRejectedValue(new Error("DB connection failed"));

    const result = await createEpic({ title: "Valid Title" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBe("DB connection failed");
  });

  it("returns err when session is not available", async () => {
    mockRequireTenantSession.mockRejectedValue(new Error("Unauthorized"));

    const result = await createEpic({ title: "Valid Title" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBe("Unauthorized");
  });
});
