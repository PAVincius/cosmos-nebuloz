import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  retroCreate: vi.fn(),
  sprintFindFirst: vi.fn(),
  teamFindFirst: vi.fn(),
  retroItemFindFirst: vi.fn(),
  retroFindFirst: vi.fn(),
  retroFindFirstOrThrow: vi.fn(),
  retroFindMany: vi.fn(),
  retroItemCreate: vi.fn(),
  retroItemFindMany: vi.fn(),
  retroItemUpdate: vi.fn(),
  retroVoteCreate: vi.fn(),
  retroVoteCount: vi.fn(),
  retroActionCreate: vi.fn(),
  retroActionFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    retrospective: {
      create: mocks.retroCreate,
      findFirst: mocks.retroFindFirst,
      findFirstOrThrow: mocks.retroFindFirstOrThrow,
      findMany: mocks.retroFindMany,
    },
    retroItem: {
      create: mocks.retroItemCreate,
      findFirst: mocks.retroItemFindFirst,
      findMany: mocks.retroItemFindMany,
      update: mocks.retroItemUpdate,
    },
    sprint: { findFirst: mocks.sprintFindFirst },
    team: { findFirst: mocks.teamFindFirst },
    retroVote: {
      create: mocks.retroVoteCreate,
      count: mocks.retroVoteCount,
    },
    retroActionItem: {
      create: mocks.retroActionCreate,
      findMany: mocks.retroActionFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  addRetroActionItem,
  analyzeRetroPatterns,
  castRetroVote,
  createRetro,
  getRetroItems,
} from "../../../app/actions/sprints/retrospective";

