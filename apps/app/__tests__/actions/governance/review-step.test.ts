// review-step.test.ts — regression coverage for the reviewStep() defects
// fixed in this branch:
//  2a. Concurrent reviewStep() calls on sibling steps of the same request
//      must never leave the request stuck in "in_review" once every step
//      has actually been decided (deadlock: no UI control could ever
//      finish the request again).
//  2b. Once a request has been terminally rejected, a decision on a
//      leftover "pending" sibling step must be refused — no second,
//      contradictory decisionLogEntry may be written.
//
// The $transaction mock below models real Postgres READ COMMITTED
// semantics for two interleaved transactions on the same ApprovalRequest:
// each transaction only sees its OWN uncommitted writes plus whatever the
// other transaction has already COMMITTED — never the other's in-flight
// writes. `tx.$queryRaw(... FOR UPDATE)` is modeled as a real per-request
// mutex: a second transaction's lock call does not resolve until the first
// transaction's callback has fully returned (i.e. "committed"). This lets
// the concurrency test above genuinely fail if the FOR UPDATE lock call is
// ever removed from reviewStep (verified by hand while writing the fix).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

type StepRow = {
  id: string;
  estado: string;
  roleRequired: string;
  approvalRequestId: string;
  etapaOrdem: number;
};

const STEP_1_ID = "clstep1000000000000000001";
const STEP_2_ID = "clstep2000000000000000002";
const REQUEST_ID = "clrequest0000000000000001";

function makeInitialSteps(): StepRow[] {
  return [
    {
      id: STEP_1_ID,
      estado: "pending",
      roleRequired: "lpm",
      approvalRequestId: REQUEST_ID,
      etapaOrdem: 0,
    },
    {
      id: STEP_2_ID,
      estado: "pending",
      roleRequired: "finance",
      approvalRequestId: REQUEST_ID,
      etapaOrdem: 1,
    },
  ];
}

// ─── Shared fake-DB state (committed truth) + per-request lock ────────────────

let sharedSteps: StepRow[];
let sharedRequestEstado: string;
let sharedGovernanceStatus: string;
let decisionLogCalls: Array<{ data: Record<string, unknown> }>;
let locks: Map<string, Promise<void>>;

function resetFakeDb() {
  sharedSteps = makeInitialSteps();
  sharedRequestEstado = "open";
  sharedGovernanceStatus = "review";
  decisionLogCalls = [];
  locks = new Map();
}

function acquireLock(id: string): Promise<() => void> {
  const prev = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    id,
    prev.then(() => gate)
  );
  return prev.then(() => release);
}

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  stepFindFirst: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    approvalStepInstance: { findFirst: mocks.stepFindFirst },
    tenantMember: { findFirst: mocks.tenantMemberFindFirst },
    $transaction: mocks.transaction,
  },
}));

import { reviewStep } from "../../../app/actions/governance";

function stepFindFirstImpl({ where }: { where: { id: string } }) {
  const row = sharedSteps.find((s) => s.id === where.id);
  if (!row || row.estado !== "pending") {
    return Promise.resolve(null);
  }
  return Promise.resolve({
    id: row.id,
    approvalRequestId: row.approvalRequestId,
    roleRequired: row.roleRequired,
    approvalRequest: {
      targetId: "epic-1",
      steps: sharedSteps.map((s) => ({ ...s })),
      governedEpic: { id: "ge-1", valueStreamId: null },
    },
  });
}

