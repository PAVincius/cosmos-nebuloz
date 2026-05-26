// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    linearSync: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    epic: {
      findFirst: vi.fn(),
    },
  },
}));

global.fetch = vi.fn() as unknown as typeof fetch;

import { database } from "@repo/database";
import { pushEpicToLinear } from "@/app/actions/integrations/sync/linear-push";

const mockDb = database as unknown as {
  linearSync: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  epic: { findFirst: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pushEpicToLinear", () => {
  it("does nothing when no mapping exists", async () => {
    mockDb.linearSync.findFirst.mockResolvedValue(null);

    await pushEpicToLinear({ tenantId: "t", epicId: "epic-1", linearApiKey: "Bearer key" });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockDb.linearSync.update).not.toHaveBeenCalled();
  });

  it("does nothing when epic is not found", async () => {
    mockDb.linearSync.findFirst.mockResolvedValue({ id: "ls-1", linearId: "lin-1" });
    mockDb.epic.findFirst.mockResolvedValue(null);

    await pushEpicToLinear({ tenantId: "t", epicId: "epic-1", linearApiKey: "Bearer key" });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls Linear API and updates lastSyncedAt when mapping exists", async () => {
    mockDb.linearSync.findFirst.mockResolvedValue({ id: "ls-1", linearId: "lin-1" });
    mockDb.epic.findFirst.mockResolvedValue({ title: "My Epic", descriptionMd: "desc" });
    mockDb.linearSync.update.mockResolvedValue({});
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    await pushEpicToLinear({ tenantId: "t", epicId: "epic-1", linearApiKey: "Bearer token" });

    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.linear.app/graphql");
    expect(init.headers.Authorization).toBe("Bearer token");

    const body = JSON.parse(init.body as string);
    expect(body.variables.id).toBe("lin-1");
    expect(body.variables.input.title).toBe("My Epic");

    expect(mockDb.linearSync.update).toHaveBeenCalledOnce();
    expect(mockDb.linearSync.update.mock.calls[0][0].where).toEqual({ id: "ls-1" });
  });

  it("still updates lastSyncedAt even when Linear API returns non-ok status", async () => {
    mockDb.linearSync.findFirst.mockResolvedValue({ id: "ls-2", linearId: "lin-2" });
    mockDb.epic.findFirst.mockResolvedValue({ title: "Epic 2", descriptionMd: null });
    mockDb.linearSync.update.mockResolvedValue({});
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 429 });

    // Should not throw
    await expect(
      pushEpicToLinear({ tenantId: "t", epicId: "epic-2", linearApiKey: "Bearer token" }),
    ).resolves.toBeUndefined();

    expect(mockDb.linearSync.update).toHaveBeenCalledOnce();
  });
});
