import { beforeEach, describe, expect, it, vi } from "vitest";

const RTE_CTX = { tenantId: "t1", userId: "u1", role: "RTE" as const };

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(code: string, msg?: string) {
      super(msg ?? code);
      this.name = "AuthError";
    }
  },
  scheduledReportCreate: vi.fn(),
  scheduledReportFindFirst: vi.fn(),
  scheduledReportFindMany: vi.fn(),
  scheduledReportCount: vi.fn(),
  scheduledReportUpdate: vi.fn(),
  scheduledReportDelete: vi.fn(),
  scheduledReportExecutionFindMany: vi.fn(),
  scheduledReportExecutionCount: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  AuthError: mocks.AuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    scheduledReport: {
      create: mocks.scheduledReportCreate,
      findFirst: mocks.scheduledReportFindFirst,
      findMany: mocks.scheduledReportFindMany,
      count: mocks.scheduledReportCount,
      update: mocks.scheduledReportUpdate,
      delete: mocks.scheduledReportDelete,
    },
    scheduledReportExecution: {
      findMany: mocks.scheduledReportExecutionFindMany,
      count: mocks.scheduledReportExecutionCount,
    },
  },
}));

import {
  createScheduledReport,
  deleteScheduledReport,
  listReportExecutions,
  listScheduledReports,
  updateScheduledReport,
} from "../../../app/actions/reporting/scheduled-reports";

const VALID_REPORT = {
  name: "Weekly PI Report",
  cronExpression: "0 9 * * 1",
  timezone: "America/Sao_Paulo",
  recipients: ["rte@acme.com"],
  config: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(RTE_CTX);
});

describe("createScheduledReport", () => {
  it("creates report with valid input", async () => {
    mocks.scheduledReportCreate.mockResolvedValue({ id: "r1" });

    const result = await createScheduledReport(VALID_REPORT);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ id: "r1" });
    expect(mocks.scheduledReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          name: "Weekly PI Report",
          cronExpression: "0 9 * * 1",
        }),
      })
    );
  });

  it("rejects invalid cron expression", async () => {
    const result = await createScheduledReport({
      ...VALID_REPORT,
      cronExpression: "not-a-cron",
    });

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportCreate).not.toHaveBeenCalled();
  });

  it("rejects cron expression with out-of-range field", async () => {
    // O regex antigo aceitava isto: "99" tem a forma de um campo numérico,
    // mas minuto só vai até 59.
    const result = await createScheduledReport({
      ...VALID_REPORT,
      cronExpression: "99 * * * *",
    });

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportCreate).not.toHaveBeenCalled();
  });

  it("rejects timezone that isn't a valid IANA name", async () => {
    // O schema antigo só checava comprimento (1-64 chars) — "Sao Paulo"
    // passava sem nunca resolver a um timezone real.
    const result = await createScheduledReport({
      ...VALID_REPORT,
      timezone: "Sao Paulo",
    });

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportCreate).not.toHaveBeenCalled();
  });

  it("accepts a valid cron + timezone combination", async () => {
    mocks.scheduledReportCreate.mockResolvedValue({ id: "r1" });

    const result = await createScheduledReport({
      ...VALID_REPORT,
      cronExpression: "0 9 * * 1",
      timezone: "America/Sao_Paulo",
    });

    expect(result.ok).toBe(true);
    expect(mocks.scheduledReportCreate).toHaveBeenCalled();
  });

  it("rejects empty recipients", async () => {
    const result = await createScheduledReport({
      ...VALID_REPORT,
      recipients: [],
    });

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid email in recipients", async () => {
    const result = await createScheduledReport({
      ...VALID_REPORT,
      recipients: ["not-an-email"],
    });

    expect(result.ok).toBe(false);
  });

  it("enforces RBAC — PO cannot create", async () => {
    mocks.requireTenantSession.mockResolvedValue({ ...RTE_CTX, role: "PO" });

    const result = await createScheduledReport(VALID_REPORT);

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportCreate).not.toHaveBeenCalled();
  });

  it("never uses tenantId from body", async () => {
    mocks.scheduledReportCreate.mockResolvedValue({ id: "r1" });

    await createScheduledReport({ ...VALID_REPORT, tenantId: "evil-tenant" });

    expect(mocks.scheduledReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "t1" }),
      })
    );
  });

  it("COS-93: carimba lastRunAt na criação para não disparar fora do cron", async () => {
    mocks.scheduledReportCreate.mockResolvedValue({ id: "r1" });

    await createScheduledReport(VALID_REPORT);

    expect(mocks.scheduledReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastRunAt: expect.any(Date) }),
      })
    );
  });
});

