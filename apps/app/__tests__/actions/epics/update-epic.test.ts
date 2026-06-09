import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  epicUpdate: vi.fn(),
  indexEntity: vi.fn(),
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
    epic: { update: mocks.epicUpdate },
  },
}));
vi.mock("@/app/actions/safe-copilot/indexer", () => ({
  indexEntity: mocks.indexEntity,
}));

import { updateEpic } from "../../../app/actions/epics/update-epic";

// UpdateEpicSchema uses z.string().min(1) for epicId (no cuid constraint)
const VALID_EPIC_ID = "epic-abc-123";

const UPDATED_EPIC = { id: VALID_EPIC_ID };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.epicUpdate.mockResolvedValue(UPDATED_EPIC);
  mocks.indexEntity.mockResolvedValue(undefined);
  mocks.revalidatePath.mockReturnValue(undefined);
});

describe("updateEpic", () => {
  it("updates title and statusId with tenant-scoped where clause", async () => {
    await updateEpic({
      epicId: VALID_EPIC_ID,
      title: "Updated Title",
      statusId: "IMPLEMENTING",
    });

    expect(mocks.epicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: VALID_EPIC_ID,
          tenantId: tenantCtx.tenantId,
        }),
        data: expect.objectContaining({
          title: "Updated Title",
          statusId: "IMPLEMENTING",
        }),
      })
    );
  });

  it("returns { ok: true, data: { id } } on success", async () => {
    const result = await updateEpic({
      epicId: VALID_EPIC_ID,
      title: "New Title",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ id: VALID_EPIC_ID });
    }
  });

  it("calls revalidatePath('/dashboard/portfolio') on success", async () => {
    await updateEpic({ epicId: VALID_EPIC_ID, statusId: "BACKLOG" });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/portfolio");
  });

  it("calls indexEntity when title changes", async () => {
    await updateEpic({ epicId: VALID_EPIC_ID, title: "Changed Title" });

    // flush microtasks queued by queueMicrotask
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.indexEntity).toHaveBeenCalledWith(
      "epic",
      VALID_EPIC_ID,
      tenantCtx.tenantId
    );
  });

  it("does NOT call indexEntity when only statusId changes (no title or description change)", async () => {
    await updateEpic({ epicId: VALID_EPIC_ID, statusId: "IMPLEMENTING" });

    // flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.indexEntity).not.toHaveBeenCalled();
  });

  it("returns { ok: false } for invalid epicId (empty string)", async () => {
    const result = await updateEpic({ epicId: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
    expect(mocks.epicUpdate).not.toHaveBeenCalled();
  });
});
