import "server-only";

import type { TenantContext } from "@repo/auth/server";
import { withTenantDb } from "@repo/database";
import { type RankedGap, rankGaps } from "./gap-ranking";
import { requireModule } from "./guards";

/**
 * Gaps abertos do tenant, ranqueados, para consumo do Scaffold na "Nova
 * trilha". Leitura apenas: o gap continua do Meridian (mapa de fronteiras,
 * entidade 6).
 *
 * O chamador já autenticou a sessão (`requireTenantSession`) e passa o
 * contexto; aqui se confere só o módulo Meridian contratado, não o papel de
 * diagnóstico — o Scaffold lê com o próprio papel. Tenant vem do contexto,
 * nunca de parâmetro. Gap RESOLVIDO fica de fora: não há o que contratar.
 */
export async function listRankedGaps(ctx: TenantContext): Promise<RankedGap[]> {
  await requireModule("MERIDIAN", ctx);

  const rows = await withTenantDb(ctx.tenantId, (db) =>
    db.meridianGap.findMany({
      where: { tenantId: ctx.tenantId, state: { not: "RESOLVED" } },
      select: {
        id: true,
        code: true,
        assessmentId: true,
        assessment: { select: { code: true } },
        axis: true,
        statement: true,
        severity: true,
        effort: true,
        costOfDelay: true,
        confidence: true,
        state: true,
        promotions: {
          where: { revokedAt: null },
          orderBy: { promotedAt: "desc" },
          take: 1,
          select: { id: true, targetProduct: true, targetEntityId: true },
        },
      },
    })
  );

  return rankGaps(
    rows.map(({ assessment, promotions, ...gap }) => ({
      ...gap,
      assessmentCode: assessment.code,
      promotion: promotions[0] ?? null,
    }))
  );
}