describe("updateScheduledReport", () => {
  it("updates report when tenant owns it", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({ id: "r1" });
    mocks.scheduledReportUpdate.mockResolvedValue({ id: "r1" });

    const result = await updateScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx", {
      name: "Updated",
      enabled: false,
    });

    expect(result.ok).toBe(true);
  });

  it("returns error when report not in tenant", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue(null);

    const result = await updateScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx", {
      name: "Updated",
    });

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportUpdate).not.toHaveBeenCalled();
  });

  it("rejects out-of-range cron expression on update", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({ id: "r1" });

    const result = await updateScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx", {
      cronExpression: "99 * * * *",
    });

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportUpdate).not.toHaveBeenCalled();
  });

  it("rejects invalid timezone on update", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({ id: "r1" });

    const result = await updateScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx", {
      timezone: "Sao Paulo",
    });

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportUpdate).not.toHaveBeenCalled();
  });

  it("allows partial update that doesn't touch cron or timezone", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({ id: "r1" });
    mocks.scheduledReportUpdate.mockResolvedValue({ id: "r1" });

    const result = await updateScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx", {
      name: "Updated",
    });

    expect(result.ok).toBe(true);
  });

  it("COS-93: recarimba lastRunAt ao reativar um relatório desabilitado", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({
      id: "r1",
      enabled: false,
    });
    mocks.scheduledReportUpdate.mockResolvedValue({ id: "r1" });

    await updateScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx", {
      enabled: true,
    });

    expect(mocks.scheduledReportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enabled: true,
          lastRunAt: expect.any(Date),
        }),
      })
    );
  });

  it("COS-93: não mexe em lastRunAt quando já estava habilitado", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({
      id: "r1",
      enabled: true,
    });
    mocks.scheduledReportUpdate.mockResolvedValue({ id: "r1" });

    await updateScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx", {
      enabled: true,
    });

    expect(mocks.scheduledReportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ lastRunAt: expect.anything() }),
      })
    );
  });

  it("COS-93: não mexe em lastRunAt ao desabilitar", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({
      id: "r1",
      enabled: true,
    });
    mocks.scheduledReportUpdate.mockResolvedValue({ id: "r1" });

    await updateScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx", {
      enabled: false,
    });

    expect(mocks.scheduledReportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ lastRunAt: expect.anything() }),
      })
    );
  });
});

describe("deleteScheduledReport", () => {
  it("deletes report owned by tenant", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({ id: "r1" });
    mocks.scheduledReportDelete.mockResolvedValue({ id: "r1" });

    const result = await deleteScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx");

    expect(result.ok).toBe(true);
    expect(mocks.scheduledReportDelete).toHaveBeenCalled();
  });

  it("rejects delete if report belongs to other tenant", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue(null);

    const result = await deleteScheduledReport("clxxxxxxxxxxxxxxxxxxxxxxxx");

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportDelete).not.toHaveBeenCalled();
  });
});

describe("listScheduledReports", () => {
  it("returns paginated list for tenant", async () => {
    const items = [{ id: "r1", name: "R", executions: [] }];
    mocks.scheduledReportFindMany.mockResolvedValue(items);
    mocks.scheduledReportCount.mockResolvedValue(1);

    const result = await listScheduledReports({ page: 1, limit: 20 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual(items);
      expect(result.data.meta.total).toBe(1);
    }
    expect(mocks.scheduledReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t1" } })
    );
  });
});

describe("listReportExecutions", () => {
  it("returns executions for owned report", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue({ id: "r1" });
    mocks.scheduledReportExecutionFindMany.mockResolvedValue([]);
    mocks.scheduledReportExecutionCount.mockResolvedValue(0);

    const result = await listReportExecutions("clxxxxxxxxxxxxxxxxxxxxxxxx", {});

    expect(result.ok).toBe(true);
  });

  it("fails for report not in tenant", async () => {
    mocks.scheduledReportFindFirst.mockResolvedValue(null);

    const result = await listReportExecutions("clxxxxxxxxxxxxxxxxxxxxxxxx", {});

    expect(result.ok).toBe(false);
    expect(mocks.scheduledReportExecutionFindMany).not.toHaveBeenCalled();
  });
});
