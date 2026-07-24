"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type DecisionView = {
  id: string;
  titulo: string;
  decisao: string;
  justificativa: string;
  tipo: string;
  dataDecisao: string;
  tags: string[];
  decisorName: string | null;
};

export async function listDecisions(): Promise<Result<DecisionView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.decisionLogEntry.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { dataDecisao: "desc" },
      select: {
        id: true,
        titulo: true,
        decisao: true,
        justificativa: true,
        tipo: true,
        targetType: true,
        dataDecisao: true,
        tags: true,
        decisorId: true,
      },
    });

    const decisorIds = [
      ...new Set(
        rows.map((r) => r.decisorId).filter((id): id is string => !!id)
      ),
    ];
    const decisors = decisorIds.length
      ? await database.user.findMany({
          where: { id: { in: decisorIds } },
          select: { id: true, name: true },
        })
      : [];
    const decisorNameById = new Map(decisors.map((u) => [u.id, u.name]));

    return rows.map((d) => ({
      id: d.id,
      titulo: d.titulo ?? `${d.tipo} · ${d.targetType}`,
      decisao: d.decisao,
      justificativa: d.justificativa,
      tipo: d.tipo,
      dataDecisao: d.dataDecisao.toISOString(),
      tags: d.tags,
      decisorName: (d.decisorId && decisorNameById.get(d.decisorId)) || null,
    }));
  });
}

// Only "epic" and "theme" are searchable via EntityLinkField (RF-94's
// allow-listed entity kinds). "guardrail" targetType exists in the schema
// comment but has no entity-search kind, so the create form does not offer
// it for now.
const CreateDecisionSchema = z.object({
  tipo: z.enum(["epic_decision", "budget_decision", "theme_decision"]),
  targetType: z.enum(["epic", "theme"]),
  targetId: z.string().min(1),
  decisao: z.enum(["approved", "rejected", "deferred", "changed"]),
  justificativa: z.string().min(1).max(4000),
  titulo: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

export async function createDecision(
  input: z.input<typeof CreateDecisionSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "STE"], ctx);
    const { tipo, targetType, targetId, decisao, justificativa, titulo, tags } =
      CreateDecisionSchema.parse(input);

    // Cross-tenant IDOR guard — client-supplied targetId must belong to this
    // tenant, scoped by the chosen targetType.
    if (targetType === "epic") {
      const epic = await database.epic.findFirst({
        where: { id: targetId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!epic) {
        throw new Error("Epic inválido.");
      }
    } else {
      const theme = await database.strategicTheme.findFirst({
        where: { id: targetId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!theme) {
        throw new Error("Tema inválido.");
      }
    }

    const created = await database.decisionLogEntry.create({
      data: {
        tenantId: ctx.tenantId,
        tipo,
        targetType,
        targetId,
        decisao,
        justificativa,
        titulo: titulo?.trim() || null,
        tags: tags ?? [],
        decisorId: ctx.userId,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "decision",
      entityId: created.id,
      diff: { tipo, targetType, targetId, decisao },
    });
    revalidateTag(`decisions:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}
