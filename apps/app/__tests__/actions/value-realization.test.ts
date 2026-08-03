import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  logAudit: vi.fn(),
  epicValueMetricFindMany: vi.fn(),
  epicValueMetricCreate: vi.fn(),
  epicValueMetricUpdateMany: vi.fn(),
  epicFindMany: vi.fn(),
  epicFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    epicValueMetric: {
      findMany: h.epicValueMetricFindMany,
      create: h.epicValueMetricCreate,
      updateMany: h.epicValueMetricUpdateMany,
    },
    epic: {
      findMany: h.epicFindMany,
      findFirst: h.epicFindFirst,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createValueMetric,
  listValueRealizations,
  recordActualValue,
} from "../../app/(cosmos)/actions/value-realization";
import { TERMINAL_VALUE_STATUSES } from "../../app/(cosmos)/actions/value-realization.constants";

const validCreateInput = {
  epicId: "epic-1",
  metricLabel: "Redução de churn",
  plannedValue: 15,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.epicValueMetricFindMany.mockResolvedValue([]);
  h.epicFindFirst.mockResolvedValue({ id: "epic-1" });
  h.epicValueMetricCreate.mockResolvedValue({ id: "vm-1" });
  h.epicValueMetricUpdateMany.mockResolvedValue({ count: 1 });
});

describe("listValueRealizations", () => {
  it("is tenant-scoped and joins epic titles", async () => {
    h.epicValueMetricFindMany.mockResolvedValue([
      {
        id: "vm-1",
        epicId: "epic-1",
        metricLabel: "Redução de churn",
        unit: "%",
        plannedValue: 15,
        actualValue: 12,
        status: "tracking",
        measuredAt: new Date("2026-07-01"),
      },
    ]);
    h.epicFindMany.mockResolvedValue([{ id: "epic-1", title: "Épico Real" }]);

    const res = await listValueRealizations();
    expect(database.epicValueMetric.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: tenantCtx.tenantId } })
    );
    expect(database.epic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["epic-1"] }, tenantId: tenantCtx.tenantId },
      })
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data[0].epicTitle).toBe("Épico Real");
    }
  });

  it("skips the epic lookup when there are no rows", async () => {
    const res = await listValueRealizations();
    expect(database.epic.findMany).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual([]);
    }
  });
});

describe("createValueMetric", () => {
  it("rejects a caller without ADMIN/STE role", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "not allowed");
    });
    const res = await createValueMetric(validCreateInput);
    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(database.epicValueMetric.create).not.toHaveBeenCalled();
  });

  it("rejects an epicId that does not belong to the tenant (IDOR guard)", async () => {
    h.epicFindFirst.mockResolvedValue(null);
    const res = await createValueMetric(validCreateInput);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/Epic inválido/);
    }
    expect(database.epicValueMetric.create).not.toHaveBeenCalled();
  });

  it("creates the metric, audits, and revalidates on success", async () => {
    const res = await createValueMetric(validCreateInput);
    expect(res.ok).toBe(true);
    expect(database.epic.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "epic-1", tenantId: tenantCtx.tenantId },
      })
    );
    expect(database.epicValueMetric.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          epicId: "epic-1",
          metricLabel: "Redução de churn",
          plannedValue: 15,
          status: "pending",
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({ entityType: "EpicValueMetric" })
    );
    expect(h.revalidateTag).toHaveBeenCalledWith(
      `value-realization:${tenantCtx.tenantId}`,
      "max"
    );
  });
});

describe("recordActualValue", () => {
  it("rejects a caller without ADMIN/STE role", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "not allowed");
    });
    const res = await recordActualValue({
      id: "vm-1",
      actualValue: 12,
      status: "tracking",
    });
    expect(res.ok).toBe(false);
    expect(database.epicValueMetric.updateMany).not.toHaveBeenCalled();
  });

  it("is tenant-scoped and fails when no row matches", async () => {
    h.epicValueMetricUpdateMany.mockResolvedValue({ count: 0 });
    const res = await recordActualValue({
      id: "vm-other-tenant",
      actualValue: 12,
      status: "tracking",
    });
    expect(database.epicValueMetric.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vm-other-tenant", tenantId: tenantCtx.tenantId },
      })
    );
    expect(res.ok).toBe(false);
  });

  it("updates the actual value and status on success", async () => {
    const res = await recordActualValue({
      id: "vm-1",
      actualValue: 12,
      status: "done",
      rationale: "Churn caiu 12pp; hipótese confirmada.",
    });
    expect(res.ok).toBe(true);
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        entityType: "EpicValueMetric",
        action: "updated",
      })
    );
  });

  // ── AC-001/AC-002 — decidir sobre a hipótese exige motivo ───────────────
  describe("justificativa da decisão sobre a hipótese", () => {
    for (const status of TERMINAL_VALUE_STATUSES) {
      it(`recusa status "${status}" sem justificativa, sem gravar nem auditar`, async () => {
        const res = await recordActualValue({
          id: "vm-1",
          actualValue: 12,
          status,
        });

        expect(res.ok).toBe(false);
        expect(database.epicValueMetric.updateMany).not.toHaveBeenCalled();
        expect(h.logAudit).not.toHaveBeenCalled();
      });

      it(`recusa status "${status}" com justificativa só de espaços`, async () => {
        const res = await recordActualValue({
          id: "vm-1",
          actualValue: 12,
          status,
          rationale: "   ",
        });

        expect(res.ok).toBe(false);
        expect(database.epicValueMetric.updateMany).not.toHaveBeenCalled();
      });
    }

    it("aceita status não-terminal sem justificativa — continuar medindo não é decisão", async () => {
      const res = await recordActualValue({
        id: "vm-1",
        actualValue: 12,
        status: "tracking",
      });

      expect(res.ok).toBe(true);
      expect(database.epicValueMetric.updateMany).toHaveBeenCalled();
    });

    it("leva a justificativa para o diff de auditoria", async () => {
      await recordActualValue({
        id: "vm-1",
        actualValue: 4,
        status: "at-risk",
        rationale: "Só 4pp de 15; hipótese não se sustenta, pivotar o épico.",
      });

      expect(h.logAudit).toHaveBeenCalledWith(
        tenantCtx.tenantId,
        expect.objectContaining({
          entityType: "EpicValueMetric",
          action: "updated",
          diff: expect.objectContaining({
            rationale:
              "Só 4pp de 15; hipótese não se sustenta, pivotar o épico.",
          }),
        })
      );
    });
  });
});