function transactionImpl(fn: (tx: unknown) => Promise<unknown>) {
  // Per-transaction uncommitted overlay — only merged into `sharedSteps` /
  // `sharedRequestEstado` when this transaction's callback returns
  // (models COMMIT). Reads always prefer this transaction's own pending
  // writes over the shared state (read-your-own-writes), and otherwise
  // fall back to whatever is currently committed — never to another
  // transaction's uncommitted writes.
  const pendingStepWrites = new Map<string, Partial<StepRow>>();
  let pendingRequestEstado: string | null = null;
  let pendingGovernanceStatus: string | null = null;
  // No-op default (rather than `| null`) sidesteps a TS control-flow
  // narrowing quirk on `let` variables only ever reassigned inside a
  // nested closure; always safe to call unconditionally at commit time.
  let lockRelease: () => void = () => {};

  const tx = {
    $queryRaw: async (..._args: unknown[]) => {
      lockRelease = await acquireLock(REQUEST_ID);
      return [];
    },
    approvalStepInstance: {
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<StepRow>;
      }) => {
        pendingStepWrites.set(where.id, {
          ...(pendingStepWrites.get(where.id) ?? {}),
          ...data,
        });
        return Promise.resolve({});
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { id: { in: string[] } };
        data: Partial<StepRow>;
      }) => {
        for (const id of where.id.in) {
          pendingStepWrites.set(id, {
            ...(pendingStepWrites.get(id) ?? {}),
            ...data,
          });
        }
        return Promise.resolve({});
      },
      findMany: () =>
        Promise.resolve(
          sharedSteps.map((s) => ({
            ...s,
            ...(pendingStepWrites.get(s.id) ?? {}),
          }))
        ),
    },
    approvalRequest: {
      update: ({ data }: { data: { estado?: string } }) => {
        if (data.estado) {
          pendingRequestEstado = data.estado;
        }
        return Promise.resolve({});
      },
    },
    governedEpic: {
      update: ({ data }: { data: { governanceStatus?: string } }) => {
        if (data.governanceStatus) {
          pendingGovernanceStatus = data.governanceStatus;
        }
        return Promise.resolve({});
      },
    },
    decisionLogEntry: {
      create: (args: { data: Record<string, unknown> }) => {
        decisionLogCalls.push(args);
        return Promise.resolve({});
      },
    },
  };

  return (async () => {
    const result = await fn(tx);
    // commit
    sharedSteps = sharedSteps.map((s) =>
      pendingStepWrites.has(s.id) ? { ...s, ...pendingStepWrites.get(s.id) } : s
    );
    if (pendingRequestEstado) {
      sharedRequestEstado = pendingRequestEstado;
    }
    if (pendingGovernanceStatus) {
      sharedGovernanceStatus = pendingGovernanceStatus;
    }
    lockRelease();
    return result;
  })();
}

beforeEach(() => {
  vi.clearAllMocks();
  resetFakeDb();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "ADMIN" });
  mocks.tenantMemberFindFirst.mockResolvedValue({ role: "ADMIN" });
  mocks.stepFindFirst.mockImplementation(stepFindFirstImpl);
  mocks.transaction.mockImplementation(transactionImpl);
});

describe("reviewStep — concurrent sibling approvals (2a)", () => {
  it("never leaves the request stuck in in_review once every step is decided", async () => {
    const [resA, resB] = await Promise.all([
      reviewStep({ stepId: STEP_1_ID, decision: "approved" }),
      reviewStep({ stepId: STEP_2_ID, decision: "approved" }),
    ]);

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    expect(sharedSteps.every((s) => s.estado === "approved")).toBe(true);
    // The regression: without the FOR UPDATE lock, both transactions read
    // the other's step as still "pending" and both set "in_review" — a
    // dead end no button can ever recover from.
    expect(sharedRequestEstado).toBe("approved");
    expect(sharedGovernanceStatus).toBe("approved");
  });
});

describe("reviewStep — terminal-request decisions (2b)", () => {
  it("cancels the remaining pending sibling on rejection", async () => {
    await reviewStep({ stepId: STEP_1_ID, decision: "rejected" });

    expect(sharedRequestEstado).toBe("rejected");
    const step2 = sharedSteps.find((s) => s.id === STEP_2_ID);
    expect(step2?.estado).toBe("skipped");
  });

  it("refuses a decision on a step of an already-rejected request and logs no second entry", async () => {
    await reviewStep({ stepId: STEP_1_ID, decision: "rejected" });
    expect(decisionLogCalls).toHaveLength(1);

    // Finance never should have been offered Aprovar on step-2 (it's now
    // "skipped", not "pending") — but even a direct server call must be
    // refused rather than silently re-terminating the request.
    const second = await reviewStep({
      stepId: STEP_2_ID,
      decision: "approved",
    });

    expect(second.ok).toBe(false);
    expect(sharedRequestEstado).toBe("rejected");
    // No phantom second decision-log entry recording finance "rejecting"
    // an epic they tried to approve.
    expect(decisionLogCalls).toHaveLength(1);
    expect(decisionLogCalls[0].data.decisao).toBe("rejected");
  });
});
