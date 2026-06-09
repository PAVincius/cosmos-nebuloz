import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const requestBase = {
  id: "req-1",
  workflowId: "wf-1",
  governedEpicId: "ge-1",
  tenantId: tenantCtx.tenantId,
  stepIndex: 0,
  estado: "open",
};

const epicBase = {
  id: "ge-1",
  tenantId: tenantCtx.tenantId,
  submittedBy: "other-user",
  governanceStatus: "review",
  allowApprovalBypass: true,
  currentStepIndex: 0,
};

const workflowBase = {
  id: "wf-1",
  etapas: [
    { order: 0, roleRequired: "lpm", approverIds: [] },
    { order: 1, roleRequired: "finance", approverIds: [] },
  ],
};

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  approvalRequestFindFirstOrThrow: vi.fn(),
  approvalRequestUpdate: vi.fn(),
  approvalRequestUpdateMany: vi.fn(),
  approvalRequestCount: vi.fn(),
  approvalRequestCreate: vi.fn(),
  approvalRequestCreateMany: vi.fn(),
  governedEpicFindFirstOrThrow: vi.fn(),
  governedEpicUpdate: vi.fn(),
  approvalWorkflowFindFirstOrThrow: vi.fn(),
  decisionLogEntryCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    approvalRequest: {
      findFirstOrThrow: mocks.approvalRequestFindFirstOrThrow,
      update: mocks.approvalRequestUpdate,
      updateMany: mocks.approvalRequestUpdateMany,
      count: mocks.approvalRequestCount,
      create: mocks.approvalRequestCreate,
      createMany: mocks.approvalRequestCreateMany,
    },
    governedEpic: {
      findFirstOrThrow: mocks.governedEpicFindFirstOrThrow,
      update: mocks.governedEpicUpdate,
    },
    approvalWorkflow: {
      findFirstOrThrow: mocks.approvalWorkflowFindFirstOrThrow,
    },
    decisionLogEntry: {
      create: mocks.decisionLogEntryCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  bypassApproval,
  processApprovalDecision,
} from "../../../app/actions/governance/multi-step";

describe("processApprovalDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "STE",
    });
    mocks.approvalRequestFindFirstOrThrow.mockResolvedValue(requestBase);
    mocks.governedEpicFindFirstOrThrow.mockResolvedValue(epicBase);
    mocks.approvalWorkflowFindFirstOrThrow.mockResolvedValue(workflowBase);
    mocks.approvalRequestUpdate.mockResolvedValue({});
    mocks.decisionLogEntryCreate.mockResolvedValue({});
    mocks.approvalRequestCount.mockResolvedValue(0);
    mocks.approvalRequestCreate.mockResolvedValue({});
    mocks.approvalRequestCreateMany.mockResolvedValue({ count: 1 });
    mocks.approvalRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.governedEpicUpdate.mockResolvedValue({});
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      if (typeof fn === "function") {
        return fn({
          governedEpic: { update: mocks.governedEpicUpdate },
          approvalRequest: {
            update: mocks.approvalRequestUpdate,
            updateMany: mocks.approvalRequestUpdateMany,
            create: mocks.approvalRequestCreate,
            createMany: mocks.approvalRequestCreateMany,
          },
          decisionLogEntry: { create: mocks.decisionLogEntryCreate },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    });
  });

  it("advances to next step when all step requests approved", async () => {
    mocks.approvalRequestCount.mockResolvedValue(0); // no pending

    const result = await processApprovalDecision({
      requestId: "req-1",
      stepIndex: 0,
      decision: "approved",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(["advanced", "completed"]).toContain(result.data.status);
  });

  it("returns waiting when other requests still open for step", async () => {
    mocks.approvalRequestCount.mockResolvedValue(1); // one still open

    const result = await processApprovalDecision({
      requestId: "req-1",
      stepIndex: 0,
      decision: "approved",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.status).toBe("waiting");
  });

  it("rejection terminates workflow and cancels all open requests", async () => {
    const result = await processApprovalDecision({
      requestId: "req-1",
      stepIndex: 0,
      decision: "rejected",
      reason: "Budget not available",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.status).toBe("rejected");
  });

  it("rejects when submitter tries to approve own epic (SELF_APPROVAL_NOT_ALLOWED)", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      userId: epicBase.submittedBy,
      role: "STE",
    });

    const result = await processApprovalDecision({
      requestId: "req-1",
      stepIndex: 0,
      decision: "approved",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("SELF_APPROVAL_NOT_ALLOWED");
  });

  it("writes DecisionLogEntry on approval", async () => {
    mocks.approvalRequestCount.mockResolvedValue(0);

    await processApprovalDecision({
      requestId: "req-1",
      stepIndex: 0,
      decision: "approved",
    });

    expect(mocks.decisionLogEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decisao: "approved",
          decisorId: tenantCtx.userId,
        }),
      })
    );
  });

  it("returns completed when last step approved", async () => {
    // Put workflow at last step
    mocks.approvalWorkflowFindFirstOrThrow.mockResolvedValue({
      ...workflowBase,
      etapas: [{ order: 0, roleRequired: "lpm", approverIds: [] }],
    });
    mocks.approvalRequestFindFirstOrThrow.mockResolvedValue({
      ...requestBase,
      stepIndex: 0,
    });
    mocks.approvalRequestCount.mockResolvedValue(0);

    const result = await processApprovalDecision({
      requestId: "req-1",
      stepIndex: 0,
      decision: "approved",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.status).toBe("completed");
  });
});

