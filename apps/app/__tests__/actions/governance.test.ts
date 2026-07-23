import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  governedEpicFindMany: vi.fn(),
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
