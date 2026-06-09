import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

// ─── Pure utility tests ────────────────────────────────────────────────────────

import {
  backoffDelayMs,
  computeTagHash,
  generateDateWindows,
  matchTagRules,
  type TagRuleRecord,
} from "../../../lib/billing/tag-rules";

describe("matchTagRules (AC-007)", () => {
  const rules: TagRuleRecord[] = [
    {
      id: "rule-1",
      tagKey: "Epic",
      tagValue: "epic-payments-",
      matchType: "PREFIX",
      conditions: null,
      epicId: "epic-42",
      themeId: null,
      artId: null,
      priority: 10,
      enabled: true,
    },
    {
      id: "rule-2",
      tagKey: "Team",
      tagValue: "platform",
      matchType: "EXACT",
      conditions: null,
      epicId: null,
      themeId: "theme-1",
      artId: null,
      priority: 20,
      enabled: true,
    },
    {
      id: "rule-3",
      tagKey: "Epic",
      tagValue: "epic-payments-q3",
      matchType: "EXACT",
      conditions: null,
      epicId: "epic-99",
      themeId: null,
      artId: null,
      priority: 5, // higher priority (lower number)
      enabled: true,
    },
  ];

  it("matches PREFIX rule (AC-007)", () => {
    const result = matchTagRules({ Epic: "epic-payments-q3" }, [rules[0]]);
    expect(result?.ruleId).toBe("rule-1");
    expect(result?.epicId).toBe("epic-42");
  });

  it("first-match-wins by ascending priority (AC-007)", () => {
    // rule-3 has priority=5 (lower = higher priority) — should match before rule-1 (priority=10)
    const result = matchTagRules({ Epic: "epic-payments-q3" }, rules);
    expect(result?.ruleId).toBe("rule-3");
    expect(result?.epicId).toBe("epic-99");
  });

  it("returns null when no rules match (AC-007)", () => {
    const result = matchTagRules({ Environment: "prod" }, rules);
    expect(result).toBeNull();
  });

  it("skips disabled rules (AC-007)", () => {
    const disabledRule = { ...rules[0], enabled: false };
    const result = matchTagRules({ Epic: "epic-payments-q3" }, [disabledRule]);
    expect(result).toBeNull();
  });
});

describe("computeTagHash", () => {
  it("produces consistent hash for same tags (AC-002)", () => {
    const h1 = computeTagHash({ Epic: "payments", Team: "platform" });
    const h2 = computeTagHash({ Team: "platform", Epic: "payments" });
    expect(h1).toBe(h2); // order-independent
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  it("produces different hashes for different tags (AC-002)", () => {
    const h1 = computeTagHash({ Epic: "payments" });
    const h2 = computeTagHash({ Epic: "identity" });
    expect(h1).not.toBe(h2);
  });
});

describe("generateDateWindows (AC-004)", () => {
  it("generates correct windows for backfill (AC-004)", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-07-01"); // 181 days → 7 windows of 30 days
    const windows = generateDateWindows(start, end, 30);
    // Each window covers 30 days except possibly the last
    expect(windows.length).toBeGreaterThanOrEqual(6);
    expect(windows[0].start).toEqual(start);
    expect(windows.at(-1).end).toEqual(end);
  });

  it("last window ends at endDate not beyond it (AC-004)", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-02-10"); // 40 days, not divisible by 30
    const windows = generateDateWindows(start, end, 30);
    expect(windows).toHaveLength(2);
    expect(windows[1].end).toEqual(end);
  });
});

describe("backoffDelayMs (AC-003)", () => {
  it("uses 2x exponential backoff starting at 2s (AC-003)", () => {
    expect(backoffDelayMs(1)).toBe(2000);
    expect(backoffDelayMs(2)).toBe(4000);
    expect(backoffDelayMs(3)).toBe(8000);
    expect(backoffDelayMs(4)).toBe(16_000);
    expect(backoffDelayMs(5)).toBe(32_000);
  });
});

// ─── triggerBillingSync (server action) ───────────────────────────────────────

const actionMocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  integrationFindFirstOrThrow: vi.fn(),
  billingSyncRunCreate: vi.fn(),
  billingSyncRunFindFirstOrThrow: vi.fn(),
  inngestSend: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: actionMocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: actionMocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    integration: { findFirstOrThrow: actionMocks.integrationFindFirstOrThrow },
    billingSyncRun: {
      create: actionMocks.billingSyncRunCreate,
      findFirstOrThrow: actionMocks.billingSyncRunFindFirstOrThrow,
    },
  },
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: actionMocks.inngestSend },
}));

import { triggerBillingSync } from "../../../app/actions/finops/billingSyncTrigger";

describe("triggerBillingSync (AC-001/AC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.headers.mockResolvedValue(new Headers());
    actionMocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "RTE",
    });
    actionMocks.integrationFindFirstOrThrow.mockResolvedValue({
      id: "int-1",
      provider: "AWS",
    });
    actionMocks.billingSyncRunCreate.mockResolvedValue({ id: "run-1" });
    actionMocks.inngestSend.mockResolvedValue({ ids: ["job-1"] });
  });

  it("creates BillingSyncRun and enqueues Inngest job (AC-001)", async () => {
    const result = await triggerBillingSync({
      integrationId: "int-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.syncRunId).toBe("run-1");
    expect(result.data.jobId).toBe("job-1");
    expect(actionMocks.inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "billing/sync.requested",
        data: expect.objectContaining({ integrationId: "int-1" }),
      })
    );
  });

  it("sends isBackfill=true for 6-month backfill trigger (AC-004)", async () => {
    await triggerBillingSync({
      integrationId: "int-1",
      isBackfill: true,
    });

    expect(actionMocks.inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isBackfill: true }),
      })
    );
  });
});
