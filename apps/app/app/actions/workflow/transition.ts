"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import type { MachineConfig } from "@/lib/bpmn/compiler";

export type GuardContext = {
  assignees?: string[];
  [key: string]: unknown;
};

export type TransitionResult =
  | { ok: true; newState: string }
  | { ok: false; code: "WORKFLOW_GUARD_FAILED"; guard: string }
  | { ok: false; code: "NO_ACTIVE_WORKFLOW" }
  | { ok: false; code: "INVALID_TRANSITION"; message: string };

// ─── Built-in guards ──────────────────────────────────────────────────────────

type GuardFn = (ctx: GuardContext) => boolean;

const GUARDS: Record<string, GuardFn> = {
  hasAssignee: (ctx) =>
    Array.isArray(ctx.assignees) && ctx.assignees.length > 0,
  approved: () => true, // condition-based — evaluated by caller
  rejected: () => true,
};

function evaluateGuard(guardName: string, ctx: GuardContext): boolean {
  const fn = GUARDS[guardName];
  return fn ? fn(ctx) : true; // unknown guards pass by default
}

// ─── Transition ───────────────────────────────────────────────────────────────

export async function transitionWorkflowState(
  entityType: "story" | "feature",
  entityId: string,
  event: string,
  guardContext: GuardContext = {}
): Promise<TransitionResult> {
  const ctx = await requireTenantSession(await headers());

  // Load entity
  let currentState: string | null = null;
  let currentVersion: number | null = null;
  let ownerId: string | null = null;

  if (entityType === "story") {
    const story = await database.story.findFirstOrThrow({
      where: { id: entityId, tenantId: ctx.tenantId },
      select: {
        workflowState: true,
        workflowVersion: true,
        featureId: true,
        tenantId: true,
      },
    });
    currentState = story.workflowState;
    currentVersion = story.workflowVersion;
    ownerId = story.featureId ?? entityId;
  } else {
    const feature = await database.feature.findFirstOrThrow({
      where: { id: entityId, tenantId: ctx.tenantId },
      select: {
        workflowState: true,
        workflowVersion: true,
        assignedTeamId: true,
      },
    });
    currentState = feature.workflowState;
    currentVersion = feature.workflowVersion;
    ownerId = feature.assignedTeamId ?? entityId;
  }

  if (!currentState) {
    return { ok: false, code: "NO_ACTIVE_WORKFLOW" };
  }

  // Load compiled machine from active BpmnDefinition
  const bpmnDef = await database.bpmnDefinition.findFirst({
    where: {
      tenantId: ctx.tenantId,
      ownerId: ownerId ?? entityId,
      active: true,
    },
    select: { id: true, compiledMachine: true, version: true },
  });

  if (!bpmnDef?.compiledMachine) {
    return { ok: false, code: "NO_ACTIVE_WORKFLOW" };
  }

  const machine = bpmnDef.compiledMachine as MachineConfig;
  const stateConfig = machine.states[currentState];

  if (!stateConfig || stateConfig.type === "final") {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `State "${currentState}" has no transitions`,
    };
  }

  const transition = stateConfig.on?.[event];
  if (!transition) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `No transition "${event}" from state "${currentState}"`,
    };
  }

  // Guard check
  if (transition.guard) {
    const passed = evaluateGuard(transition.guard, guardContext);
    if (!passed) {
      return {
        ok: false,
        code: "WORKFLOW_GUARD_FAILED",
        guard: transition.guard,
      };
    }
  }

  const newState = transition.target;

  // Persist
  if (entityType === "story") {
    await database.story.update({
      where: { id: entityId },
      data: { workflowState: newState, workflowVersion: currentVersion },
    });
  } else {
    await database.feature.update({
      where: { id: entityId },
      data: { workflowState: newState, workflowVersion: currentVersion },
    });
  }

  // Write StateTransitionHistory
  await database.stateTransitionHistory.create({
    data: {
      tenantId: ctx.tenantId,
      entityId,
      entityType: entityType === "story" ? "Story" : "Feature",
      fromStatus: currentState,
      toStatus: newState,
      userId: ctx.userId,
    },
  });

  return { ok: true, newState };
}

// Initialize workflow state when activating a definition on an entity
export async function initWorkflowState(
  entityType: "story" | "feature",
  entityId: string,
  bpmnDefinitionId: string
): Promise<void> {
  const ctx = await requireTenantSession(await headers());

  const def = await database.bpmnDefinition.findFirstOrThrow({
    where: { id: bpmnDefinitionId, tenantId: ctx.tenantId },
    select: { compiledMachine: true, version: true, xmlGzip: true },
  });

  const machine = def.compiledMachine as MachineConfig | null;
  if (!machine) {
    throw new Error("BpmnDefinition has no compiled machine");
  }

  const initialState = machine.initial;

  if (entityType === "story") {
    await database.story.update({
      where: { id: entityId },
      data: { workflowState: initialState, workflowVersion: def.version },
    });
  } else {
    await database.feature.update({
      where: { id: entityId },
      data: { workflowState: initialState, workflowVersion: def.version },
    });
  }
}
