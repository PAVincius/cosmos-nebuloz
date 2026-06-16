// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    epic: {
      update: vi.fn(),
    },
  },
}));

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
import { updateEpic } from "@/app/actions/epics/update-epic";

const mockDb = database as unknown as {
  epic: {
    update: ReturnType<typeof vi.fn>;
  };
};

const mockRequireTenantSession = requireTenantSession as ReturnType<
  typeof vi.fn
>;
const mockRevalidatePath = revalidatePath as ReturnType<typeof vi.fn>;

const TENANT_ID = "tenant-abc";
const EPIC_ID = "epic-xyz";
const RE_NOT_FOUND = /record to update not found/i;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireTenantSession.mockResolvedValue({ tenantId: TENANT_ID });
  mockDb.epic.update.mockResolvedValue({ id: EPIC_ID });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("updateEpic", () => {
  it("updates title and returns id", async () => {
    const result = await updateEpic({ epicId: EPIC_ID, title: "New Title" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data).toEqual({ id: EPIC_ID });

    expect(mockDb.epic.update).toHaveBeenCalledWith({
      where: { id: EPIC_ID, tenantId: TENANT_ID },
      data: { title: "New Title" },
      select: { id: true },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/portfolio");
  });

  it("updates only the fields that are provided", async () => {
    await updateEpic({
      epicId: EPIC_ID,
      statusId: "IN_PROGRESS",
      order: 3,
    });

    expect(mockDb.epic.update).toHaveBeenCalledWith({
      where: { id: EPIC_ID, tenantId: TENANT_ID },
      data: { statusId: "IN_PROGRESS", order: 3 },
      select: { id: true },
    });
  });

  it("updates all optional fields when all are provided", async () => {
    await updateEpic({
      epicId: EPIC_ID,
      title: "Updated",
      statusId: "DONE",
      strategicThemeId: "theme-1",
      descriptionMd: "## New description",
      order: 0,
    });

    expect(mockDb.epic.update).toHaveBeenCalledWith({
      where: { id: EPIC_ID, tenantId: TENANT_ID },
      data: {
        title: "Updated",
        statusId: "DONE",
        strategicThemeId: "theme-1",
        descriptionMd: "## New description",
        order: 0,
      },
      select: { id: true },
    });
  });

  it("allows setting strategicThemeId to null", async () => {
    await updateEpic({ epicId: EPIC_ID, strategicThemeId: null });

    expect(mockDb.epic.update).toHaveBeenCalledWith({
      where: { id: EPIC_ID, tenantId: TENANT_ID },
      data: { strategicThemeId: null },
      select: { id: true },
    });
  });

  it("returns err when epic is not found for the tenant (Prisma throws)", async () => {
    // Prisma throws RecordNotFound when the compound where clause matches nothing
    mockDb.epic.update.mockRejectedValue(
      new Error("Record to update not found.")
    );

    const result = await updateEpic({ epicId: "nonexistent", title: "Test" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toMatch(RE_NOT_FOUND);
  });

  it("returns err when epicId is empty", async () => {
    const result = await updateEpic({ epicId: "" });
    expect(result.ok).toBe(false);
  });

  it("returns err when session is not available", async () => {
    mockRequireTenantSession.mockRejectedValue(new Error("Unauthorized"));

    const result = await updateEpic({ epicId: EPIC_ID, title: "Test" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBe("Unauthorized");
  });

  it("returns err when database.epic.update throws", async () => {
    mockDb.epic.update.mockRejectedValue(new Error("DB error"));

    const result = await updateEpic({ epicId: EPIC_ID, title: "Test" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBe("DB error");
  });
});
