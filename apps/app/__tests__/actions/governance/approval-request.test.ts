import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

// getApprovalRequest/listApprovalRequests (apps/app/app/actions/governance/index.ts)
// — covers the gate-detail screen's read path, including the slaDeadline/
// slaStatus fields added to ApprovalStepInstancePublic for the gate
// stepper's SLA display.

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  approvalRequestFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    approvalRequest: {
      findFirst: h.approvalRequestFindFirst,
    },
  },
}));

import { database } from "@repo/database";
import { getApprovalRequest } from "../../../app/actions/governance";

const STEP = {
  id: "step-1",
  etapaOrdem: 0,
  roleRequired: "lpm",
  approverId: null,
  estado: "pending",
  comentario: null,
  timestamp: null,
  slaDeadline: new Date("2026-03-01"),
  slaStatus: "ON_TRACK",
};

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
});

describe("getApprovalRequest", () => {
  it("is tenant-scoped — where clause always uses ctx.tenantId", async () => {
    h.approvalRequestFindFirst.mockResolvedValue({
      id: "req-1",
      tenantId: tenantCtx.tenantId,
      workflowId: "wf-1",
      workflow: { nome: "Aprovação de Épico de Portfólio" },
      targetType: "epic",
      targetId: "epic-1",
      estado: "in_review",
      initiatorId: "user-1",
      governedEpicId: "ge-1",
      governedEpic: { epic: { title: "Migração multi-tenant" } },
      steps: [STEP],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await getApprovalRequest("req-1");

    expect(database.approvalRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1", tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("never leaks another tenant's request — where clause reflects ctx.tenantId", async () => {
    h.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      tenantId: "other-tenant",
    });
    h.approvalRequestFindFirst.mockResolvedValue(null);

    const res = await getApprovalRequest("req-1");

    expect(res.ok).toBe(false);
    expect(database.approvalRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1", tenantId: "other-tenant" },
      })
    );
  });

  it("surfaces each step's slaDeadline and slaStatus for the gate stepper", async () => {
    h.approvalRequestFindFirst.mockResolvedValue({
      id: "req-1",
      tenantId: tenantCtx.tenantId,
      workflowId: "wf-1",
      workflow: { nome: "Aprovação de Épico de Portfólio" },
      targetType: "epic",
      targetId: "epic-1",
      estado: "in_review",
      initiatorId: "user-1",
      governedEpicId: "ge-1",
      governedEpic: { epic: { title: "Migração multi-tenant" } },
      steps: [STEP],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await getApprovalRequest("req-1");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.steps[0].slaStatus).toBe("ON_TRACK");
      expect(res.data.steps[0].slaDeadline).toEqual(new Date("2026-03-01"));
    }
  });
});
