import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── PR linking pure tests ────────────────────────────────────────────────────

import {
  extractStorySequenceIds,
  type GitHubPR,
  isLinkedPR,
} from "../../../lib/github/pr-linking";

const makePR = (overrides: Partial<GitHubPR> = {}): GitHubPR => ({
  number: 1,
  title: "My PR",
  body: null,
  headBranch: "feature/my-feature",
  url: "https://github.com/org/repo/pull/1",
  state: "open",
  ...overrides,
});

describe("extractStorySequenceIds (AC-001/AC-002)", () => {
  it("extracts story ID from 'Closes COSMOS-42' in body (AC-001)", () => {
    const pr = makePR({ body: "This PR implements auth.\n\nCloses COSMOS-42" });
    expect(extractStorySequenceIds(pr)).toEqual([42]);
  });

  it("extracts story ID from 'Fixes COSMOS-99' (AC-001)", () => {
    const pr = makePR({ body: "Fixes COSMOS-99" });
    expect(extractStorySequenceIds(pr)).toContain(99);
  });

  it("extracts multiple story IDs from body (AC-001)", () => {
    const pr = makePR({
      body: "Closes COSMOS-10\nFixes COSMOS-11\nResolves COSMOS-12",
    });
    const ids = extractStorySequenceIds(pr);
    expect(ids).toContain(10);
    expect(ids).toContain(11);
    expect(ids).toContain(12);
  });

  it("deduplicates repeated IDs (AC-001)", () => {
    const pr = makePR({
      body: "Closes COSMOS-7\nCloses COSMOS-7",
    });
    expect(extractStorySequenceIds(pr)).toEqual([7]);
  });

  it("extracts from branch cosmos/story-42-... (AC-002)", () => {
    const pr = makePR({ headBranch: "cosmos/story-42-implement-payment-flow" });
    expect(extractStorySequenceIds(pr)).toContain(42);
  });

  it("extracts from branch cosmos/42-... (AC-002)", () => {
    const pr = makePR({ headBranch: "cosmos/42-my-feature" });
    expect(extractStorySequenceIds(pr)).toContain(42);
  });

  it("returns empty for unrelated PR (AC-004)", () => {
    const pr = makePR({ body: "Some fix", headBranch: "feat/no-cosmos-link" });
    expect(extractStorySequenceIds(pr)).toEqual([]);
  });

  it("keyword extraction is case-insensitive (AC-001)", () => {
    const pr = makePR({ body: "closes COSMOS-5" });
    expect(extractStorySequenceIds(pr)).toContain(5);
  });
});

describe("isLinkedPR (AC-004)", () => {
  it("returns true when linked", () => {
    expect(isLinkedPR(makePR({ body: "Closes COSMOS-1" }))).toBe(true);
  });

  it("returns false when not linked", () => {
    expect(isLinkedPR(makePR({ body: "Just a bugfix" }))).toBe(false);
  });
});

// ─── DORA metrics pure tests ──────────────────────────────────────────────────

import { computeDORAMetrics } from "../../../lib/github/dora-metrics";

describe("computeDORAMetrics (AC-005)", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  const makeDeployment = (
    hoursAgo: number,
    state: "success" | "failure" = "success",
    firstCommitHoursAgo?: number
  ) => ({
    deployedAt: new Date(now.getTime() - hoursAgo * 3_600_000),
    firstCommitAt:
      firstCommitHoursAgo !== null
        ? new Date(now.getTime() - firstCommitHoursAgo * 3_600_000)
        : undefined,
    state,
  });

  it("computes deployment frequency (AC-005)", () => {
    // 30 deployments in 30 days = 1/day
    const deployments = Array.from({ length: 30 }, (_, i) =>
      makeDeployment(i * 24)
    );
    const result = computeDORAMetrics(deployments, [], 30);
    expect(result.deploymentFrequency).toBeCloseTo(1, 1);
  });

  it("computes lead time (AC-005)", () => {
    // Deployed 1h after first commit
    const deployments = [makeDeployment(0, "success", 1)];
    const result = computeDORAMetrics(deployments, [], 30);
    expect(result.avgLeadTimeHours).toBeCloseTo(1, 1);
  });

  it("computes change failure rate (AC-005)", () => {
    // Deployment happened 2h ago; incident started 1h ago (30min after deploy)
    const deployment = makeDeployment(2); // deployedAt = now - 2h
    const incident = {
      startedAt: new Date(now.getTime() - 1 * 3_600_000), // 1h ago (30min after deploy)
      resolvedAt: new Date(now.getTime() + 2 * 3_600_000),
    };
    const result = computeDORAMetrics([deployment], [incident], 30);
    expect(result.changeFailureRate).toBe(1); // 1/1 = 100%
  });

  it("computes MTTR (AC-005)", () => {
    const incident = {
      startedAt: new Date(now.getTime() - 4 * 3_600_000),
      resolvedAt: new Date(now.getTime() - 2 * 3_600_000), // 2h restore
    };
    const result = computeDORAMetrics([], [incident], 30);
    expect(result.mttrHours).toBeCloseTo(2, 1);
  });

  it("classifies Elite performers (AC-005)", () => {
    const deployments = Array.from(
      { length: 60 },
      (_, i) => makeDeployment(i * 12, "success", i * 12 + 0.5) // deploy 30min after commit
    );
    const result = computeDORAMetrics(deployments, [], 30);
    expect(result.classification).toBe("Elite");
  });

  it("classifies Low performers (AC-005)", () => {
    // 1 deployment in 30 days, high CFR, long MTTR
    const deployment = makeDeployment(0, "success", 24 * 60); // 60 day lead time
    const incident = {
      startedAt: new Date(now.getTime() - 0.3 * 3_600_000),
      resolvedAt: new Date(now.getTime() + 48 * 3_600_000),
    };
    const result = computeDORAMetrics([deployment], [incident], 30);
    expect(result.classification).toBe("Low");
  });

  it("returns 0 for all metrics when no data (AC-005)", () => {
    const result = computeDORAMetrics([], [], 30);
    expect(result.deploymentFrequency).toBe(0);
    expect(result.avgLeadTimeHours).toBe(0);
    expect(result.changeFailureRate).toBe(0);
    expect(result.mttrHours).toBe(0);
  });
});

