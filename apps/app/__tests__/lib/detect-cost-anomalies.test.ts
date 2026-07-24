import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  billingEntryFindMany: vi.fn(),
  anomalyRuleConfigFindUnique: vi.fn(),
  costAnomalyFindFirst: vi.fn(),
  costAnomalyCreate: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    billingEntry: { findMany: mocks.billingEntryFindMany },
    anomalyRuleConfig: { findUnique: mocks.anomalyRuleConfigFindUnique },
    costAnomaly: {
      findFirst: mocks.costAnomalyFindFirst,
      create: mocks.costAnomalyCreate,
    },
  },
}));

import {
  COST_ANOMALY_RULE_ID,
  detectCostAnomaliesForTenant,
} from "../../lib/cost/detect-cost-anomalies";

const NOW = new Date("2026-07-15T00:00:00.000Z");
const TENANT_ID = "tenant-a";

function entry(opts: {
  service: string;
  accountId: string;
  integrationId?: string;
  month: string; // "YYYY-MM"
  amount: number;
}) {
  return {
    service: opts.service,
    accountId: opts.accountId,
    integrationId: opts.integrationId ?? "integ-1",
    usageStartDate: new Date(`${opts.month}-10T00:00:00.000Z`),
    tenantAmount: opts.amount,
  };
}

// A clean 6-month history (median 997.5, MAD 7.5) + a clear July spike —
// same series as the pure-algorithm unit test, so the expected math is
// already verified there.
function spikingGroupEntries(service: string, accountId: string) {
  return [
    entry({ service, accountId, month: "2026-01", amount: 980 }),
    entry({ service, accountId, month: "2026-02", amount: 1010 }),
    entry({ service, accountId, month: "2026-03", amount: 990 }),
    entry({ service, accountId, month: "2026-04", amount: 1000 }),
    entry({ service, accountId, month: "2026-05", amount: 1005 }),
    entry({ service, accountId, month: "2026-06", amount: 995 }),
    entry({ service, accountId, month: "2026-07", amount: 4000 }),
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.anomalyRuleConfigFindUnique.mockResolvedValue(null);
  mocks.costAnomalyFindFirst.mockResolvedValue(null);
  mocks.costAnomalyCreate.mockResolvedValue({ id: "ca-new" });
});

describe("detectCostAnomaliesForTenant — tenant scoping", () => {
  it("reads BillingEntry and AnomalyRuleConfig scoped to the given tenant", async () => {
    mocks.billingEntryFindMany.mockResolvedValue([]);
    await detectCostAnomaliesForTenant(TENANT_ID, NOW);

    expect(mocks.billingEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      })
    );
    expect(mocks.anomalyRuleConfigFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_artId_ruleId: {
            tenantId: TENANT_ID,
            artId: "",
            ruleId: COST_ANOMALY_RULE_ID,
          },
        },
      })
    );
  });

  it("writes CostAnomaly rows scoped to the given tenant", async () => {
    mocks.billingEntryFindMany.mockResolvedValue(
      spikingGroupEntries("EC2", "acc-1")
    );
    await detectCostAnomaliesForTenant(TENANT_ID, NOW);

    expect(mocks.costAnomalyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      })
    );
    expect(mocks.costAnomalyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_ID }),
      })
    );
  });

  it("does not read or write another tenant's data (no cross-tenant param)", async () => {
    mocks.billingEntryFindMany.mockResolvedValue([]);
    await detectCostAnomaliesForTenant(TENANT_ID, NOW);
    for (const call of mocks.billingEntryFindMany.mock.calls) {
      expect(call[0].where.tenantId).toBe(TENANT_ID);
    }
  });
});

