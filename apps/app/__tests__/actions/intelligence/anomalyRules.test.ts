import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  anomalyRuleConfigUpsert: vi.fn(),
  anomalyRuleConfigDeleteMany: vi.fn(),
  anomalyFindFirst: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    anomalyRuleConfig: {
      upsert: mocks.anomalyRuleConfigUpsert,
      deleteMany: mocks.anomalyRuleConfigDeleteMany,
    },
    anomaly: { findFirst: mocks.anomalyFindFirst },
    auditLog: { create: mocks.auditLogCreate },
  },
}));

import {
  disableRule,
  resetRuleThreshold,
  setRuleThreshold,
} from "../../../app/actions/intelligence/anomalyRules";
import { findExistingOpenAnomaly } from "../../../app/actions/intelligence/find-existing-open-anomaly";

// ─── Rule catalogue (pure) ────────────────────────────────────────────────────

describe("Rule catalogue", () => {
  it("has at least 11 rule entries", async () => {
    const { ANOMALY_RULES } = await import("../../../lib/anomaly/rules");
    expect(Object.keys(ANOMALY_RULES).length).toBeGreaterThanOrEqual(11);
  });

  it("CRITICAL rules have null bounds (non-configurable) (AC-006)", async () => {
    const { ANOMALY_RULES } = await import("../../../lib/anomaly/rules");
    for (const [id, rule] of Object.entries(ANOMALY_RULES)) {
      if (rule.critical) {
        expect(rule.bounds).toBeNull(), `Rule ${id} is CRITICAL but has bounds`;
      }
    }
  });
});

// ─── setRuleThreshold ─────────────────────────────────────────────────────────

describe("setRuleThreshold (AC-005/AC-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.anomalyRuleConfigUpsert.mockResolvedValue({ id: "cfg-1" });
  });

  it("saves valid threshold within bounds (AC-005)", async () => {
    const result = await setRuleThreshold({
      ruleId: "R-VEL-01",
      threshold: 0.3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe("cfg-1");
    expect(mocks.anomalyRuleConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ threshold: 0.3 }),
      })
    );
  });

  it("rejects threshold below minimum bound (AC-005)", async () => {
    const result = await setRuleThreshold({
      ruleId: "R-VEL-01",
      threshold: 0.05, // below min 0.10
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("THRESHOLD_OUT_OF_BOUNDS");
    expect(mocks.anomalyRuleConfigUpsert).not.toHaveBeenCalled();
  });

  it("blocks threshold change on CRITICAL rules (AC-006)", async () => {
    const result = await setRuleThreshold({
      ruleId: "R-IMP-02", // CRITICAL
      threshold: 12,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("CRITICAL_RULE_NON_DISABLABLE");
  });
});

// ─── disableRule ──────────────────────────────────────────────────────────────

describe("disableRule (AC-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "ADMIN",
    });
    mocks.anomalyRuleConfigUpsert.mockResolvedValue({ id: "cfg-2" });
    mocks.auditLogCreate.mockResolvedValue({});
  });

  it("disables non-critical rule (AC-006)", async () => {
    const result = await disableRule({ ruleId: "R-WIP-01" });

    expect(result.ok).toBe(true);
    expect(mocks.anomalyRuleConfigUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { isDisabled: true },
      })
    );
    expect(mocks.auditLogCreate).toHaveBeenCalled();
  });

  it("blocks disabling CRITICAL rule (AC-006)", async () => {
    const result = await disableRule({ ruleId: "R-DEP-01" }); // CRITICAL

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("CRITICAL_RULE_NON_DISABLABLE");
    expect(mocks.anomalyRuleConfigUpsert).not.toHaveBeenCalled();
  });
});

// ─── resetRuleThreshold ───────────────────────────────────────────────────────

describe("resetRuleThreshold (AC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.auditLogCreate.mockResolvedValue({});
  });

  it("deletes override and creates audit log (AC-008)", async () => {
    mocks.anomalyRuleConfigDeleteMany.mockResolvedValue({ count: 1 });

    const result = await resetRuleThreshold({ ruleId: "R-WIP-01" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deleted).toBe(true);
    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ANOMALY_RULE_RESET" }),
      })
    );
  });

  it("returns deleted=false when no override exists (AC-008)", async () => {
    mocks.anomalyRuleConfigDeleteMany.mockResolvedValue({ count: 0 });

    const result = await resetRuleThreshold({ ruleId: "R-WIP-01" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.deleted).toBe(false);
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });
});

// ─── findExistingOpenAnomaly (dedup) ──────────────────────────────────────────

describe("findExistingOpenAnomaly (AC-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing open anomaly within 24h window (AC-002)", async () => {
    mocks.anomalyFindFirst.mockResolvedValue({ id: "anomaly-1" });

    const result = await findExistingOpenAnomaly({
      tenantId: "tenant-test",
      rule: "VELOCITY_DROP",
      entityId: "team-alpha",
    });

    expect(result).toEqual({ id: "anomaly-1" });
    expect(mocks.anomalyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rule: "VELOCITY_DROP",
          entityId: "team-alpha",
          status: { notIn: ["RESOLVED", "SUPPRESSED"] },
        }),
      })
    );
  });

  it("returns null when no duplicate within window (AC-002)", async () => {
    mocks.anomalyFindFirst.mockResolvedValue(null);

    const result = await findExistingOpenAnomaly({
      tenantId: "tenant-test",
      rule: "VELOCITY_DROP",
      entityId: "team-beta",
    });

    expect(result).toBeNull();
  });
});
