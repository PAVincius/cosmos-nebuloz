"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import {
  ELEVATED_EVENTS,
  type EpicLifecycleContext,
  type EpicLifecycleEvent,
  epicLifecycleMachine,
} from "@repo/safe-engine";
import { headers } from "next/headers";
import { createActor } from "xstate";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { type Result, safeAction } from "../_base";

const LIFECYCLE_STATES = [
  "FUNNEL",
  "ANALYZING",
  "PORTFOLIO_BACKLOG",
  "IMPLEMENTING",
  "DONE",
  "REJECTED",
] as const;

type LifecycleStatus = (typeof LIFECYCLE_STATES)[number];

const TransitionEpicSchema = z.object({
  epicId: z.string().min(1),
  event: z.enum([
    "ANALYZE",
    "MOVE_TO_BACKLOG",
    "START_IMPLEMENTING",
    "COMPLETE",
    "REJECT",
  ]),
  reason: z.string().optional(),
  userId: z.string().optional(), // null = system/AI-initiated
  externalRef: z.string().optional(),
});

export type TransitionEpicInput = z.infer<typeof TransitionEpicSchema>;

type TransitionResult = {
  epicId: string;
  fromStatus: LifecycleStatus;
  toStatus: LifecycleStatus;
};

export async function transitionEpicStatus(
  raw: unknown
): Promise<Result<TransitionResult>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = TransitionEpicSchema.parse(raw);

    // AC-007: elevated transitions require PO/SM/RTE/STE/ADMIN
    if (ELEVATED_EVENTS.has(input.event)) {
      requireRole(["PO", "SM", "RTE", "STE", "ADMIN"], ctx);
    }

    const epic = await database.epic.findFirst({
      where: { id: input.epicId, tenantId: ctx.tenantId },
      select: {
        id: true,
        lifecycleStatus: true,
        investScore: true,
        hypothesis: true,
        leanBudgetAllocation: true,
        governedEpic: { select: { governanceStatus: true } },
      },
    });

    if (!epic) {
      throw new Error("Epic not found");
    }

    const fromStatus = epic.lifecycleStatus as LifecycleStatus;

    // AC-004: terminal state blocks all transitions
    if (fromStatus === "DONE" || fromStatus === "REJECTED") {
      throw new TransitionError("TERMINAL_STATE", fromStatus);
    }

    // Reconstruct machine context from DB
    const machineContext: EpicLifecycleContext = {
      investScore: epic.investScore ?? null,
      hypothesis: epic.hypothesis ?? null,
      leanBudgetAllocation: epic.leanBudgetAllocation ?? null,
      hasGovernanceApproval: epic.governedEpic?.governanceStatus === "approved",
      rejectionReason: input.reason ?? null,
    };

    // Build the XState event
    const xstateEvent = buildEvent(input.event, input.reason);

    // Snapshot machine at current state, then test the event
    const actor = createActor(epicLifecycleMachine, {
      input: machineContext,
    });
    actor.start();

    // Fast-forward to current lifecycle state by replaying the canonical path
    fastForwardToState(actor, fromStatus);

    const snapshotBefore = actor.getSnapshot();
    actor.send(xstateEvent);
    const snapshotAfter = actor.getSnapshot();

    // If state didn't change, either invalid transition or guard failed
    if (snapshotBefore.value === snapshotAfter.value) {
      const currentValue = String(snapshotBefore.value) as LifecycleStatus;
      const isValidNextEvent = hasDefinedTransition(currentValue, input.event);
      if (!isValidNextEvent) {
        throw new TransitionError(
          "INVALID_TRANSITION",
          fromStatus,
          input.event
        );
      }
      // Guard failed
      throw new TransitionError("GUARD_FAILED", fromStatus, input.event);
    }

    const toStatus = String(snapshotAfter.value) as LifecycleStatus;

    // Persist in transaction
    await database.$transaction(async (tx) => {
      await tx.epic.update({
        where: { id: input.epicId },
        data: {
          lifecycleStatus: toStatus,
          ...(input.event === "REJECT"
            ? { rejectionReason: input.reason }
            : {}),
        },
      });

      await tx.stateTransitionHistory.create({
        data: {
          tenantId: ctx.tenantId,
          entityType: "Epic",
          entityId: input.epicId,
          fromStatus,
          toStatus,
          userId: input.userId ?? ctx.userId,
          reason: input.reason ?? null,
          externalRef: input.externalRef ?? null,
        },
      });
    });

    // Fire-and-forget: downstream handlers (INVEST recalc, notifications, etc.)
    await inngest.send({
      name: "epic/status.changed",
      data: {
        tenantId: ctx.tenantId,
        epicId: input.epicId,
        fromStatus,
        toStatus,
        userId: input.userId ?? ctx.userId,
        reason: input.reason ?? null,
      },
    });

    return { epicId: input.epicId, fromStatus, toStatus };
  });
}