describe("detectCostAnomaliesForTenant — detection", () => {
  it("creates a CostAnomaly for a group whose current month breaches the threshold", async () => {
    mocks.billingEntryFindMany.mockResolvedValue(
      spikingGroupEntries("EC2", "acc-1")
    );
    const result = await detectCostAnomaliesForTenant(TENANT_ID, NOW);

    expect(result.evaluated).toBe(1);
    expect(result.created).toBe(1);
    expect(mocks.costAnomalyCreate).toHaveBeenCalledTimes(1);
    const created = mocks.costAnomalyCreate.mock.calls[0][0].data;
    expect(created.service).toBe("EC2");
    expect(created.accountId).toBe("acc-1");
    expect(created.status).toBe("OPEN");
    expect(created.baselineMedian).toBeCloseTo(997.5, 5);
    expect(created.severity).toBe("CRITICAL");
    expect(created.period).toEqual(new Date("2026-07-01T00:00:00.000Z"));
  });

  it("does not flag a group whose current month is within the historical baseline", async () => {
    const entries = spikingGroupEntries("EC2", "acc-1").map((e) =>
      e.usageStartDate.getUTCMonth() === 6 ? { ...e, tenantAmount: 1002 } : e
    );
    mocks.billingEntryFindMany.mockResolvedValue(entries);

    const result = await detectCostAnomaliesForTenant(TENANT_ID, NOW);
    expect(result.evaluated).toBe(1);
    expect(result.created).toBe(0);
    expect(mocks.costAnomalyCreate).not.toHaveBeenCalled();
  });

  it("evaluates but never fabricates a baseline for a group with insufficient history", async () => {
    // Only 2 months of history (below MIN_HISTORY_POINTS) + a huge current spike.
    mocks.billingEntryFindMany.mockResolvedValue([
      entry({
        service: "S3",
        accountId: "acc-2",
        month: "2026-05",
        amount: 100,
      }),
      entry({
        service: "S3",
        accountId: "acc-2",
        month: "2026-06",
        amount: 100,
      }),
      entry({
        service: "S3",
        accountId: "acc-2",
        month: "2026-07",
        amount: 9999,
      }),
    ]);

    const result = await detectCostAnomaliesForTenant(TENANT_ID, NOW);
    expect(result.evaluated).toBe(1);
    expect(result.created).toBe(0);
    expect(mocks.costAnomalyCreate).not.toHaveBeenCalled();
  });

  it("honestly reports zero evaluated/created when there is no billing data", async () => {
    mocks.billingEntryFindMany.mockResolvedValue([]);
    const result = await detectCostAnomaliesForTenant(TENANT_ID, NOW);
    expect(result).toEqual({ evaluated: 0, created: 0 });
    expect(mocks.costAnomalyCreate).not.toHaveBeenCalled();
  });

  it("uses the tenant's configured sensitivity threshold from AnomalyRuleConfig", async () => {
    // median=100, MAD=1 (see pure-algorithm test); current=105 -> z=3.3725,
    // below the 3.5 default but above a configured threshold of 2.
    mocks.anomalyRuleConfigFindUnique.mockResolvedValue({
      threshold: 2,
      isDisabled: false,
    });
    mocks.billingEntryFindMany.mockResolvedValue([
      entry({
        service: "RDS",
        accountId: "acc-3",
        month: "2026-01",
        amount: 100,
      }),
      entry({
        service: "RDS",
        accountId: "acc-3",
        month: "2026-02",
        amount: 100,
      }),
      entry({
        service: "RDS",
        accountId: "acc-3",
        month: "2026-03",
        amount: 102,
      }),
      entry({
        service: "RDS",
        accountId: "acc-3",
        month: "2026-04",
        amount: 98,
      }),
      entry({
        service: "RDS",
        accountId: "acc-3",
        month: "2026-05",
        amount: 101,
      }),
      entry({
        service: "RDS",
        accountId: "acc-3",
        month: "2026-06",
        amount: 99,
      }),
      entry({
        service: "RDS",
        accountId: "acc-3",
        month: "2026-07",
        amount: 105,
      }),
    ]);

    const result = await detectCostAnomaliesForTenant(TENANT_ID, NOW);
    expect(result.created).toBe(1);
  });

  it("skips detection entirely when the tenant has disabled the cost rule", async () => {
    mocks.anomalyRuleConfigFindUnique.mockResolvedValue({
      threshold: 1,
      isDisabled: true,
    });
    mocks.billingEntryFindMany.mockResolvedValue(
      spikingGroupEntries("EC2", "acc-1")
    );

    const result = await detectCostAnomaliesForTenant(TENANT_ID, NOW);
    expect(result).toEqual({ evaluated: 0, created: 0 });
    expect(mocks.billingEntryFindMany).not.toHaveBeenCalled();
    expect(mocks.costAnomalyCreate).not.toHaveBeenCalled();
  });
});

describe("detectCostAnomaliesForTenant — idempotent re-run", () => {
  it("does not double-insert when a CostAnomaly already exists for (tenant, service, accountId, period)", async () => {
    mocks.billingEntryFindMany.mockResolvedValue(
      spikingGroupEntries("EC2", "acc-1")
    );
    mocks.costAnomalyFindFirst.mockResolvedValue({ id: "existing-anomaly" });

    const result = await detectCostAnomaliesForTenant(TENANT_ID, NOW);

    expect(result.created).toBe(0);
    expect(mocks.costAnomalyCreate).not.toHaveBeenCalled();
    expect(mocks.costAnomalyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          service: "EC2",
          accountId: "acc-1",
          period: new Date("2026-07-01T00:00:00.000Z"),
        }),
      })
    );
  });
});
