import "server-only";

import { withTenantDb } from "@repo/database";
import {
  requireScaffoldPermission,
  type ScaffoldContext,
} from "@/lib/scaffold/guards";
import { type RankedGap, rankGaps } from "./gap-ranking";
import { requireModule } from "./guards";

/**
 * Gaps abertos do tenant, ranqueados, para consumo do Scaffold na "Nova
 * trilha". Leitura apenas: o gap continua do Meridian (mapa de fronteiras,
 * entidade 6), e o Scaffold lê sem `MeridianRole`.
 *
 * Recebe `ScaffoldContext` (tipo que exige papel do Scaffold). Quem chama
 * obtém o contexto por `requireScaffoldPermissionContext("track.manage")`; a
 * permissão é conferida de novo aqui, para que a leitura não dependa de o
 * chamador lembrar. Tenant vem do contexto, nunca de parâmetro.
 *
 * Só entram gaps de diagnóstico FINALISED: rascunho, coleta e revisão ainda
 * podem mudar de enunciado, custo e confiança, e ninguém contrata trabalho em
 * cima de número provisório. Gap RESOLVIDO fica de fora: não há o que contratar.
 *
 * `statement` é texto do cliente: não vai para log nem para mensagem de erro.
 */
export async function listRankedGaps(
  ctx: ScaffoldContext
): Promise<RankedGap[]> {
  requireScaffoldPermission("track.manage", ctx);
  await requireModule("MERIDIAN", ctx);

  const rows = await withTenantDb(ctx.tenantId, (db) =>
    db.meridianGap.findMany({
      where: {
        tenantId: ctx.tenantId,
        state: { not: "RESOLVED" },
        assessment: { status: "FINALISED" },
      },
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
