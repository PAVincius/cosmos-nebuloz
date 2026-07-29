"use server";

// entity-search.ts — generic tenant-scoped entity search across a small
// allow-listed set of models (RF-94). Backs EntityLinkField: read-only,
// case-insensitive, capped at 10 results. No mutation, so no requireRole /
// logAudit / cache invalidation is needed here.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { EntityKind } from "./entity-search.constants";

export type EntityOption = { id: string; label: string };

const SearchEntitiesSchema = z.object({
  kind: EntityKind,
  query: z.string().max(200),
});

export async function searchEntities(
  kind: EntityKind,
  query: string
): Promise<Result<EntityOption[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const parsed = SearchEntitiesSchema.parse({ kind, query });
    const contains = { contains: parsed.query, mode: "insensitive" as const };

    switch (parsed.kind) {
      case "epic": {
        const rows = await database.epic.findMany({
          where: { tenantId: ctx.tenantId, title: contains },
          take: 10,
          select: { id: true, title: true },
        });
        return rows.map((r) => ({ id: r.id, label: r.title }));
      }
      case "feature": {
        const rows = await database.feature.findMany({
          where: { tenantId: ctx.tenantId, title: contains },
          take: 10,
          select: { id: true, title: true },
        });
        return rows.map((r) => ({ id: r.id, label: r.title }));
      }
      case "team": {
        const rows = await database.team.findMany({
          where: { tenantId: ctx.tenantId, name: contains },
          take: 10,
          select: { id: true, name: true },
        });
        return rows.map((r) => ({ id: r.id, label: r.name }));
      }
      case "theme": {
        const rows = await database.strategicTheme.findMany({
          where: { tenantId: ctx.tenantId, title: contains },
          take: 10,
          select: { id: true, title: true },
        });
        return rows.map((r) => ({ id: r.id, label: r.title }));
      }
      case "art": {
        const rows = await database.aRT.findMany({
          where: { tenantId: ctx.tenantId, name: contains },
          take: 10,
          select: { id: true, name: true },
        });
        return rows.map((r) => ({ id: r.id, label: r.name }));
      }
      case "solutionTrain": {
        const rows = await database.solutionTrain.findMany({
          where: { tenantId: ctx.tenantId, name: contains },
          take: 10,
          select: { id: true, name: true },
        });
        return rows.map((r) => ({ id: r.id, label: r.name }));
      }
      default: {
        // exhaustiveness guard — EntityKind covers all cases above
        const _exhaustive: never = parsed.kind;
        throw new Error(`Tipo de entidade desconhecido: ${_exhaustive}`);
      }
    }
  });
}
