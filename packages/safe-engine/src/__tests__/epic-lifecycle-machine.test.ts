import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import {
  ELEVATED_EVENTS,
  type EpicLifecycleContext,
  epicLifecycleMachine,
} from "../machines/epic-lifecycle";

const FULL_CONTEXT: EpicLifecycleContext = {
  investScore: 50,
  hypothesis:
    "This hypothesis is long enough to pass the minimum length check for the guard",
  leanBudgetAllocation: 10_000,
  hasGovernanceApproval: true,
  rejectionReason: null,
};

const EMPTY_CONTEXT: EpicLifecycleContext = {
  investScore: null,
  hypothesis: null,
  leanBudgetAllocation: null,
  hasGovernanceApproval: false,
  rejectionReason: null,
};

function makeActor(context: Partial<EpicLifecycleContext> = {}) {
  return createActor(epicLifecycleMachine, {
    input: { ...EMPTY_CONTEXT, ...context },
  }).start();
}

describe("epicLifecycleMachine — valid transitions", () => {
  it("starts in FUNNEL", () => {
    const actor = makeActor();
    expect(actor.getSnapshot().value).toBe("FUNNEL");
  });

  it("FUNNEL → ANALYZING on ANALYZE (no guard)", () => {
    const actor = makeActor();
    actor.send({ type: "ANALYZE" });
    expect(actor.getSnapshot().value).toBe("ANALYZING");
  });

  it("ANALYZING → PORTFOLIO_BACKLOG when investScore ≥ 40 and hypothesis ≥ 50 chars", () => {
    const actor = makeActor({
      investScore: 45,
      hypothesis:
        "This hypothesis is long enough to pass the minimum guard check",
    });
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    expect(actor.getSnapshot().value).toBe("PORTFOLIO_BACKLOG");
  });

  it("PORTFOLIO_BACKLOG → IMPLEMENTING when governance approved + budget allocated", () => {
    const actor = makeActor(FULL_CONTEXT);
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    actor.send({ type: "START_IMPLEMENTING" });
    expect(actor.getSnapshot().value).toBe("IMPLEMENTING");
  });

  it("IMPLEMENTING → DONE on COMPLETE", () => {
    const actor = makeActor(FULL_CONTEXT);
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    actor.send({ type: "START_IMPLEMENTING" });
    actor.send({ type: "COMPLETE" });
    expect(actor.getSnapshot().value).toBe("DONE");
    expect(actor.getSnapshot().status).toBe("done");
  });

  it("DONE is a terminal (final) state", () => {
    const actor = makeActor(FULL_CONTEXT);
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    actor.send({ type: "START_IMPLEMENTING" });
    actor.send({ type: "COMPLETE" });
    const snap = actor.getSnapshot();
    expect(snap.status).toBe("done");
  });
});

describe("epicLifecycleMachine — REJECT transitions", () => {
  it("FUNNEL → REJECTED with valid reason (≥ 20 chars)", () => {
    const actor = makeActor();
    actor.send({
      type: "REJECT",
      reason: "Not aligned with strategic objectives",
    });
    expect(actor.getSnapshot().value).toBe("REJECTED");
    expect(actor.getSnapshot().status).toBe("done");
  });

  it("ANALYZING → REJECTED with valid reason", () => {
    const actor = makeActor();
    actor.send({ type: "ANALYZE" });
    actor.send({
      type: "REJECT",
      reason: "INVEST score too low after analysis",
    });
    expect(actor.getSnapshot().value).toBe("REJECTED");
  });

  it("PORTFOLIO_BACKLOG → REJECTED with valid reason", () => {
    const actor = makeActor({
      investScore: 50,
      hypothesis:
        "Long enough hypothesis text to pass the guard check requirement",
    });
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    actor.send({
      type: "REJECT",
      reason: "Superseded by higher priority epic",
    });
    expect(actor.getSnapshot().value).toBe("REJECTED");
  });

  it("IMPLEMENTING → REJECTED with valid reason", () => {
    const actor = makeActor(FULL_CONTEXT);
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    actor.send({ type: "START_IMPLEMENTING" });
    actor.send({
      type: "REJECT",
      reason: "Market conditions changed significantly",
    });
    expect(actor.getSnapshot().value).toBe("REJECTED");
  });

  it("REJECT is ignored when reason is too short (< 20 chars)", () => {
    const actor = makeActor();
    actor.send({ type: "REJECT", reason: "short" });
    expect(actor.getSnapshot().value).toBe("FUNNEL");
  });

  it("REJECT is ignored when reason is empty string", () => {
    const actor = makeActor();
    actor.send({ type: "REJECT", reason: "" });
    expect(actor.getSnapshot().value).toBe("FUNNEL");
  });
});