describe("bypassApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "RTE",
    });
    mocks.governedEpicFindFirstOrThrow.mockResolvedValue(epicBase);
    mocks.governedEpicUpdate.mockResolvedValue({});
    mocks.approvalRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.decisionLogEntryCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      if (typeof fn === "function") {
        return fn({
          governedEpic: { update: mocks.governedEpicUpdate },
          approvalRequest: { updateMany: mocks.approvalRequestUpdateMany },
          decisionLogEntry: { create: mocks.decisionLogEntryCreate },
        });
      }
      return Promise.all(fn as Promise<unknown>[]);
    });
  });

  it("RTE can bypass when allowApprovalBypass=true", async () => {
    const justification = "Emergency release required".padEnd(100, ".");

    const result = await bypassApproval({
      governedEpicId: "ge-1",
      justification,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.status).toBe("bypassed");
  });

  it("writes DecisionLogEntry tipo=BYPASS", async () => {
    const justification = "Emergency release required".padEnd(100, ".");

    await bypassApproval({ governedEpicId: "ge-1", justification });

    expect(mocks.decisionLogEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: "BYPASS",
          decisorId: tenantCtx.userId,
        }),
      })
    );
  });

  it("cancels all open ApprovalRequests on bypass", async () => {
    const justification = "Emergency release required".padEnd(100, ".");

    await bypassApproval({ governedEpicId: "ge-1", justification });

    expect(mocks.approvalRequestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { estado: "cancelled" },
      })
    );
  });

  it("FORBIDDEN for non-RTE/non-ADMIN roles", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "PO",
    });

    const result = await bypassApproval({
      governedEpicId: "ge-1",
      justification: "x".repeat(100),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FORBIDDEN");
  });

  it("BYPASS_NOT_ALLOWED when allowApprovalBypass=false", async () => {
    mocks.governedEpicFindFirstOrThrow.mockResolvedValue({
      ...epicBase,
      allowApprovalBypass: false,
    });

    const result = await bypassApproval({
      governedEpicId: "ge-1",
      justification: "x".repeat(100),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("BYPASS_NOT_ALLOWED");
  });

  it("rejects justification under 100 chars", async () => {
    const result = await bypassApproval({
      governedEpicId: "ge-1",
      justification: "too short",
    });

    expect(result.ok).toBe(false);
  });
});
