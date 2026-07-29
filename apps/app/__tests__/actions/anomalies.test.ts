import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  costAnomalyFindMany: vi.fn(),
  costAnomalyUpdateMany: vi.fn(),
  costAnomalyFindFirst: vi.fn(),
  billingEntryFindFirst: vi.fn(),
  anomalyRuleConfigFindUnique: vi.fn(),
  anomalyRuleConfigUpsert: vi.fn(),
  logAudit: vi.fn(),
  detectCostAnomaliesForTenant: vi.fn(),
  generateCostAnomalyNarrative: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({
  revalidateTag: h.revalidateTag,
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    costAnomaly: {
      findMany: h.costAnomalyFindMany,
      updateMany: h.costAnomalyUpdateMany,
      findFirst: h.costAnomalyFindFirst,
    },
    billingEntry: { findFirst: h.billingEntryFindFirst },
    anomalyRuleConfig: {
      findUnique: h.anomalyRuleConfigFindUnique,
      upsert: h.anomalyRuleConfigUpsert,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));
vi.mock("@/lib/cost/detect-cost-anomalies", () => ({
  COST_ANOMALY_RULE_ID: "R-COST-01",
  detectCostAnomaliesForTenant: h.detectCostAnomaliesForTenant,
}));
vi.mock("@/lib/cost/anomaly-narrative", () => ({
  generateCostAnomalyNarrative: h.generateCostAnomalyNarrative,
}));

import {
  acknowledgeCostAnomaly,
  detectCostAnomaliesNow,
  generateCostAnomalyNarrativeAction,
  getAnomalySensitivity,
  listCostAnomalies,
  setAnomalySensitivity,
} from "../../app/(cosmos)/actions/anomalies";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listCostAnomalies", () => {
  it("reads CostAnomaly scoped to the caller's tenant", async () => {
    h.costAnomalyFindMany.mockResolvedValue([]);
    h.billingEntryFindFirst.mockResolvedValue(null);

    const res = await listCostAnomalies();
    expect(res.ok).toBe(true);
    expect(h.costAnomalyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("maps Decimal fields to numbers and reports hasBillingData honestly", async () => {
    h.costAnomalyFindMany.mockResolvedValue([
      {
        id: "ca-1",
        service: "EC2",
        accountId: "acc-1",
        period: new Date("2026-07-01T00:00:00.000Z"),
        detectedAt: new Date("2026-07-15T00:00:00.000Z"),
        baselineMedian: "997.5",
        baselineMAD: "7.5",
        actualAmount: "4000",
        modifiedZScore: "270.02",
        deltaAbs: "3002.5",
        deltaPct: "301.00",
        severity: "CRITICAL",
        status: "OPEN",
        acknowledgedBy: null,
        acknowledgedAt: null,
      },
    ]);
    h.billingEntryFindFirst.mockResolvedValue({ id: "be-1" });

    const res = await listCostAnomalies();
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.hasBillingData).toBe(true);
    expect(res.data.items[0].baselineMedian).toBe(997.5);
    expect(res.data.items[0].actualAmount).toBe(4000);
  });

  it("reports hasBillingData:false honestly when the tenant has no BillingEntry rows", async () => {
    h.costAnomalyFindMany.mockResolvedValue([]);
    h.billingEntryFindFirst.mockResolvedValue(null);

    const res = await listCostAnomalies();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.hasBillingData).toBe(false);
      expect(res.data.items).toEqual([]);
    }
  });
});

describe("getAnomalySensitivity", () => {
  it("returns the platform default when no AnomalyRuleConfig exists", async () => {
    h.anomalyRuleConfigFindUnique.mockResolvedValue(null);
    const res = await getAnomalySensitivity();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.threshold).toBe(3.5);
      expect(res.data.isDefault).toBe(true);
    }
  });

  it("returns the tenant's configured threshold when set", async () => {
    h.anomalyRuleConfigFindUnique.mockResolvedValue({ threshold: "2.5" });
    const res = await getAnomalySensitivity();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.threshold).toBe(2.5);
      expect(res.data.isDefault).toBe(false);
    }
  });
});

