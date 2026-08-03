import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  bpmnDefinitionFindMany: vi.fn(),
  bpmnDefinitionFindFirst: vi.fn(),
  bpmnDefinitionUpdate: vi.fn(),
  bpmnDefinitionUpdateMany: vi.fn(),
  transaction: vi.fn(),
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
    bpmnDefinition: {
      findMany: h.bpmnDefinitionFindMany,
      findFirst: h.bpmnDefinitionFindFirst,
      update: h.bpmnDefinitionUpdate,
      updateMany: h.bpmnDefinitionUpdateMany,
    },
    $transaction: h.transaction,
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  listWorkflows,
  toggleWorkflowActive,
} from "../../app/(cosmos)/actions/workflows";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
  h.bpmnDefinitionUpdateMany.mockResolvedValue({ count: 0 });
  // $transaction interativo: a action recebe o client transacional e faz as
  // duas escritas nele. O mock repassa o mesmo par de spies.
  h.transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn({
      bpmnDefinition: {
        updateMany: h.bpmnDefinitionUpdateMany,
        update: h.bpmnDefinitionUpdate,
      },
    })
  );
});

describe("listWorkflows", () => {
  it("returns tenant-scoped workflows ordered by active/runCount", async () => {
    h.bpmnDefinitionFindMany.mockResolvedValue([
      {
        id: "wf-1",
        name: "Promover épico ao aprovar gate",
        entityType: "EPIC",
        ownerType: "ORG",
        ownerId: "org-1",
        triggerLabel: "Épico → Approved",
        actionCount: 3,
        runCount: 142,
        active: true,
        activatedAt: new Date("2026-02-01"),
      },
    ]);

    const r = await listWorkflows();

    expect(r.ok).toBe(true);
    expect(database.bpmnDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].name).toBe("Promover épico ao aprovar gate");
      expect(r.data[0].runCount).toBe(142);
      expect(typeof r.data[0].activatedAt).toBe("string");
    }
  });

  it("never leaks another tenant's workflows — where clause always uses ctx.tenantId", async () => {
    h.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      tenantId: "other-tenant",
    });
    h.bpmnDefinitionFindMany.mockResolvedValue([]);

    await listWorkflows();

    expect(database.bpmnDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "other-tenant" },
      })
    );
  });
});

describe("toggleWorkflowActive", () => {
  const validInput = { id: "clxxxxxxxxxxxxxxxxxxxxxxx", active: true };
  const scoped = {
    id: validInput.id,
    entityType: "FEATURE",
    ownerType: "ART",
    ownerId: "art-1",
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await toggleWorkflowActive(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "STE"],
      tenantCtx
    );
    expect(h.bpmnDefinitionUpdate).not.toHaveBeenCalled();
  });

  it("rejects a workflow id that is not owned by the tenant (IDOR guard)", async () => {
    h.bpmnDefinitionFindFirst.mockResolvedValue(null);

    const res = await toggleWorkflowActive(validInput);

    expect(res.ok).toBe(false);
    expect(h.bpmnDefinitionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validInput.id, tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.bpmnDefinitionUpdate).not.toHaveBeenCalled();
  });

  it("activates, stamping activatedAt/activatedBy, audits, and revalidates", async () => {
    h.bpmnDefinitionFindFirst.mockResolvedValue(scoped);
    h.bpmnDefinitionUpdate.mockResolvedValue({
      id: validInput.id,
      active: true,
    });

    const res = await toggleWorkflowActive(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.active).toBe(true);
    }
    expect(h.bpmnDefinitionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validInput.id },
        data: expect.objectContaining({
          active: true,
          activatedBy: tenantCtx.userId,
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "bpmn_definition",
        entityId: validInput.id,
        diff: expect.objectContaining({ active: true }),
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("deactivates without touching activatedAt/activatedBy", async () => {
    h.bpmnDefinitionFindFirst.mockResolvedValue(scoped);
    h.bpmnDefinitionUpdate.mockResolvedValue({
      id: validInput.id,
      active: false,
    });

    const res = await toggleWorkflowActive({ ...validInput, active: false });

    expect(res.ok).toBe(true);
    expect(h.bpmnDefinitionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validInput.id },
        data: { active: false },
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        diff: expect.objectContaining({ active: false }),
      })
    );
  });

  // ── AC-001: uma ativa por escopo (owner + entityType), FR-030 ──────────────
  it("desativa a irmã ativa do mesmo escopo na mesma transação ao ativar (AC-001)", async () => {
    h.bpmnDefinitionFindFirst.mockResolvedValue(scoped);
    h.bpmnDefinitionUpdateMany.mockResolvedValue({ count: 1 });
    h.bpmnDefinitionUpdate.mockResolvedValue({
      id: validInput.id,
      active: true,
    });

    const res = await toggleWorkflowActive(validInput);

    expect(res.ok).toBe(true);
    // as duas escritas acontecem dentro de $transaction, não soltas
    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.bpmnDefinitionUpdateMany).toHaveBeenCalledWith({
      where: {
        tenantId: tenantCtx.tenantId,
        entityType: scoped.entityType,
        ownerType: scoped.ownerType,
        ownerId: scoped.ownerId,
        active: true,
        id: { not: validInput.id },
      },
      data: { active: false },
    });
    if (res.ok) {
      expect(res.data.deactivated).toBe(1);
    }
  });

  it("não desativa definição de outro escopo — a exclusividade é por escopo (AC-001)", async () => {
    h.bpmnDefinitionFindFirst.mockResolvedValue(scoped);
    h.bpmnDefinitionUpdateMany.mockResolvedValue({ count: 0 });
    h.bpmnDefinitionUpdate.mockResolvedValue({
      id: validInput.id,
      active: true,
    });

    await toggleWorkflowActive(validInput);

    const where = h.bpmnDefinitionUpdateMany.mock.calls[0][0].where;
    // o filtro é fechado nos três eixos do escopo: outro entityType ou outro
    // ownerId não é alcançado pelo updateMany
    expect(where.entityType).toBe("FEATURE");
    expect(where.ownerType).toBe("ART");
    expect(where.ownerId).toBe("art-1");
    expect(where.tenantId).toBe(tenantCtx.tenantId);
  });

  it("audita qual definição foi substituída ao ativar (AC-003)", async () => {
    h.bpmnDefinitionFindFirst.mockResolvedValue(scoped);
    h.bpmnDefinitionUpdateMany.mockResolvedValue({ count: 2 });
    h.bpmnDefinitionUpdate.mockResolvedValue({
      id: validInput.id,
      active: true,
    });

    await toggleWorkflowActive(validInput);

    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        diff: { active: true, deactivated: 2 },
      })
    );
  });

  it("não desativa nada ao apenas desativar (AC-002)", async () => {
    h.bpmnDefinitionFindFirst.mockResolvedValue(scoped);
    h.bpmnDefinitionUpdate.mockResolvedValue({
      id: validInput.id,
      active: false,
    });

    const res = await toggleWorkflowActive({ ...validInput, active: false });

    expect(res.ok).toBe(true);
    expect(h.bpmnDefinitionUpdateMany).not.toHaveBeenCalled();
    if (res.ok) {
      expect(res.data.deactivated).toBe(0);
    }
  });
});
