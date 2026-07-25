// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  decisionLogCreate: vi.fn(),
  decisionLogFindMany: vi.fn(),
  governedEpicFindFirst: vi.fn(),
  governedEpicUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    decisionLogEntry: {
      create: mocks.decisionLogCreate,
      findMany: mocks.decisionLogFindMany,
    },
    governedEpic: {
      findFirst: mocks.governedEpicFindFirst,
      update: mocks.governedEpicUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

// ─── Imports AFTER mocks ──────────────────────────────────────────────────────

import {
  logBudgetChange,
  logThemeChange,
} from "@/app/actions/governance/audit-hooks";
import {
  listDecisions,
  logDecision,
} from "@/app/actions/governance/decision-log";
import { transitionEpic } from "@/app/actions/governance/transition-epic";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CREATED_ENTRY = {
  id: "entry-1",
  tenantId: tenantCtx.tenantId,
  tipo: "budget_decision",
  targetType: "guardrail",
  targetId: "budget-1",
  decisorId: tenantCtx.userId,
  dataDecisao: new Date(),
};

const GOVERNED_EPIC = {
  id: "ge-1",
  epicId: "epic-1",
  tenantId: tenantCtx.tenantId,
  governanceStatus: "FUNNEL",
  epic: { title: "My Epic", investScore: 42 },
};

const VALID_INPUT = {
  epicId: "epic-1",
  to: "ANALYZING" as const,
  justificativa: "Avaliação completa e prioridade confirmada",
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.decisionLogCreate.mockResolvedValue(CREATED_ENTRY);
  mocks.decisionLogFindMany.mockResolvedValue([]);
  mocks.governedEpicFindFirst.mockResolvedValue(GOVERNED_EPIC);
  mocks.governedEpicUpdate.mockResolvedValue({});
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        governedEpic: { update: vi.fn().mockResolvedValue({}) },
        decisionLogEntry: { create: vi.fn().mockResolvedValue(CREATED_ENTRY) },
      };
      return fn(tx);
    }
  );
});

// ─── decision-log.ts ─────────────────────────────────────────────────────────

describe("logDecision", () => {
  it("calls decisionLogEntry.create with correct tenantId, tipo, targetType, targetId, decisorId", async () => {
    const input = {
      tipo: "test_decision",
      targetType: "epic",
      targetId: "epic-abc",
      decisao: "Approved",
      justificativa: "Good rationale",
    };

    await logDecision(tenantCtx, input);

    expect(mocks.decisionLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: tenantCtx.tenantId,
        tipo: "test_decision",
        targetType: "epic",
        targetId: "epic-abc",
        decisorId: tenantCtx.userId,
      }),
    });
  });

  it("returns the created entry", async () => {
    const result = await logDecision(tenantCtx, {
      tipo: "test_decision",
      targetType: "epic",
      targetId: "epic-abc",
      decisao: "Approved",
      justificativa: "Good rationale",
    });

    expect(result).toBe(CREATED_ENTRY);
  });

  it("omits valueStreamId when not provided", async () => {
    await logDecision(tenantCtx, {
      tipo: "test_decision",
      targetType: "epic",
      targetId: "epic-abc",
      decisao: "Approved",
      justificativa: "Good rationale",
    });

    const call = mocks.decisionLogCreate.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("valueStreamId");
  });

  it("includes valueStreamId when provided", async () => {
    await logDecision(tenantCtx, {
      tipo: "test_decision",
      targetType: "guardrail",
      targetId: "g-1",
      decisao: "Budget set",
      justificativa: "Annual planning",
      valueStreamId: "vs-1",
    });

    const call = mocks.decisionLogCreate.mock.calls[0][0];
    expect(call.data.valueStreamId).toBe("vs-1");
  });

  it("defaults dadosSuporte to empty object when not provided", async () => {
    await logDecision(tenantCtx, {
      tipo: "test_decision",
      targetType: "epic",
      targetId: "epic-abc",
      decisao: "Approved",
      justificativa: "Good rationale",
    });

    const call = mocks.decisionLogCreate.mock.calls[0][0];
    expect(call.data.dadosSuporte).toEqual({});
  });
});

