import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const epicBase = {
  id: "epic-1",
  title: "Test Epic",
  lifecycleStatus: "ANALYZING",
  hypothesis: null,
  hypothesisResolution: null,
  businessOutcomes: null,
  leadingIndicators: null,
  nfrs: null,
  mvp: null,
  sizeEstimate: null,
  descriptionVersions: null,
  leanBudgetAllocation: null,
  _count: { features: 0 },
  features: [],
};

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  epicFindFirstOrThrow: vi.fn(),
  epicUpdate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: {
      findFirstOrThrow: mocks.epicFindFirstOrThrow,
      update: mocks.epicUpdate,
    },
  },
}));

import {
  autosaveBusinessCase,
  getBusinessCase,
} from "../../../app/actions/epics/business-case";

describe("getBusinessCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
    mocks.epicFindFirstOrThrow.mockResolvedValue(epicBase);
  });

  it("returns business case data for a tenant-scoped epic", async () => {
    const result = await getBusinessCase("epic-1");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.epicId).toBe("epic-1");
    expect(result.data.businessOutcomes).toEqual([]);
    expect(result.data.leadingIndicators).toEqual([]);
    expect(result.data.descriptionVersions).toEqual([]);
  });

  it("queries with tenantId scope", async () => {
    await getBusinessCase("epic-1");

    expect(mocks.epicFindFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "epic-1", tenantId: tenantCtx.tenantId },
      })
    );
  });
});

describe("autosaveBusinessCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
    mocks.epicFindFirstOrThrow.mockResolvedValue({
      lifecycleStatus: "ANALYZING",
      descriptionVersions: null,
    });
    mocks.epicUpdate.mockResolvedValue({});
  });

  it("saves hypothesis and returns savedAt", async () => {
    const result = await autosaveBusinessCase({
      epicId: "epic-1",
      hypothesis: "We believe X will Y for Z, measured by W",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.savedAt).toBeDefined();
    expect(mocks.epicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "epic-1" },
        data: expect.objectContaining({
          hypothesis: "We believe X will Y for Z, measured by W",
        }),
      })
    );
  });

  it("blocks save for DONE epic (terminal state)", async () => {
    mocks.epicFindFirstOrThrow.mockResolvedValue({
      lifecycleStatus: "DONE",
      descriptionVersions: null,
    });

    const result = await autosaveBusinessCase({
      epicId: "epic-1",
      hypothesis: "New hypothesis",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("TERMINAL_STATE");
    expect(mocks.epicUpdate).not.toHaveBeenCalled();
  });

  it("blocks save for REJECTED epic (terminal state)", async () => {
    mocks.epicFindFirstOrThrow.mockResolvedValue({
      lifecycleStatus: "REJECTED",
      descriptionVersions: null,
    });

    const result = await autosaveBusinessCase({
      epicId: "epic-1",
      hypothesis: "New hypothesis",
    });

    expect(result.ok).toBe(false);
  });

  it("appends version snapshot to ring buffer", async () => {
    mocks.epicFindFirstOrThrow.mockResolvedValue({
      lifecycleStatus: "ANALYZING",
      descriptionVersions: [],
    });

    const result = await autosaveBusinessCase({
      epicId: "epic-1",
      hypothesis: "New",
      versionSnapshot: {
        field: "hypothesis",
        prev: "Old hypothesis",
        next: "New hypothesis",
        savedBy: "COPILOT",
      },
    });

    expect(result.ok).toBe(true);
    const updateCall = mocks.epicUpdate.mock.calls[0][0];
    const versions = updateCall.data.descriptionVersions as Array<{
      field: string;
      savedBy: string;
    }>;
    expect(versions).toHaveLength(1);
    expect(versions[0].field).toBe("hypothesis");
    expect(versions[0].savedBy).toBe("COPILOT");
  });

  it("ring buffer caps at 50 versions", async () => {
    const existing = Array.from({ length: 50 }, (_, i) => ({
      field: "hypothesis",
      prev: `v${i}`,
      next: `v${i + 1}`,
      savedAt: new Date().toISOString(),
      savedBy: "USER" as const,
    }));
    mocks.epicFindFirstOrThrow.mockResolvedValue({
      lifecycleStatus: "ANALYZING",
      descriptionVersions: existing,
    });

    await autosaveBusinessCase({
      epicId: "epic-1",
      versionSnapshot: {
        field: "hypothesis",
        prev: "old",
        next: "new",
        savedBy: "COPILOT",
      },
    });

    const updateCall = mocks.epicUpdate.mock.calls[0][0];
    const versions = updateCall.data.descriptionVersions as unknown[];
    expect(versions).toHaveLength(50);
  });

  it("rejects businessOutcomes exceeding 5 items", async () => {
    const result = await autosaveBusinessCase({
      epicId: "epic-1",
      businessOutcomes: [
        { id: "1", text: "a" },
        { id: "2", text: "b" },
        { id: "3", text: "c" },
        { id: "4", text: "d" },
        { id: "5", text: "e" },
        { id: "6", text: "f" }, // 6th — over limit
      ],
    });

    expect(result.ok).toBe(false);
  });
});