type SystemTransitionInput = {
  epicId: string;
  event: EpicLifecycleEvent["type"];
  reason: string;
  externalRef?: string;
};

// For system/AI-initiated transitions (Inngest jobs); userId is omitted → null in DB
export async function transitionEpicStatusSystem(
  input: SystemTransitionInput
): Promise<Result<TransitionResult>> {
  return transitionEpicStatus({
    epicId: input.epicId,
    event: input.event,
    reason: input.reason,
    userId: undefined,
    externalRef: input.externalRef,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

class TransitionError extends Error {
  readonly transitionCode: string;
  readonly fromStatus: string;
  readonly event?: string;

  constructor(code: string, fromStatus: string, event?: string) {
    super(code);
    this.transitionCode = code;
    this.fromStatus = fromStatus;
    this.event = event;
  }
}

function buildEvent(
  event: TransitionEpicInput["event"],
  reason?: string
): EpicLifecycleEvent {
  if (event === "REJECT") {
    return { type: "REJECT", reason: reason ?? "" };
  }
  return { type: event } as EpicLifecycleEvent;
}

// Valid event set per state — used to distinguish INVALID_TRANSITION vs GUARD_FAILED
const STATE_VALID_EVENTS: Record<LifecycleStatus, string[]> = {
  FUNNEL: ["ANALYZE", "REJECT"],
  ANALYZING: ["MOVE_TO_BACKLOG", "REJECT"],
  PORTFOLIO_BACKLOG: ["START_IMPLEMENTING", "REJECT"],
  IMPLEMENTING: ["COMPLETE", "REJECT"],
  DONE: [],
  REJECTED: [],
};

function hasDefinedTransition(state: LifecycleStatus, event: string): boolean {
  return STATE_VALID_EVENTS[state]?.includes(event) ?? false;
}

// Fast-forward the actor to the given state by sending canonical events.
// FUNNEL is the initial state — no events needed.
// For other states we send a deterministic sequence without guard requirements.
const FAST_FORWARD_PATH: Record<LifecycleStatus, EpicLifecycleEvent[]> = {
  FUNNEL: [],
  ANALYZING: [{ type: "ANALYZE" }],
  PORTFOLIO_BACKLOG: [{ type: "ANALYZE" }, { type: "MOVE_TO_BACKLOG" }],
  IMPLEMENTING: [
    { type: "ANALYZE" },
    { type: "MOVE_TO_BACKLOG" },
    { type: "START_IMPLEMENTING" },
  ],
  DONE: [
    { type: "ANALYZE" },
    { type: "MOVE_TO_BACKLOG" },
    { type: "START_IMPLEMENTING" },
    { type: "COMPLETE" },
  ],
  REJECTED: [
    { type: "REJECT", reason: "fast-forward-placeholder-reason-for-state" },
  ],
};

function fastForwardToState(
  actor: ReturnType<typeof createActor>,
  target: LifecycleStatus
): void {
  const path = FAST_FORWARD_PATH[target];
  for (const event of path) {
    actor.send(event);
  }
}