// ─── handleGitHubWebhook (AC-001/AC-004) ─────────────────────────────────────

const mocks = vi.hoisted(() => ({
  storyFindMany: vi.fn(),
  storyUpdateMany: vi.fn(),
  featureUpdateMany: vi.fn(),
  gitHubSyncFindFirst: vi.fn(),
  gitHubSyncUpsert: vi.fn(),
  stateTransitionCreate: vi.fn(),
  githubSyncEventCreate: vi.fn(),
  gitHubUnlinkedPRCreate: vi.fn(),
  gitHubDeploymentEventCreate: vi.fn(),
  epicUpdateMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    story: {
      findMany: mocks.storyFindMany,
      updateMany: mocks.storyUpdateMany,
    },
    feature: { updateMany: mocks.featureUpdateMany },
    gitHubSync: {
      findFirst: mocks.gitHubSyncFindFirst,
      upsert: mocks.gitHubSyncUpsert,
    },
    stateTransitionHistory: { create: mocks.stateTransitionCreate },
    gitHubSyncEvent: { create: mocks.githubSyncEventCreate },
    gitHubUnlinkedPR: { create: mocks.gitHubUnlinkedPRCreate },
    gitHubDeploymentEvent: { create: mocks.gitHubDeploymentEventCreate },
    epic: { updateMany: mocks.epicUpdateMany },
  },
}));

import { handleGitHubWebhook } from "../../../app/actions/integrations/sync/github-pull";

const TENANT = "tenant-1";
const INT_ID = "int-1";

describe("handleGitHubWebhook — PR events (AC-001/AC-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storyFindMany.mockResolvedValue([]);
    mocks.storyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.gitHubSyncUpsert.mockResolvedValue({});
    mocks.stateTransitionCreate.mockResolvedValue({ id: "sth-1" });
    mocks.githubSyncEventCreate.mockResolvedValue({ id: "evt-1" });
    mocks.gitHubUnlinkedPRCreate.mockResolvedValue({ id: "ulpr-1" });
    mocks.gitHubDeploymentEventCreate.mockResolvedValue({ id: "dep-1" });
  });

  it("calls unlinked PR create for merged PR without cosmos link (AC-004)", async () => {
    await handleGitHubWebhook(TENANT, INT_ID, {
      action: "closed",
      pull_request: {
        number: 99,
        title: "Some unrelated fix",
        body: "No cosmos link here",
        html_url: "https://github.com/org/repo/pull/99",
        head: { ref: "feature/unrelated" },
        state: "closed",
        merged: true,
        merged_at: "2026-06-01T10:00:00Z",
      },
      repository: { full_name: "org/repo" },
    });

    expect(mocks.gitHubUnlinkedPRCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prNumber: 99,
          prStatus: "MERGED",
          tenantId: TENANT,
        }),
      })
    );
    expect(mocks.storyUpdateMany).not.toHaveBeenCalled();
  });

  it("does not create unlinked PR entry for open PR without link (AC-004)", async () => {
    await handleGitHubWebhook(TENANT, INT_ID, {
      action: "opened",
      pull_request: {
        number: 100,
        title: "WIP feature",
        body: null,
        html_url: "https://github.com/org/repo/pull/100",
        head: { ref: "feature/wip" },
        state: "open",
        merged: false,
        merged_at: null,
      },
      repository: { full_name: "org/repo" },
    });

    expect(mocks.gitHubUnlinkedPRCreate).not.toHaveBeenCalled();
  });

  it("records deployment event for deployment_status payload (AC-005)", async () => {
    await handleGitHubWebhook(TENANT, INT_ID, {
      action: "created",
      deployment_status: {
        id: 1,
        state: "pending",
        environment: "staging",
      },
      deployment: {
        id: 1,
        sha: "abc123",
        ref: "main",
        created_at: "2026-06-01T10:00:00Z",
        payload: {},
      },
      repository: { full_name: "org/repo" },
    });

    expect(mocks.gitHubDeploymentEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          environment: "staging",
          state: "pending",
          tenantId: TENANT,
        }),
      })
    );
  });
});
