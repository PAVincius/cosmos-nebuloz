"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  requireSignalPermissionContext,
} from "@/lib/signal/guards";
import { isoDate, nnStr, optStr } from "../../actions/_base";
import {
  logSignalAudit,
  nextCode,
  type SignalResult,
  signalAction,
} from "./_shared";

// Evidência — US2 (entrada manual) e US4 (vinda de mapeamento).
//
// A invariante que este arquivo protege: NENHUMA observação existe sem
// referência de origem. Ou veio de um mapeamento (e a transformação está lá),
// ou alguém a lançou à mão e declarou como calculou. Um número sem origem é
// opinião com aparência de dado — e o produto inteiro existe para impedir
// exatamente isso.
//
// Não há update. Corrigir uma observação é lançar outra: a série congelada é o
// que permite dizer "em 04 de julho o número era este".

const RecordSchema = z
  .object({
    initiativeCode: nnStr,
    /** Presente = veio de fonte. Ausente = entrada manual. */
    mappingCode: nnStr.optional(),
    metricLabel: nnStr,
    value: nnStr,
    numericValue: z.coerce.number().optional(),
    unit: nnStr.optional(),
    windowStart: isoDate,
    windowEnd: isoDate,
    rowCount: z.coerce.number().int().nonnegative().optional(),
    /** Como o número foi calculado. Obrigatória na entrada manual. */
    transform: optStr,
    // Sem `source` de propósito: esta action é a entrada de PESSOA, então a
    // origem é sempre MANUAL e o autor é quem está na sessão. SYNC e IMPORT
    // são de job/sistema, nunca de um formulário.
    observedAt: isoDate.optional(),
  })
  .refine((v) => Boolean(v.mappingCode) || Boolean(v.transform?.trim()), {
    message:
      "Informe o mapeamento de origem ou descreva a transformação — observação sem origem rastreável não é evidência.",
    path: ["transform"],
  });

const ListSchema = z.object({
  initiativeCode: nnStr.optional(),
  connectionCode: nnStr.optional(),
  flaggedOnly: z.coerce.boolean().optional(),
});

export type EvidenceRow = {
  code: string;
  initiativeCode: string;
  metricLabel: string;
  value: string;
  unit: string | null;
  windowStart: Date;
  windowEnd: Date;
  rowCount: number | null;
  transform: string;
  source: string;
  connectionLabel: string | null;
  mappingCode: string | null;
  recordedBy: string | null;
  observedAt: Date;
  flag: string | null;
  frozenAt: Date | null;
};

export async function listEvidence(
  raw: z.input<typeof ListSchema> = {}
): Promise<SignalResult<EvidenceRow[]>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const input = ListSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.signalMetricObservation.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.initiativeCode
            ? { initiative: { code: input.initiativeCode } }
            : {}),
          ...(input.connectionCode
            ? { mapping: { connection: { code: input.connectionCode } } }
            : {}),
          ...(input.flaggedOnly ? { flag: { not: null } } : {}),
        },
        include: {
          initiative: { select: { code: true } },
          mapping: { select: { code: true } },
          recordedBy: { select: { name: true, email: true } },
        },
        orderBy: { observedAt: "desc" },
        take: 200,
      });

      return rows.map((r) => ({
        code: r.code,
        initiativeCode: r.initiative.code,
        metricLabel: r.metricLabel,
        value: r.value,
        unit: r.unit,
        windowStart: r.windowStart,
        windowEnd: r.windowEnd,
        rowCount: r.rowCount,
        transform: r.transform,
        source: r.source,
        connectionLabel: r.connectionLabel,
        mappingCode: r.mapping?.code ?? null,
        recordedBy: r.recordedBy?.name ?? r.recordedBy?.email ?? null,
        observedAt: r.observedAt,
        flag: r.flag,
        frozenAt: r.frozenAt,
      }));
    });
  });
}

type Origin = {
  mappingId: string | null;
  connectionLabel: string | null;
  transform: string;
};