describe("setAnomalySensitivity — RBAC", () => {
  it("is denied when the role is not ADMIN/STE", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await setAnomalySensitivity({ threshold: 3 });
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.anomalyRuleConfigUpsert).not.toHaveBeenCalled();
  });

  it("rejects a threshold outside platform bounds", async () => {
    const res = await setAnomalySensitivity({ threshold: 99 });
    expect(res.ok).toBe(false);
    expect(h.anomalyRuleConfigUpsert).not.toHaveBeenCalled();
  });

  it("upserts, audits, and revalidates on success", async () => {
    h.anomalyRuleConfigUpsert.mockResolvedValue({ threshold: "4" });
    const res = await setAnomalySensitivity({ threshold: 4 });
    expect(res.ok).toBe(true);
    expect(h.anomalyRuleConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_artId_ruleId: {
            tenantId: tenantCtx.tenantId,
            artId: "",
            ruleId: "R-COST-01",
          },
        },
      })
    );
    expect(h.logAudit).toHaveBeenCalledTimes(1);
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});

describe("setAnomalySensitivity — persists under the tenant-wide sentinel so it round-trips", () => {
  // Faithful in-memory stand-in for the AnomalyRuleConfig unique row: a
  // Postgres upsert's `where` lookup matches against what was actually
  // *stored* by a prior `create` — not against the `where` clause itself.
  // If `create.artId` (null, pre-fix) ever diverges from `where.artId`
  // (the "" sentinel), every subsequent upsert believes no row exists and
  // inserts a fresh duplicate instead of updating.
  type Row = {
    tenantId: string;
    artId: string | null;
    ruleId: string;
    threshold: number;
  };

  function setupFakeAnomalyRuleConfigTable() {
    const rows: Row[] = [];

    h.anomalyRuleConfigUpsert.mockImplementation(
      async (args: {
        where: { tenantId_artId_ruleId: Omit<Row, "threshold"> };
        create: Row;
        update: { threshold: number };
      }) => {
        const key = args.where.tenantId_artId_ruleId;
        const existing = rows.find(
          (r) =>
            r.tenantId === key.tenantId &&
            r.artId === key.artId &&
            r.ruleId === key.ruleId
        );
        if (existing) {
          existing.threshold = args.update.threshold;
          return { threshold: String(existing.threshold) };
        }
        rows.push({ ...args.create });
        return { threshold: String(args.create.threshold) };
      }
    );

    h.anomalyRuleConfigFindUnique.mockImplementation(
      async (args: {
        where: { tenantId_artId_ruleId: Omit<Row, "threshold"> };
      }) => {
        const key = args.where.tenantId_artId_ruleId;
        const found = rows.find(
          (r) =>
            r.tenantId === key.tenantId &&
            r.artId === key.artId &&
            r.ruleId === key.ruleId
        );
        return found ? { threshold: String(found.threshold) } : null;
      }
    );

    return rows;
  }

  it("creates using the TENANT_WIDE_ART_SENTINEL artId, matching the where/read key", async () => {
    setupFakeAnomalyRuleConfigTable();
    await setAnomalySensitivity({ threshold: 4.0 });

    expect(h.anomalyRuleConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_artId_ruleId: {
            tenantId: tenantCtx.tenantId,
            artId: "",
            ruleId: "R-COST-01",
          },
        },
        create: expect.objectContaining({ artId: "" }),
      })
    );
  });

  it("round-trips a non-default threshold through set -> get (fails on the null-artId bug)", async () => {
    setupFakeAnomalyRuleConfigTable();

    await setAnomalySensitivity({ threshold: 4.0 });
    const res = await getAnomalySensitivity();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.threshold).toBe(4.0);
      expect(res.data.isDefault).toBe(false);
    }
  });

  it("a second set updates the same row instead of inserting a duplicate", async () => {
    const rows = setupFakeAnomalyRuleConfigTable();

    await setAnomalySensitivity({ threshold: 4.0 });
    await setAnomalySensitivity({ threshold: 4.5 });

    expect(rows).toHaveLength(1);
    expect(rows[0].threshold).toBe(4.5);
  });
});

