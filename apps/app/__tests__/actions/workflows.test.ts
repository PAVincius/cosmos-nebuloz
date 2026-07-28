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
    },
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
    h.bpmnDefinitionFindFirst.mockResolvedValue({ id: validInput.id });
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
        diff: { active: true },
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("deactivates without touching activatedAt/activatedBy", async () => {
    h.bpmnDefinitionFindFirst.mockResolvedValue({ id: validInput.id });
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
      expect.objectContaining({ diff: { active: false } })
    );
  });
});
