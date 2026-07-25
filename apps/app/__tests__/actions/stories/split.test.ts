import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  storyFindFirst: vi.fn(),
  storyCreate: vi.fn(),
  storyUpdateMany: vi.fn(),
  featureFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    story: {
      findFirst: mocks.storyFindFirst,
      create: mocks.storyCreate,
      updateMany: mocks.storyUpdateMany,
    },
    feature: { findFirst: mocks.featureFindFirst },
    $transaction: mocks.transaction,
  },
}));

import {
  acceptStoryDrafts,
  decomposeFeatureWithAI,
  splitStory,
} from "../../../app/actions/stories/split";

describe("splitStory (AC-007)", () => {
  const originalStory = {
    id: "story-orig",
    status: "BACKLOG",
    featureId: "feat-1",
    sprintId: "sprint-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.storyFindFirst.mockResolvedValue(originalStory);
    mocks.storyUpdateMany.mockResolvedValue({ count: 1 });

    let callIdx = 0;
    mocks.storyCreate.mockImplementation(() => {
      callIdx += 1;
      return Promise.resolve({ id: `story-split-${callIdx}` });
    });

    mocks.transaction.mockImplementation(
      (
        fn:
          | ((tx: {
              story: {
                create: typeof vi.fn;
                updateMany: typeof vi.fn;
              };
            }) => unknown)
          | Promise<unknown>[]
      ) => {
        if (typeof fn === "function") {
          return fn({
            story: {
              create: mocks.storyCreate,
              updateMany: mocks.storyUpdateMany,
            },
          });
        }
        return Promise.all(fn as Promise<unknown>[]);
      }
    );
  });

  it("creates 3 stories and archives original as SPLIT_INTO (AC-007)", async () => {
    const result = await splitStory({
      storyId: "story-orig",
      strategy: "WORKFLOW_STEPS",
      newStories: [
        { title: "Step 1: Build UI", storyPoints: 3 },
        { title: "Step 2: API integration", storyPoints: 5 },
        { title: "Step 3: E2E validation", storyPoints: 2 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.splitIds).toHaveLength(3);

    // Original archived
    expect(mocks.storyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SPLIT_INTO",
          splitIntoStoryIds: expect.any(Array),
        }),
      })
    );
  });

  it("new stories inherit featureId and sprintId from original", async () => {
    await splitStory({
      storyId: "story-orig",
      strategy: "PERSONAS",
      newStories: [
        { title: "Admin persona story", storyPoints: 2 },
        { title: "End-user persona story", storyPoints: 3 },
      ],
    });

    expect(mocks.storyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          featureId: "feat-1",
          sprintId: "sprint-1",
          originStoryId: "story-orig",
        }),
      })
    );
  });

  it("blocks split on DONE story (AC-007 — TERMINAL_STATE)", async () => {
    mocks.storyFindFirst.mockResolvedValue({
      ...originalStory,
      status: "DONE",
    });

    const result = await splitStory({
      storyId: "story-orig",
      strategy: "WORKFLOW_STEPS",
      newStories: [
        { title: "Story A", storyPoints: 1 },
        { title: "Story B", storyPoints: 1 },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("TERMINAL_STATE");
    expect(mocks.storyCreate).not.toHaveBeenCalled();
  });

  it("blocks split on already-split story", async () => {
    mocks.storyFindFirst.mockResolvedValue({
      ...originalStory,
      status: "SPLIT_INTO",
    });

    const result = await splitStory({
      storyId: "story-orig",
      strategy: "WORKFLOW_STEPS",
      newStories: [
        { title: "Story A", storyPoints: 1 },
        { title: "Story B", storyPoints: 1 },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("TERMINAL_STATE");
  });

  it("rejects fewer than 2 new stories", async () => {
    const result = await splitStory({
      storyId: "story-orig",
      strategy: "WORKFLOW_STEPS",
      newStories: [{ title: "Only story", storyPoints: 1 }],
    });

    expect(result.ok).toBe(false);
  });
});

describe("decomposeFeatureWithAI (AC-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.featureFindFirst.mockResolvedValue({
      id: "feat-1",
      title: "Risk detection",
    });
  });

  it("returns 3-8 story drafts with COPILOT_SUGGESTION origin (AC-006)", async () => {
    const result = await decomposeFeatureWithAI({ featureId: "feat-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.drafts.length).toBeGreaterThanOrEqual(3);
    expect(result.data.drafts.length).toBeLessThanOrEqual(8);
    for (const draft of result.data.drafts) {
      expect(draft.origin).toBe("COPILOT_SUGGESTION");
      expect(draft.title).toBeTruthy();
    }
  });

  it("returns FEATURE_NOT_FOUND for unknown feature", async () => {
    mocks.featureFindFirst.mockResolvedValue(null);

    const result = await decomposeFeatureWithAI({ featureId: "nonexistent" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FEATURE_NOT_FOUND");
  });
});

describe("acceptStoryDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.featureFindFirst.mockResolvedValue({
      id: "feat-1",
      piPlanId: "pi-1",
    });

    let callIdx = 0;
    mocks.storyCreate.mockImplementation(() => {
      callIdx += 1;
      return Promise.resolve({ id: `accepted-${callIdx}` });
    });

    mocks.transaction.mockImplementation((arr: Promise<unknown>[]) =>
      Promise.all(arr)
    );
  });

  it("creates stories with COPILOT_SUGGESTION origin", async () => {
    const result = await acceptStoryDrafts({
      featureId: "feat-1",
      drafts: [
        { title: "Draft 1", storyPoints: 2 },
        { title: "Draft 2", storyPoints: 3 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.ids).toHaveLength(2);
    expect(mocks.storyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origin: "COPILOT_SUGGESTION" }),
      })
    );
  });
});
