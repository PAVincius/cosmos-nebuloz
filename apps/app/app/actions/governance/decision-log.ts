import { database } from "@repo/database";

export type DecisionInput = {
  tipo: string;
  targetType: string;
  targetId: string;
  valueStreamId?: string;
  decisao: string;
  justificativa: string;
  dadosSuporte?: Record<string, unknown>;
};

export async function logDecision(
  ctx: { tenantId: string; userId: string },
  input: DecisionInput,
) {
  return database.decisionLogEntry.create({
    data: {
      tenantId: ctx.tenantId,
      tipo: input.tipo,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.valueStreamId && { valueStreamId: input.valueStreamId }),
      decisao: input.decisao,
      justificativa: input.justificativa,
      dadosSuporte: (input.dadosSuporte ?? {}) as object,
      decisorId: ctx.userId,
    },
  });
}

export async function listDecisions(
  tenantId: string,
  filter: {
    tipo?: string;
    targetType?: string;
    targetId?: string;
    from?: Date;
    to?: Date;
  } = {},
) {
  return database.decisionLogEntry.findMany({
    where: {
      tenantId,
      ...(filter.tipo && { tipo: filter.tipo }),
      ...(filter.targetType && { targetType: filter.targetType }),
      ...(filter.targetId && { targetId: filter.targetId }),
      ...(filter.from || filter.to
        ? {
            dataDecisao: {
              ...(filter.from && { gte: filter.from }),
              ...(filter.to && { lte: filter.to }),
            },
          }
        : {}),
    },
    orderBy: { dataDecisao: "desc" },
  });
}
