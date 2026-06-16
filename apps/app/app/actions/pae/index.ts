"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import { pushNotification } from "../notifications/index";
import { can } from "../permissions";
import { CreatePAERequestSchema, type PAERequest } from "./schema";

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

export async function listPAERequests(): Promise<Result<PAERequest[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const requests = await database.accessExceptionRequest.findMany({
      where: {
        tenantId: ctx.tenantId,
        OR: [{ requesterId: ctx.userId }, { status: "PENDING" }],
      },
      orderBy: { createdAt: "desc" },
    });

    return requests as PAERequest[];
  });
}