describe("listDecisions", () => {
  it("calls findMany with tenantId and no extra filters by default", async () => {
    await listDecisions(tenantCtx.tenantId);

    expect(mocks.decisionLogFindMany).toHaveBeenCalledWith({
      where: { tenantId: tenantCtx.tenantId },
      orderBy: { dataDecisao: "desc" },
    });
  });

  it("applies tipo filter when provided", async () => {
    await listDecisions(tenantCtx.tenantId, { tipo: "budget_decision" });

    const call = mocks.decisionLogFindMany.mock.calls[0][0];
    expect(call.where.tipo).toBe("budget_decision");
  });
});

// ─── audit-hooks.ts ───────────────────────────────────────────────────────────

describe("logBudgetChange", () => {
  it("calls logDecision with tipo: budget_decision and targetType: guardrail", async () => {
    await logBudgetChange(tenantCtx, {
      budgetId: "budget-1",
      oldAmount: 1000,
      newAmount: 1500,
      justificativa: "Scope increase approved",
    });

    expect(mocks.decisionLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "budget_decision",
        targetType: "guardrail",
        targetId: "budget-1",
        tenantId: tenantCtx.tenantId,
        decisorId: tenantCtx.userId,
      }),
    });
  });

  it("calculates delta and deltaPct in dadosSuporte", async () => {
    await logBudgetChange(tenantCtx, {
      budgetId: "budget-1",
      oldAmount: 1000,
      newAmount: 1500,
      justificativa: "Scope increase approved",
    });

    const call = mocks.decisionLogCreate.mock.calls[0][0];
    expect(call.data.dadosSuporte.delta).toBe(500);
    expect(call.data.dadosSuporte.deltaPct).toBeCloseTo(50);
  });

  it("sets deltaPct to null when oldAmount is 0", async () => {
    await logBudgetChange(tenantCtx, {
      budgetId: "budget-1",
      oldAmount: 0,
      newAmount: 1000,
      justificativa: "Initial budget allocation",
    });

    const call = mocks.decisionLogCreate.mock.calls[0][0];
    expect(call.data.dadosSuporte.deltaPct).toBeNull();
  });

  it("includes decisao message with old and new amounts", async () => {
    await logBudgetChange(tenantCtx, {
      budgetId: "budget-1",
      oldAmount: 1000,
      newAmount: 1500,
      justificativa: "Scope increase approved",
    });

    const call = mocks.decisionLogCreate.mock.calls[0][0];
    expect(call.data.decisao).toBe("Budget changed 1000 -> 1500");
  });

  it("passes optional valueStreamId through to logDecision", async () => {
    await logBudgetChange(tenantCtx, {
      budgetId: "budget-1",
      oldAmount: 100,
      newAmount: 200,
      justificativa: "VS budget adjustment",
      valueStreamId: "vs-42",
    });

    const call = mocks.decisionLogCreate.mock.calls[0][0];
    expect(call.data.valueStreamId).toBe("vs-42");
  });
});

describe("logThemeChange", () => {
  it("calls logDecision with tipo: theme_decision and targetType: theme", async () => {
    await logThemeChange(tenantCtx, {
      themeId: "theme-1",
      field: "priority",
      oldValue: "low",
      newValue: "high",
      justificativa: "Strategic reprioritization",
    });

    expect(mocks.decisionLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "theme_decision",
        targetType: "theme",
        targetId: "theme-1",
        tenantId: tenantCtx.tenantId,
        decisorId: tenantCtx.userId,
      }),
    });
  });

  it("stores field, before, after in dadosSuporte", async () => {
    await logThemeChange(tenantCtx, {
      themeId: "theme-1",
      field: "priority",
      oldValue: "low",
      newValue: "high",
      justificativa: "Strategic reprioritization",
    });

    const call = mocks.decisionLogCreate.mock.calls[0][0];
    expect(call.data.dadosSuporte).toEqual({
      field: "priority",
      before: "low",
      after: "high",
    });
  });
});

// ─── transition-epic.ts ───────────────────────────────────────────────────────