describe("acknowledgeCostAnomaly — RBAC + tenant scoping (IDOR guard)", () => {
  it("is denied when the role is not ADMIN/STE/RTE", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await acknowledgeCostAnomaly({ id: "ca-1" });
    expect(res.ok).toBe(false);
    expect(h.costAnomalyUpdateMany).not.toHaveBeenCalled();
  });

  it("scopes the update to (id, tenantId) so a foreign anomaly id cannot be acknowledged", async () => {
    h.costAnomalyUpdateMany.mockResolvedValue({ count: 1 });
    const res = await acknowledgeCostAnomaly({ id: "ca-1" });
    expect(res.ok).toBe(true);
    expect(h.costAnomalyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ca-1", tenantId: tenantCtx.tenantId },
        data: expect.objectContaining({
          status: "ACKNOWLEDGED",
          acknowledgedBy: tenantCtx.userId,
        }),
      })
    );
  });

  it("fails when the anomaly does not belong to the caller's tenant (count=0)", async () => {
    h.costAnomalyUpdateMany.mockResolvedValue({ count: 0 });
    const res = await acknowledgeCostAnomaly({ id: "not-mine" });
    expect(res.ok).toBe(false);
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("audits and revalidates on success", async () => {
    h.costAnomalyUpdateMany.mockResolvedValue({ count: 1 });
    const res = await acknowledgeCostAnomaly({
      id: "ca-1",
      status: "RESOLVED",
    });
    expect(res.ok).toBe(true);
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        entityType: "CostAnomaly",
        entityId: "ca-1",
        diff: { status: "RESOLVED" },
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});

describe("detectCostAnomaliesNow — RBAC (ADMIN-only)", () => {
  it("is denied for a non-ADMIN role", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });
    const res = await detectCostAnomaliesNow();
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN"], tenantCtx);
    expect(h.detectCostAnomaliesForTenant).not.toHaveBeenCalled();
  });

  it("runs detection for the caller's tenant, audits, and revalidates", async () => {
    h.detectCostAnomaliesForTenant.mockResolvedValue({
      evaluated: 3,
      created: 1,
    });
    const res = await detectCostAnomaliesNow();
    expect(res.ok).toBe(true);
    expect(h.detectCostAnomaliesForTenant).toHaveBeenCalledWith(
      tenantCtx.tenantId
    );
    if (res.ok) {
      expect(res.data).toEqual({ evaluated: 3, created: 1 });
    }
    expect(h.logAudit).toHaveBeenCalledTimes(1);
    expect(h.revalidateTag).toHaveBeenCalled();
  });
});

describe("generateCostAnomalyNarrativeAction — tenant scoping", () => {
  it("404s (via error Result) when the anomaly does not belong to the caller's tenant", async () => {
    h.costAnomalyFindFirst.mockResolvedValue(null);
    const res = await generateCostAnomalyNarrativeAction({ id: "ca-1" });
    expect(res.ok).toBe(false);
    expect(h.generateCostAnomalyNarrative).not.toHaveBeenCalled();
  });

  it("looks up the anomaly scoped to (id, tenantId) and forwards its real metrics", async () => {
    h.costAnomalyFindFirst.mockResolvedValue({
      service: "EC2",
      accountId: "acc-1",
      actualAmount: "4000",
      baselineMedian: "997.5",
      deltaPct: "301",
      modifiedZScore: "270.02",
      severity: "CRITICAL",
    });
    h.generateCostAnomalyNarrative.mockResolvedValue({
      narrative: null,
      actions: [],
      degraded: true,
    });

    const res = await generateCostAnomalyNarrativeAction({ id: "ca-1" });
    expect(res.ok).toBe(true);
    expect(h.costAnomalyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ca-1", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.generateCostAnomalyNarrative).toHaveBeenCalledWith(
      expect.objectContaining({ service: "EC2", actualAmount: 4000 })
    );
    if (res.ok) {
      expect(res.data.degraded).toBe(true);
    }
  });
});