/**
 * Resolve de onde o número veio — e recusa se não vier de lugar nenhum.
 *
 * É AQUI que a invariante do módulo mora. O `refine` do schema também a checa,
 * mas por outro motivo: lá é para o formulário avisar antes de enviar; aqui é
 * porque a action é chamável de qualquer lugar (job, import, outra action) e a
 * regra é do domínio, não do formulário.
 */
async function resolveOrigin(
  db: Parameters<Parameters<typeof withTenantDb>[1]>[0],
  tenantId: string,
  input: { mappingCode?: string; transform?: string },
  initiativeId: string
): Promise<Origin> {
  if (input.mappingCode) {
    const mapping = await db.signalMetricMapping.findFirst({
      where: { tenantId, code: input.mappingCode },
      include: { connection: { select: { name: true } } },
      orderBy: { version: "desc" },
    });
    if (!mapping) {
      throw new SignalRuleError(
        "evidence.mapping.not-found",
        `Mapeamento ${input.mappingCode} não encontrado nesta organização.`
      );
    }
    // Mapeamento global (sem iniciativa) serve a qualquer uma; o de outra
    // iniciativa não pode atribuir origem de fonte a esta.
    if (mapping.initiativeId && mapping.initiativeId !== initiativeId) {
      throw new SignalRuleError(
        "evidence.mapping.foreign",
        `O mapeamento ${input.mappingCode} é de outra iniciativa e não pode servir de origem para esta observação.`
      );
    }
    return {
      mappingId: mapping.id,
      connectionLabel: mapping.connection.name,
      // A transformação do MAPEAMENTO vence a informada no input: deixar o
      // usuário reescrevê-la faria a evidência divergir da regra que a produziu
      // — e a evidência existe justamente para provar a regra.
      transform: mapping.transform,
    };
  }

  const transform = input.transform?.trim() ?? "";
  if (!transform) {
    throw new SignalRuleError(
      "evidence.origin.required",
      "Observação sem origem rastreável não é evidência. Informe o mapeamento ou descreva a transformação."
    );
  }
  return { mappingId: null, connectionLabel: null, transform };
}

export async function recordObservation(
  raw: z.input<typeof RecordSchema>
): Promise<SignalResult<{ code: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.evidence.write");
    const input = RecordSchema.parse(raw);

    if (input.windowEnd < input.windowStart) {
      throw new SignalRuleError(
        "evidence.window",
        "A janela de observação precisa terminar depois de começar."
      );
    }

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await db.signalInitiative.findUnique({
        where: {
          tenantId_code: { tenantId: ctx.tenantId, code: input.initiativeCode },
        },
      });
      if (!initiative) {
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${input.initiativeCode} não encontrada nesta organização.`
        );
      }
      requireInitiativeOwnership(ctx, initiative);

      const origin = await resolveOrigin(
        db,
        ctx.tenantId,
        { mappingCode: input.mappingCode, transform: input.transform },
        initiative.id
      );
      const { mappingId, connectionLabel, transform } = origin;

      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "evidence",
      });

      const row = await db.signalMetricObservation.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          initiativeId: initiative.id,
          mappingId,
          connectionLabel,
          metricLabel: input.metricLabel,
          value: input.value,
          numericValue: input.numericValue,
          unit: input.unit,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          rowCount: input.rowCount,
          transform,
          source: "MANUAL",
          observedAt: input.observedAt ?? new Date(),
          // Quem registrou é sempre a pessoa da sessão: o autor não vem do
          // cliente e a linha nunca nasce sem ele.
          recordedById: ctx.userId,
        },
      });

      await logSignalAudit(db, ctx, {
        action: "Observação registrada",
        entityType: "signal.observation",
        entityId: row.id,
        target: `${code} · ${input.metricLabel} (${initiative.code})`,
        note: transform,
      });

      return row;
    });

    revalidatePath("/signal/evidence");
    revalidatePath(`/signal/initiative/${input.initiativeCode}`);
    return { code: created.code };
  });
}
