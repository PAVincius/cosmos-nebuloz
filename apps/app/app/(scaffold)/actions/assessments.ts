"use server";

import { withTenantDb } from "@repo/database";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import {
  type AssessmentOption,
  hasFullScoring,
} from "@/lib/scaffold/assessment-options";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";

// Assessments do Meridian para a "Nova trilha" de prontidão (D-27).
//
// O diagnóstico é do Meridian (mapa de fronteiras): o Scaffold só lê. A leitura
// pede `track.manage`, a mesma permissão de criar a trilha, e o tenant vem da
// sessão. Só volta o que tem pontuação nos cinco eixos, e só o que o seletor
// mostra — nenhum score sai daqui.

const LIMIT = 50;

export async function listScaffoldAssessments(): Promise<
  ScaffoldResult<AssessmentOption[]>
> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("track.manage");
    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.meridianAssessment.findMany({
        // Coleta fechada e score calculado: REVIEW ou FINALISED. Não só FINALISED:
        // nenhum caminho do produto grava FINALISED hoje (só o seed), e exigir
        // isso travaria toda trilha real.
        where: {
          tenantId: ctx.tenantId,
          status: { in: ["REVIEW", "FINALISED"] },
        },
        orderBy: { openedAt: "desc" },
        take: LIMIT,
        select: {
          id: true,
          code: true,
          orgName: true,
          status: true,
          openedAt: true,
          closedAt: true,
          scores: { select: { axis: true } },
        },
      });
      return rows
        .filter((r) => hasFullScoring(r.scores.map((s) => s.axis)))
        .map((r) => ({
          id: r.id,
          code: r.code,
          orgName: r.orgName,
          status: r.status,
          date: r.closedAt ?? r.openedAt,
        }));
    });
  });
}
