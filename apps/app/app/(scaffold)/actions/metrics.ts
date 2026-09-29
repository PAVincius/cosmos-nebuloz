"use server";

import { withTenantDb } from "@repo/database";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import {
  computeProductMetrics,
  type ProductMetrics,
} from "@/lib/scaffold/product-metrics";

// Métricas de produto do Scaffold (SC-PM-04), para a consultora.
//
// Agregado da organização: só contagens e tempos, sem título, resumo, comentário
// nem nome de quem agiu. As consultas são do tenant da sessão. Cada número tem a
// definição em `lib/scaffold/product-metrics.ts`.

/** Teto de eventos lidos: revisão é rara perto do resto, e um tenant que passe
 *  disso já precisa de agregação no banco, não desta leitura simples. */
const MAX_EVENTS = 20_000;

export async function getProductMetrics(): Promise<
  ScaffoldResult<ProductMetrics>
> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("product.metrics");

    return withTenantDb(ctx.tenantId, async (db) => {
      const started = {
        tenantId: ctx.tenantId,
        status: { not: "NOT_STARTED" as const },
      };
      const [
        startedDeliverables,
        deliverablesWithSummary,
        events,
        tracksTotal,
        tracksFromCatalog,
      ] = await Promise.all([
        db.scaffoldDeliverableInstance.count({ where: started }),
        db.scaffoldDeliverableInstance.count({
          where: { ...started, summary: { not: null } },
        }),
        db.scaffoldDeliverableEvent.findMany({
          where: {
            tenantId: ctx.tenantId,
            action: { in: ["SUBMIT", "APPROVE", "REQUEST_ADJUSTMENT"] },
          },
          select: { deliverableId: true, action: true, createdAt: true },
          orderBy: { createdAt: "asc" },
          take: MAX_EVENTS,
        }),
        db.scaffoldTrack.count({ where: { tenantId: ctx.tenantId } }),
        db.scaffoldTrack.count({
          where: { tenantId: ctx.tenantId, sourceGapId: null },
        }),
      ]);

      return computeProductMetrics({
        startedDeliverables,
        deliverablesWithSummary,
        events: events.map((e) => ({
          deliverableId: e.deliverableId,
          action: e.action as "SUBMIT" | "APPROVE" | "REQUEST_ADJUSTMENT",
          at: e.createdAt,
        })),
        tracksTotal,
        tracksFromCatalog,
      });
    });
  });
}
