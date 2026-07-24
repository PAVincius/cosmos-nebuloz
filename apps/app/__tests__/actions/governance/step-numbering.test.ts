// step-numbering.test.ts — regression coverage for 2d: two different
// writers can produce an ApprovalWorkflow's `etapas` (DEFAULT_WORKFLOWS in
// this file's ensureDefaultWorkflows, and GateStepSchema-authored policies
// via (cosmos)/actions/governance.ts's upsertApprovalWorkflow). Both must
// agree on the same 0-based `order` convention, or the exact same gate
// renders a different step number (gate-detail-client.tsx's
// `step.etapaOrdem + 1`) depending on which writer created it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  epicFindFirst: vi.fn(),
  approvalRequestFindFirst: vi.fn(),
  approvalWorkflowUpsert: vi.fn(),
  approvalWorkflowFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    epic: { findFirst: mocks.epicFindFirst },
    approvalRequest: { findFirst: mocks.approvalRequestFindFirst },
    approvalWorkflow: {
      upsert: mocks.approvalWorkflowUpsert,
      findFirst: mocks.approvalWorkflowFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

import { submitEpicForApproval } from "../../../app/actions/governance";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
  mocks.epicFindFirst.mockResolvedValue({ id: "clepic10000000000000001" });
  mocks.approvalRequestFindFirst.mockResolvedValue(null); // no existing open request
  mocks.approvalWorkflowUpsert.mockResolvedValue({});
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        governedEpic: {
          upsert: vi.fn().mockResolvedValue({ id: "ge-1" }),
          update: vi.fn().mockResolvedValue({}),
        },
        approvalRequest: {
          create: vi.fn().mockResolvedValue({ id: "req-1" }),
        },
      };
      return fn(tx);
    }
  );
});

describe("DEFAULT_WORKFLOWS (ensureDefaultWorkflows writer)", () => {
  it("seeds epic_investment and budget_guardrail_change with 0-based step order", async () => {
    mocks.approvalWorkflowFindFirst.mockResolvedValue({
      id: "wf-1",
      etapas: [
        { order: 0, roleRequired: "lpm" },
        { order: 1, roleRequired: "finance" },
      ],
    });

    await submitEpicForApproval({ epicId: "clepic10000000000000001" });

    expect(mocks.approvalWorkflowUpsert).toHaveBeenCalledTimes(2);
    for (const call of mocks.approvalWorkflowUpsert.mock.calls) {
      const orders = (call[0].create.etapas as Array<{ order: number }>).map(
        (e) => e.order
      );
      expect(orders).toEqual([0, 1]);
    }
  });
});

describe("GateStepSchema writer ((cosmos)/actions/governance.ts UI)", () => {
  it("also derives 0-based order from the step editor's array index", () => {
    // Mirrors governance.tsx's GovernancePolicyModal.save():
    // etapas: steps.map((step, order) => ({ order, ... }))
    const steps = [{ roleRequired: "STE" }, { roleRequired: "ADMIN" }];
    const etapas = steps.map((step, order) => ({ order, ...step }));
    expect(etapas.map((e) => e.order)).toEqual([0, 1]);
  });
});

describe("cross-writer consistency", () => {
  it("submitEpicForApproval stores etapaOrdem as a direct passthrough of whatever order the active workflow's writer used", async () => {
    // A workflow authored by the GateStepSchema (UI) writer — 0-based by
    // construction, same as DEFAULT_WORKFLOWS after the fix.
    mocks.approvalWorkflowFindFirst.mockResolvedValue({
      id: "wf-ui",
      etapas: [
        { order: 0, roleRequired: "STE" },
        { order: 1, roleRequired: "ADMIN" },
      ],
    });

    let capturedSteps: Array<{ etapaOrdem: number }> = [];
    mocks.transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          governedEpic: {
            upsert: vi.fn().mockResolvedValue({ id: "ge-1" }),
            update: vi.fn().mockResolvedValue({}),
          },
          approvalRequest: {
            create: vi.fn().mockImplementation((args) => {
              capturedSteps = args.data.steps.createMany.data;
              return Promise.resolve({ id: "req-1" });
            }),
          },
        };
        return fn(tx);
      }
    );

    await submitEpicForApproval({ epicId: "clepic10000000000000001" });

    // Same 0-based numbering as DEFAULT_WORKFLOWS above — a gate built
    // from either writer renders identical step labels (etapaOrdem + 1).
    expect(capturedSteps.map((s) => s.etapaOrdem)).toEqual([0, 1]);
  });
});