function makeTransactionMock() {
  mocks.transaction.mockImplementation(
    (fn: (tx: Record<string, unknown>) => unknown) => {
      if (typeof fn === "function") {
        return fn({
          retrospective: {
            create: mocks.retroCreate,
            findFirst: mocks.retroFindFirst,
            findFirstOrThrow: mocks.retroFindFirstOrThrow,
          },
          retroActionItem: {
            findMany: mocks.retroActionFindMany,
            create: mocks.retroActionCreate,
          },
          retroVote: {
            create: mocks.retroVoteCreate,
            count: mocks.retroVoteCount,
          },
          retroItem: {
            findFirst: mocks.retroItemFindFirst,
            update: mocks.retroItemUpdate,
          },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    }
  );
}

// ─── createRetro carry-forward ────────────────────────────────────────────────

describe("createRetro carry-forward (AC-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.retroCreate.mockResolvedValue({ id: "retro-new" });
    mocks.sprintFindFirst.mockResolvedValue({ id: "sprint-1" });
    mocks.teamFindFirst.mockResolvedValue({ id: "team-1" });
    makeTransactionMock();
  });

  it("rejects a sprintId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.sprintFindFirst.mockResolvedValue(null);

    const result = await createRetro({
      sprintId: "sprint-of-another-tenant",
      teamId: "team-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("SPRINT_NOT_FOUND");
    expect(mocks.retroCreate).not.toHaveBeenCalled();
  });

  it("rejects a teamId that is not owned by the tenant (IDOR guard)", async () => {
    mocks.teamFindFirst.mockResolvedValue(null);

    const result = await createRetro({
      sprintId: "sprint-1",
      teamId: "team-of-another-tenant",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("TEAM_NOT_FOUND");
    expect(mocks.retroCreate).not.toHaveBeenCalled();
  });

  it("carries forward 2 open actions from prior closed retro (AC-006)", async () => {
    mocks.retroFindFirst.mockResolvedValue({ id: "retro-prior" });
    mocks.retroActionFindMany.mockResolvedValue([
      {
        title: "Set up integration tests",
        ownerId: "user-1",
        dueDate: new Date("2026-07-01"),
        carriedFromRetroId: null,
      },
      {
        title: "Improve code review process",
        ownerId: "user-2",
        dueDate: new Date("2026-07-15"),
        carriedFromRetroId: null,
      },
    ]);
    mocks.retroActionCreate.mockResolvedValue({ id: "action-new" });

    const result = await createRetro({
      sprintId: "sprint-5",
      teamId: "team-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.carriedForwardCount).toBe(2);
    expect(mocks.retroActionCreate).toHaveBeenCalledTimes(2);
    expect(mocks.retroActionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          carriedFromRetroId: "retro-prior",
          retroId: "retro-new",
        }),
      })
    );
  });

  it("creates retro with 0 carried actions when no prior retro", async () => {
    mocks.retroFindFirst.mockResolvedValue(null);

    const result = await createRetro({
      sprintId: "sprint-1",
      teamId: "team-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.carriedForwardCount).toBe(0);
    expect(mocks.retroActionCreate).not.toHaveBeenCalled();
  });
});

// ─── anonymous input phase ────────────────────────────────────────────────────

describe("getRetroItems anonymous phase (AC-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      userId: "user-sm",
      role: "SM",
    });
  });

  it("hides authorId during INPUT phase (AC-003)", async () => {
    mocks.retroFindFirstOrThrow.mockResolvedValue({
      phase: "INPUT",
      anonymousInput: true,
    });
    mocks.retroItemFindMany.mockResolvedValue([
      {
        id: "item-1",
        category: "TO_IMPROVE",
        text: "We need better test coverage",
        authorId: "user-dev",
        voteCount: 0,
      },
    ]);

    const result = await getRetroItems({ retroId: "retro-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.items[0].authorId).toBeNull();
    expect(result.data.items[0].text).toBe("We need better test coverage");
  });

  it("reveals authorId after INPUT phase (VOTING phase)", async () => {
    mocks.retroFindFirstOrThrow.mockResolvedValue({
      phase: "VOTING",
      anonymousInput: true,
    });
    mocks.retroItemFindMany.mockResolvedValue([
      {
        id: "item-1",
        category: "TO_IMPROVE",
        text: "We need better test coverage",
        authorId: "user-dev",
        voteCount: 3,
      },
    ]);

    const result = await getRetroItems({ retroId: "retro-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.items[0].authorId).toBe("user-dev");
  });
});

// ─── dot voting ───────────────────────────────────────────────────────────────

describe("castRetroVote (AC-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      userId: "user-1",
      role: "DEV",
    });
    mocks.retroVoteCreate.mockResolvedValue({});
    mocks.retroItemUpdate.mockResolvedValue({});
    mocks.retroItemFindFirst.mockResolvedValue({ id: "item-1" });
    makeTransactionMock();
  });

  it("rejects an itemId outside this retro/tenant (IDOR guard)", async () => {
    mocks.retroFindFirstOrThrow.mockResolvedValue({
      phase: "VOTING",
      votesPerMember: 3,
    });
    mocks.retroVoteCount.mockResolvedValue(0);
    mocks.retroItemFindFirst.mockResolvedValue(null);

    const result = await castRetroVote({
      retroId: "retro-1",
      itemId: "item-of-another-tenant",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("RETRO_ITEM_NOT_FOUND");
    expect(mocks.retroVoteCreate).not.toHaveBeenCalled();
    expect(mocks.retroItemUpdate).not.toHaveBeenCalled();
  });

  it("casts vote and returns remaining count (AC-004)", async () => {
    mocks.retroFindFirstOrThrow.mockResolvedValue({
      phase: "VOTING",
      votesPerMember: 3,
    });
    mocks.retroVoteCount.mockResolvedValue(1); // 1 used

    const result = await castRetroVote({
      retroId: "retro-1",
      itemId: "item-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.votesRemaining).toBe(1); // 3 - 1 - 1 = 1
  });

  it("blocks vote when all votes used (AC-004)", async () => {
    mocks.retroFindFirstOrThrow.mockResolvedValue({
      phase: "VOTING",
      votesPerMember: 3,
    });
    mocks.retroVoteCount.mockResolvedValue(3); // all used

    const result = await castRetroVote({
      retroId: "retro-1",
      itemId: "item-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("VOTES_EXHAUSTED");
    expect(mocks.retroVoteCreate).not.toHaveBeenCalled();
  });
});

// ─── action items ─────────────────────────────────────────────────────────────

describe("addRetroActionItem (AC-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
    mocks.retroFindFirstOrThrow.mockResolvedValue({ id: "retro-1" });
    mocks.retroActionCreate.mockResolvedValue({ id: "action-1" });
  });

  it("creates action item with owner and future due date (AC-005)", async () => {
    const futureDueDate = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const result = await addRetroActionItem({
      retroId: "retro-1",
      title: "Set up automated integration tests",
      ownerId: "user-1",
      dueDate: futureDueDate,
    });

    expect(result.ok).toBe(true);
    expect(mocks.retroActionCreate).toHaveBeenCalled();
  });

  it("rejects action item with past due date (AC-005)", async () => {
    const result = await addRetroActionItem({
      retroId: "retro-1",
      title: "Some action",
      ownerId: "user-1",
      dueDate: "2020-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("DUE_DATE_MUST_BE_FUTURE");
    expect(mocks.retroActionCreate).not.toHaveBeenCalled();
  });
});

// ─── pattern analysis ─────────────────────────────────────────────────────────

describe("analyzeRetroPatterns (AC-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "SM" });
  });

  it("returns insufficientData when fewer than 3 retros (AC-007)", async () => {
    mocks.retroFindMany.mockResolvedValue([
      { id: "retro-1" },
      { id: "retro-2" },
    ]);

    const result = await analyzeRetroPatterns({ teamId: "team-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.insufficientData).toBe(true);
    expect(result.data.themes).toHaveLength(0);
  });

  it("returns recurring themes when ≥3 retros (AC-007)", async () => {
    mocks.retroFindMany.mockResolvedValue([
      { id: "retro-1" },
      { id: "retro-2" },
      { id: "retro-3" },
    ]);
    mocks.retroItemFindMany.mockResolvedValue([
      { text: "we need better test coverage", retroId: "retro-1" },
      { text: "we need better test coverage", retroId: "retro-2" },
      { text: "we need better test coverage", retroId: "retro-3" },
      { text: "slow deploys", retroId: "retro-1" },
    ]);

    const result = await analyzeRetroPatterns({ teamId: "team-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.insufficientData).toBe(false);
    expect(result.data.themes.length).toBeGreaterThanOrEqual(1);
    expect(result.data.themes[0].count).toBeGreaterThanOrEqual(2);
  });
});