describe("epicLifecycleMachine — guard failures stay in state", () => {
  it("ANALYZING stays when investScore < 40 (MOVE_TO_BACKLOG guard fails)", () => {
    const actor = makeActor({
      investScore: 30,
      hypothesis: "Long enough hypothesis text for guard",
    });
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    expect(actor.getSnapshot().value).toBe("ANALYZING");
  });

  it("ANALYZING stays when hypothesis too short (MOVE_TO_BACKLOG guard fails)", () => {
    const actor = makeActor({ investScore: 60, hypothesis: "short" });
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    expect(actor.getSnapshot().value).toBe("ANALYZING");
  });

  it("PORTFOLIO_BACKLOG stays when no governance approval (START_IMPLEMENTING guard fails)", () => {
    const actor = makeActor({
      investScore: 50,
      hypothesis:
        "Long enough hypothesis text to pass the guard check requirement",
      hasGovernanceApproval: false,
      leanBudgetAllocation: 5000,
    });
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    actor.send({ type: "START_IMPLEMENTING" });
    expect(actor.getSnapshot().value).toBe("PORTFOLIO_BACKLOG");
  });

  it("PORTFOLIO_BACKLOG stays when no budget allocation (START_IMPLEMENTING guard fails)", () => {
    const actor = makeActor({
      investScore: 50,
      hypothesis:
        "Long enough hypothesis text to pass the guard check requirement",
      hasGovernanceApproval: true,
      leanBudgetAllocation: null,
    });
    actor.send({ type: "ANALYZE" });
    actor.send({ type: "MOVE_TO_BACKLOG" });
    actor.send({ type: "START_IMPLEMENTING" });
    expect(actor.getSnapshot().value).toBe("PORTFOLIO_BACKLOG");
  });
});

describe("epicLifecycleMachine — invalid events are no-ops", () => {
  it("COMPLETE from FUNNEL stays in FUNNEL", () => {
    const actor = makeActor();
    actor.send({ type: "COMPLETE" });
    expect(actor.getSnapshot().value).toBe("FUNNEL");
  });

  it("MOVE_TO_BACKLOG from FUNNEL stays in FUNNEL", () => {
    const actor = makeActor();
    actor.send({ type: "MOVE_TO_BACKLOG" });
    expect(actor.getSnapshot().value).toBe("FUNNEL");
  });
});

describe("epicLifecycleMachine — ELEVATED_EVENTS set", () => {
  it("contains MOVE_TO_BACKLOG, START_IMPLEMENTING, COMPLETE", () => {
    expect(ELEVATED_EVENTS.has("MOVE_TO_BACKLOG")).toBe(true);
    expect(ELEVATED_EVENTS.has("START_IMPLEMENTING")).toBe(true);
    expect(ELEVATED_EVENTS.has("COMPLETE")).toBe(true);
  });

  it("does not contain ANALYZE or REJECT", () => {
    expect(ELEVATED_EVENTS.has("ANALYZE")).toBe(false);
    expect(ELEVATED_EVENTS.has("REJECT")).toBe(false);
  });
});
