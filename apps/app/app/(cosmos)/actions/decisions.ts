"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type DecisionView = {
  id: string;
  titulo: string;
  decisao: string;
  justificativa: string;
  tipo: string;
  dataDecisao: string;
  tags: string[];
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
      },
    });
    return rows.map((d) => ({
      id: d.id,
      titulo: d.titulo ?? `${d.tipo} · ${d.targetType}`,
      decisao: d.decisao,
      justificativa: d.justificativa,
      tipo: d.tipo,
      dataDecisao: d.dataDecisao.toISOString(),
      tags: d.tags,
    }));
  });
}
