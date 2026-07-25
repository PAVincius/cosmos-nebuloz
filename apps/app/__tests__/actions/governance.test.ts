import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  governedEpicFindMany: vi.fn(),
  governedEpicFindFirst: vi.fn(),
  approvalWorkflowFindFirst: vi.fn(),
  approvalWorkflowUpsert: vi.fn(),
  logAudit: vi.fn(),
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
    governedEpic: {
      findMany: h.governedEpicFindMany,
      findFirst: h.governedEpicFindFirst,
    },
    approvalWorkflow: {
      findFirst: h.approvalWorkflowFindFirst,
      upsert: h.approvalWorkflowUpsert,
    },
  },
}));
vi.mock("../../app/actions/audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  getGovernedEpicDetail,
  listGovernedEpics,
  upsertApprovalWorkflow,
} from "../../app/(cosmos)/actions/governance";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listGovernedEpics", () => {
  it("returns tenant-scoped governed epics with resolved epic title", async () => {
    h.governedEpicFindMany.mockResolvedValue([
      {
        id: "g1",
        governanceStatus: "review",
        investmentEstimate: 250_000,
        submittedAt: new Date("2026-02-01"),
        currentApprovalRequestId: "req-1",
        epic: { title: "Migração multi-tenant" },
      },
    ]);

    const r = await listGovernedEpics();
    expect(r.ok).toBe(true);
    expect(database.governedEpic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].epicTitle).toBe("Migração multi-tenant");
      expect(typeof r.data[0].submittedAt).toBe("string");
      expect(r.data[0].currentApprovalRequestId).toBe("req-1");
    }
  });
});

describe("getGovernedEpicDetail", () => {
  it("returns the tenant-scoped governed epic detail with resolved epic fields", async () => {
    h.governedEpicFindFirst.mockResolvedValue({
      id: "g1",
      epicId: "epic-1",
      governanceStatus: "review",
      investmentEstimate: 2_500_000,
      valueStreamId: "vs-1",
      themeId: "theme-1",
      guardrailFlags: ["needs-board-review"],
      currentApprovalRequestId: "req-1",
      submittedAt: new Date("2026-02-01"),
      epic: { title: "Migração multi-tenant", lifecycleStatus: "IMPLEMENTING" },
    });

    const r = await getGovernedEpicDetail("epic-1");

    expect(r.ok).toBe(true);
    expect(database.governedEpic.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { epicId: "epic-1", tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok && r.data) {
      expect(r.data.epicTitle).toBe("Migração multi-tenant");
      expect(r.data.epicLifecycleStatus).toBe("IMPLEMENTING");
      expect(r.data.guardrailFlags).toEqual(["needs-board-review"]);
      expect(typeof r.data.submittedAt).toBe("string");
    }
  });

  it("returns null when no GovernedEpic exists for this epic in this tenant", async () => {
    h.governedEpicFindFirst.mockResolvedValue(null);

    const r = await getGovernedEpicDetail("epic-1");

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toBeNull();
    }
  });

  it("never leaks another tenant's governed epic — where clause always uses ctx.tenantId", async () => {
    h.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      tenantId: "other-tenant",
    });
    h.governedEpicFindFirst.mockResolvedValue(null);

    await getGovernedEpicDetail("epic-1");

    expect(database.governedEpic.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { epicId: "epic-1", tenantId: "other-tenant" },
      })
    );
  });
});

describe("upsertApprovalWorkflow", () => {
  const validInput = {
    tipo: "epic_investment" as const,
    nome: "Aprovação de Épico de Portfólio",
    etapas: [{ order: 0, roleRequired: "STE" as const, slaDays: 3 }],
    ativo: true,
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await upsertApprovalWorkflow(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "STE"], tenantCtx);
    expect(h.approvalWorkflowUpsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid tipo (validation)", async () => {
    const res = await upsertApprovalWorkflow({
      ...validInput,
      tipo: "not_a_real_tipo" as unknown as typeof validInput.tipo,
    });

    expect(res.ok).toBe(false);
    expect(h.approvalWorkflowUpsert).not.toHaveBeenCalled();
  });

  it("rejects an empty etapas array (validation)", async () => {
    const res = await upsertApprovalWorkflow({ ...validInput, etapas: [] });

    expect(res.ok).toBe(false);
    expect(h.approvalWorkflowUpsert).not.toHaveBeenCalled();
  });

  it("upserts tenant-scoped by (tenantId, tipo), audits, and revalidates", async () => {
    h.approvalWorkflowFindFirst.mockResolvedValue(null);
    h.approvalWorkflowUpsert.mockResolvedValue({ id: "wf-1" });

    const res = await upsertApprovalWorkflow(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("wf-1");
    }
    expect(h.approvalWorkflowUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_tipo: {
            tenantId: tenantCtx.tenantId,
            tipo: "epic_investment",
          },
        },
        create: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          tipo: "epic_investment",
          nome: validInput.nome,
          etapas: validInput.etapas,
          ativo: true,
        }),
        update: expect.objectContaining({
          nome: validInput.nome,
          etapas: validInput.etapas,
          ativo: true,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "approval_workflow",
        entityId: "wf-1",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("never lets a cross-tenant tipo collide — where clause always uses ctx.tenantId", async () => {
    h.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      tenantId: "other-tenant",
    });
    h.approvalWorkflowFindFirst.mockResolvedValue({ id: "wf-existing" });
    h.approvalWorkflowUpsert.mockResolvedValue({ id: "wf-existing" });

    await upsertApprovalWorkflow(validInput);

    expect(h.approvalWorkflowUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_tipo: { tenantId: "other-tenant", tipo: "epic_investment" },
        },
      })
    );
  });
});
