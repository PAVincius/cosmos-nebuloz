"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { applyVoteEvent, type ConfidenceVoteEvent } from "@repo/safe-engine";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { SendVoteEventSchema } from "../schemas";

// ─── PISession ─────────────────────────────────────────────────────────────
// Uma PISession = cerimônia de PI Planning (PLANNING original ou REPLAN)
// Cada sessão tem N rodadas de Confidence Vote

export async function getOrCreatePISession(piPlanId: string) {
  const ctx = await requireTenantSession(await headers());

  const existing = await database.pISession.findFirst({
    where: { piPlanId, tenantId: ctx.tenantId, type: "PLANNING" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    return existing;
  }

  return database.pISession.create({
    data: { tenantId: ctx.tenantId, piPlanId, type: "PLANNING" },
  });
}

export async function getAllPISessions(piPlanId: string) {
  const ctx = await requireTenantSession(await headers());
  return database.pISession.findMany({
    where: { piPlanId, tenantId: ctx.tenantId },
    include: {
      confidenceSessions: { orderBy: { roundNumber: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createReplanSession(piPlanId: string) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN", "STE", "RTE"], ctx);

  const pi = await database.pIPlan.findFirst({
    where: { id: piPlanId, tenantId: ctx.tenantId },
    include: { art: true },
  });
  if (!pi) {
    throw new Error("PI não encontrado.");
  }

  const session = await database.pISession.create({
    data: { tenantId: ctx.tenantId, piPlanId, type: "REPLAN" },
  });

  revalidatePath(`/arts/${pi.art.id}/pi-planning`);
  return session;
}

// ─── Vote rounds ───────────────────────────────────────────────────────────

export async function getOrCreateVoteRound(piSessionId: string) {
  const ctx = await requireTenantSession(await headers());

  const existing = await database.confidenceVoteSession.findFirst({
    where: { piSessionId, tenantId: ctx.tenantId },
    orderBy: { roundNumber: "desc" },
  });
  if (existing) {
    return existing;
  }

  return database.confidenceVoteSession.create({
    data: {
      tenantId: ctx.tenantId,
      piSessionId,
      roundNumber: 1,
      xStateStatus: "NOT_STARTED",
      votes: [],
    },
  });
}

export async function getAllVoteRounds(piSessionId: string) {
  const ctx = await requireTenantSession(await headers());
  return database.confidenceVoteSession.findMany({
    where: { piSessionId, tenantId: ctx.tenantId },
    orderBy: { roundNumber: "asc" },
  });
}

export async function createNewVoteRound(piSessionId: string) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN", "STE", "RTE"], ctx);

  const latest = await database.confidenceVoteSession.findFirst({
    where: { piSessionId, tenantId: ctx.tenantId },
    orderBy: { roundNumber: "desc" },
  });

  if (!latest) {
    throw new Error("Inicie a Rodada 1 primeiro.");
  }
  if (!["REWORK", "APPROVED"].includes(latest.xStateStatus)) {
    throw new Error(
      `Nova rodada só após REWORK ou APPROVED. Estado atual: ${latest.xStateStatus}`
    );
  }

  return database.confidenceVoteSession.create({
    data: {
      tenantId: ctx.tenantId,
      piSessionId,
      roundNumber: latest.roundNumber + 1,
      xStateStatus: "NOT_STARTED",
      votes: [],
    },
  });
}

// ─── Vote event ────────────────────────────────────────────────────────────

export async function sendVoteEvent(
  sessionId: string,
  event: ConfidenceVoteEvent
) {
  const ctx = await requireTenantSession(await headers());
  const validated = SendVoteEventSchema.parse({ sessionId, event });

  const privilegedEvents = [
    "APPROVE_PI",
    "REQUIRE_REWORK",
    "START_VOTING",
    "CLOSE_VOTING",
  ];
  if (privilegedEvents.includes(validated.event.type)) {
    requireRole(["ADMIN", "STE", "RTE"], ctx);
  }

  const session = await database.confidenceVoteSession.findFirst({
    where: { id: validated.sessionId, tenantId: ctx.tenantId },
    include: { piSession: { include: { piPlan: { include: { art: true } } } } },
  });
  if (!session) {
    throw new Error("Rodada de votação não encontrada.");
  }

  const next = applyVoteEvent(
    { xStateStatus: session.xStateStatus, votes: session.votes as number[] },
    validated.event
  );
  if (!next) {
    throw new Error(
      `Transição inválida: "${validated.event.type}" em "${session.xStateStatus}"`
    );
  }

  const updated = await database.confidenceVoteSession.update({
    where: { id: validated.sessionId },
    data: { xStateStatus: next.xStateStatus, votes: next.votes },
  });

  revalidatePath(`/arts/${session.piSession.piPlan.art.id}/pi-planning`);
  return updated;
}

// ─── Legacy compat ─────────────────────────────────────────────────────────
// Mantido para não quebrar imports existentes

/** @deprecated use getOrCreatePISession + getOrCreateVoteRound */
export async function getOrCreateVoteSession(piPlanId: string) {
  const piSession = await getOrCreatePISession(piPlanId);
  return getOrCreateVoteRound(piSession.id);
}