describe("transitionEpic", () => {
  it("happy path: returns { ok: true, data: { newState } } for valid transition", async () => {
    const result = await transitionEpic(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.newState).toBe("ANALYZING");
    }
  });

  it("runs database.$transaction to update governedEpic and create decisionLogEntry", async () => {
    await transitionEpic(VALID_INPUT);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("transaction updates governedEpic with the new status", async () => {
    const txUpdate = vi.fn().mockResolvedValue({});
    const txCreate = vi.fn().mockResolvedValue(CREATED_ENTRY);
    mocks.transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          governedEpic: { update: txUpdate },
          decisionLogEntry: { create: txCreate },
        };
        return fn(tx);
      }
    );

    await transitionEpic(VALID_INPUT);

    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: GOVERNED_EPIC.id },
      data: { governanceStatus: "ANALYZING" },
    });
  });

  it("transaction creates decisionLogEntry with correct dadosSuporte fields", async () => {
    const txCreate = vi.fn().mockResolvedValue(CREATED_ENTRY);
    const txUpdate = vi.fn().mockResolvedValue({});
    mocks.transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          governedEpic: { update: txUpdate },
          decisionLogEntry: { create: txCreate },
        };
        return fn(tx);
      }
    );

    await transitionEpic(VALID_INPUT);

    const createCall = txCreate.mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      tipo: "epic_decision",
      targetType: "epic",
      targetId: "epic-1",
      tenantId: tenantCtx.tenantId,
      decisorId: tenantCtx.userId,
      dadosSuporte: expect.objectContaining({
        investScore: GOVERNED_EPIC.epic.investScore,
        fromState: "FUNNEL",
        toState: "ANALYZING",
      }),
    });
  });

  it("transaction creates decisionLogEntry with dadosSuporte enriched with action context", async () => {
    // dadosSuporte: {} (empty record) passes Zod validation; the action code then merges
    // investScore, fromState, toState into it.
    let capturedCreateArgs: unknown = null;
    mocks.transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          governedEpic: { update: vi.fn().mockResolvedValue({}) },
          decisionLogEntry: {
            create: vi.fn().mockImplementation((args: unknown) => {
              capturedCreateArgs = args;
              return Promise.resolve(CREATED_ENTRY);
            }),
          },
        };
        return fn(tx);
      }
    );

    // Pass an empty dadosSuporte to stay within Zod v4 record constraints
    const result = await transitionEpic({
      ...VALID_INPUT,
      dadosSuporte: {},
    });

    expect(
      result.ok,
      `transitionEpic failed: ${result.ok ? "" : (result as { ok: false; error: string }).error}`
    ).toBe(true);
    expect(capturedCreateArgs).not.toBeNull();
    expect(
      (capturedCreateArgs as { data: { dadosSuporte: unknown } }).data
        .dadosSuporte
    ).toMatchObject({
      investScore: GOVERNED_EPIC.epic.investScore,
      fromState: "FUNNEL",
      toState: "ANALYZING",
    });
  });

  it("returns { ok: false } when governedEpic is not found", async () => {
    mocks.governedEpicFindFirst.mockResolvedValue(null);

    const result = await transitionEpic(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/não encontrado/i);
    }
  });

  it("returns { ok: false } when canTransition returns false (invalid state transition)", async () => {
    // FUNNEL -> DONE is invalid per state machine
    const result = await transitionEpic({
      epicId: "epic-1",
      to: "DONE",
      justificativa: "Skipping all the steps",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/inválida/i);
    }
  });

  it("returns { ok: false } when canTransition rejects IMPLEMENTING -> PORTFOLIO_BACKLOG", async () => {
    mocks.governedEpicFindFirst.mockResolvedValue({
      ...GOVERNED_EPIC,
      governanceStatus: "IMPLEMENTING",
    });

    const result = await transitionEpic({
      epicId: "epic-1",
      to: "PORTFOLIO_BACKLOG",
      justificativa: "Rolling back to backlog",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/inválida/i);
    }
  });

  it("returns { ok: false } on Zod validation error — missing epicId", async () => {
    const result = await transitionEpic({
      to: "ANALYZING",
      justificativa: "Missing epicId",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  });

  it("returns { ok: false } on Zod validation error — justificativa too short", async () => {
    const result = await transitionEpic({
      epicId: "epic-1",
      to: "ANALYZING",
      justificativa: "Short",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/justificativa/i);
    }
  });

  it("returns { ok: false } on Zod validation error — invalid 'to' state", async () => {
    const result = await transitionEpic({
      epicId: "epic-1",
      to: "INVALID_STATE",
      justificativa: "Some valid justification text",
    });

    expect(result.ok).toBe(false);
  });

  it("does not call transaction when epic is not found", async () => {
    mocks.governedEpicFindFirst.mockResolvedValue(null);

    await transitionEpic(VALID_INPUT);

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
