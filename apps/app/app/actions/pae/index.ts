"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import { pushNotification } from "../notifications/index";
import { can } from "../permissions";
import {
  CreatePAERequestSchema,
  durationToMs,
  type PAEDuration,
  type PAERequest,
  ResolvePAERequestSchema,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Maps known entity types to their Prisma table accessor
const ENTITY_TABLE_MAP: Record<string, keyof typeof database> = {
  epic: "epic",
  feature: "feature",
  story: "story",
};

async function resolveApprovers(
  tenantId: string,
  entityType: string,
  action: string,
  targetEntityId: string | null
): Promise<string[]> {
  // Owner-first: if target entity provided, notify its creator
  if (targetEntityId) {
    const tableKey = ENTITY_TABLE_MAP[entityType.toLowerCase()];
    if (tableKey) {
      const table = database[tableKey] as unknown as {
        findFirst: (args: {
          where: { id: string; tenantId: string };
          select: { createdBy: boolean };
        }) => Promise<{ createdBy: string | null } | null>;
      };
      const entity = await table
        .findFirst({
          where: { id: targetEntityId, tenantId },
          select: { createdBy: true },
        })
        .catch(() => null);

      if (entity?.createdBy) {
        const member = await database.tenantMember.findFirst({
          where: { tenantId, userId: entity.createdBy },
          select: { userId: true, role: true },
        });
        if (
          member &&
          can(
            member.role as Parameters<typeof can>[0],
            entityType as Parameters<typeof can>[1],
            action as Parameters<typeof can>[2]
          )
        ) {
          return [member.userId];
        }
      }
    }
  }

  // Fallback: broadcast to all qualifying tenant members
  const members = await database.tenantMember.findMany({
    where: { tenantId },
    select: { userId: true, role: true },
  });
  return members
    .filter((m) =>
      can(
        m.role as Parameters<typeof can>[0],
        entityType as Parameters<typeof can>[1],
        action as Parameters<typeof can>[2]
      )
    )
    .map((m) => m.userId);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createPAERequest(
  raw: unknown
): Promise<Result<PAERequest>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreatePAERequestSchema.parse(raw);

    const duplicate = await database.accessExceptionRequest.findFirst({
      where: {
        tenantId: ctx.tenantId,
        requesterId: ctx.userId,
        entityType: data.entityType,
        action: data.action,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error(
        "Já existe uma solicitação pendente para essa ação. Aguarde a decisão."
      );
    }

    const request = await database.accessExceptionRequest.create({
      data: {
        tenantId: ctx.tenantId,
        requesterId: ctx.userId,
        entityType: data.entityType,
        action: data.action,
        targetEntityId: data.targetEntityId ?? null,
        justification: data.justification ?? null,
        duration: data.duration,
        status: "PENDING",
      },
    });

    const approverIds = await resolveApprovers(
      ctx.tenantId,
      data.entityType,
      data.action,
      data.targetEntityId ?? null
    );
    for (const userId of approverIds) {
      pushNotification(ctx.tenantId, {
        userId,
        type: "pae_request",
        title: `Solicitação de acesso: ${data.action} ${data.entityType}`,
        body: data.justification ?? undefined,
        metadata: {
          paeRequestId: request.id,
          entityType: data.entityType,
          action: data.action,
          duration: data.duration,
        },
      }).catch(() => null);
    }

    return request as PAERequest;
  });
}

const APPROVER_ROLES = new Set(["ADMIN", "RTE", "SM", "PO", "STE"]);

export async function listPAERequests(): Promise<Result<PAERequest[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const isApprover = APPROVER_ROLES.has(ctx.role);

    const requests = await database.accessExceptionRequest.findMany({
      where: {
        tenantId: ctx.tenantId,
        OR: [
          { requesterId: ctx.userId },
          ...(isApprover
            ? [{ tenantId: ctx.tenantId, status: "PENDING" as const }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return requests as PAERequest[];
  });
}

export async function approvePAERequest(
  raw: unknown
): Promise<Result<PAERequest>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { id } = ResolvePAERequestSchema.parse(raw);

    const req = await database.accessExceptionRequest.findUnique({
      where: { id },
    });
    if (!req || req.tenantId !== ctx.tenantId) {
      throw new Error("Solicitação não encontrada.");
    }
    if (req.status !== "PENDING") {
      throw new Error("Solicitação não está pendente.");
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + durationToMs(req.duration as PAEDuration)
    );

    const updated = await database.accessExceptionRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approverId: ctx.userId,
        approvedAt: now,
        expiresAt,
      },
    });

    pushNotification(ctx.tenantId, {
      userId: req.requesterId,
      type: "pae_approved",
      title: `Acesso aprovado: ${req.action} ${req.entityType} por ${req.duration}`,
      metadata: {
        paeRequestId: id,
        entityType: req.entityType,
        action: req.action,
        duration: req.duration,
      },
    }).catch(() => null);

    return updated as PAERequest;
  });
}

export async function denyPAERequest(
  raw: unknown
): Promise<Result<PAERequest>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { id } = ResolvePAERequestSchema.parse(raw);

    const req = await database.accessExceptionRequest.findUnique({
      where: { id },
    });
    if (!req || req.tenantId !== ctx.tenantId) {
      throw new Error("Solicitação não encontrada.");
    }
    if (req.status !== "PENDING") {
      throw new Error("Solicitação não está pendente.");
    }

    const updated = await database.accessExceptionRequest.update({
      where: { id },
      data: {
        status: "DENIED",
        approverId: ctx.userId,
        approvedAt: new Date(),
      },
    });

    pushNotification(ctx.tenantId, {
      userId: req.requesterId,
      type: "pae_denied",
      title: `Acesso negado: ${req.action} ${req.entityType}`,
      metadata: {
        paeRequestId: id,
        entityType: req.entityType,
        action: req.action,
      },
    }).catch(() => null);

    return updated as PAERequest;
  });
}

export async function revokePAEGrant(
  raw: unknown
): Promise<Result<PAERequest>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { id } = ResolvePAERequestSchema.parse(raw);

    const req = await database.accessExceptionRequest.findUnique({
      where: { id },
    });
    if (!req || req.tenantId !== ctx.tenantId) {
      throw new Error("Grant não encontrado.");
    }
    if (req.status !== "APPROVED") {
      throw new Error("Só é possível revogar grants ativos.");
    }
    if (req.approverId !== ctx.userId && ctx.role !== "ADMIN") {
      throw new Error("Sem permissão para revogar este grant.");
    }

    const updated = await database.accessExceptionRequest.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    return updated as PAERequest;
  });
}
