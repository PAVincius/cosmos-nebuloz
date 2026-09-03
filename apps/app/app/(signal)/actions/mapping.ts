"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import { requireSignalPermissionContext } from "@/lib/signal/guards";
import {
  deriveMappingState,
  MAPPING_STATE_META,
  type MappingState,
} from "@/lib/signal/health";
import { nnStr, optStr } from "../../actions/_base";
import {
  type Db,
  FIELD_LABELS,
  logSignalAudit,
  nextCode,
  type SignalResult,
  signalAction,
} from "./_shared";

// Mapeamento evento → métrica — US4.
//
// Versionado, nunca sobrescrito. Mudar a transformação depois que um relatório
// saiu muda a história do número, e a trilha precisa mostrar as duas versões
// para alguém poder perguntar "com qual conta o board viu 4,2×?".
//
// A versão anterior não é apagada nem desativada: as observações que ela
// produziu continuam apontando para ela, e é isso que torna a evidência
// rastreável até a regra que a gerou.

const UpsertSchema = z.object({
  /** Ausente = mapeamento novo. Presente = versão nova do mesmo. */
  code: nnStr.optional(),
  connectionCode: nnStr,
  /** Nulo = vale para todas as iniciativas (custo de licença, base de usuários). */
  initiativeCode: nnStr.nullable().optional(),
  eventKey: nnStr,
  metricLabel: nnStr,
  transform: z.string().trim().min(3).max(2000),
  unit: nnStr,
});

const StateSchema = z.object({
  code: nnStr,
  state: z.enum(["ACTIVE", "REVIEW", "BROKEN", "STALE"]),
  note: optStr,
});

export type MappingRow = {
  code: string;
  version: number;
  connectionCode: string;
  connectionName: string;
  initiativeCode: string | null;
  eventKey: string;
  metricLabel: string;
  transform: string;
  unit: string;
  state: MappingState;
  stateLabel: string;
  stateTone: string;
  changedBy: string | null;
  changedAt: Date;
  observationCount: number;
};

/** Resolve a conexão pelo código, ou explica por que não dá para mapear. */
async function resolveConnection(db: Db, tenantId: string, code: string) {
  const connection = await db.signalConnection.findUnique({
    where: { tenantId_code: { tenantId, code } },
  });
  if (!connection) {
    throw new SignalRuleError(
      "connection.not-found",
      `Conexão ${code} não encontrada nesta organização.`
    );
  }
  return connection;
}

/** Nulo = mapeamento vale para todas as iniciativas. */
async function resolveInitiativeId(
  db: Db,
  tenantId: string,
  code: string | null | undefined
): Promise<string | null> {
  if (!code) {
    return null;
  }
  const initiative = await db.signalInitiative.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  if (!initiative) {
    throw new SignalRuleError(
      "initiative.not-found",
      `Iniciativa ${code} não encontrada nesta organização.`
    );
  }
  return initiative.id;
}

export async function listMappings(
  raw: { connectionCode?: string; initiativeCode?: string } = {}
): Promise<SignalResult<MappingRow[]>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const input = z
      .object({
        connectionCode: nnStr.optional(),
        initiativeCode: nnStr.optional(),
      })
      .parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.signalMetricMapping.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.connectionCode
            ? { connection: { code: input.connectionCode } }
            : {}),
          ...(input.initiativeCode
            ? { initiative: { code: input.initiativeCode } }
            : {}),
        },
        include: {
          connection: { select: { code: true, name: true } },
          initiative: { select: { code: true } },
          changedBy: { select: { name: true, email: true } },
          _count: { select: { observations: true } },
        },
        orderBy: [{ code: "asc" }, { version: "desc" }],
      });

      return rows.map((m) => ({
        code: m.code,
        version: m.version,
        connectionCode: m.connection.code,
        connectionName: m.connection.name,
        initiativeCode: m.initiative?.code ?? null,
        eventKey: m.eventKey,
        metricLabel: m.metricLabel,
        transform: m.transform,
        unit: m.unit,
        state: m.state,
        stateLabel: MAPPING_STATE_META[m.state].label,
        stateTone: MAPPING_STATE_META[m.state].tone,
        changedBy: m.changedBy?.name ?? m.changedBy?.email ?? null,
        changedAt: m.changedAt,
        observationCount: m._count.observations,
      }));
    });
  });
}

/** O que mudou entre a versão anterior e a nova, para a trilha. */
function versionDiff(
  latest: { version: number; transform: string },
  version: number,
  transform: string
): [string, string, string][] {
  const rows: [string, string, string][] = [
    [FIELD_LABELS.version, `v${latest.version}`, `v${version}`],
  ];
  if (latest.transform !== transform) {
    rows.push([FIELD_LABELS.transform, latest.transform, transform]);
  }
  return rows;
}

export async function upsertMapping(
  raw: z.input<typeof UpsertSchema>
): Promise<SignalResult<{ code: string; version: number }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.mapping.write");
    const input = UpsertSchema.parse(raw);

    const saved = await withTenantDb(ctx.tenantId, async (db) => {
      const connection = await resolveConnection(
        db,
        ctx.tenantId,
        input.connectionCode
      );
      const initiativeId = await resolveInitiativeId(
        db,
        ctx.tenantId,
        input.initiativeCode
      );

      const code =
        input.code ??
        (await nextCode({ db, tenantId: ctx.tenantId, kind: "mapping" }));
      const latest = await db.signalMetricMapping.findFirst({
        where: { tenantId: ctx.tenantId, code },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;

      // O estado da versão nova nasce da saúde da fonte, não copiado da
      // anterior: se a fonte caiu no meio, o mapeamento novo já nasce quebrado.
      const state = deriveMappingState(connection.health, null);

      await db.signalMetricMapping.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          connectionId: connection.id,
          initiativeId,
          eventKey: input.eventKey,
          metricLabel: input.metricLabel,
          transform: input.transform,
          unit: input.unit,
          version,
          state,
          changedById: ctx.userId,
        },
      });

      await logSignalAudit(db, ctx, {
        action: latest ? "Mapeamento versionado" : "Mapeamento criado",
        entityType: "signal.mapping",
        entityId: code,
        target: `${code} · ${input.metricLabel}`,
        note: input.transform,
        diff: latest
          ? versionDiff(latest, version, input.transform)
          : undefined,
      });

      return { code, version };
    });

    revalidatePath("/signal/mapping");
    return saved;
  });
}

export async function setMappingState(
  raw: z.input<typeof StateSchema>
): Promise<SignalResult<{ state: MappingState }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.mapping.write");
    const input = StateSchema.parse(raw);

    if (input.state === "REVIEW" && !input.note?.trim()) {
      // Contestar sem dizer o motivo transfere o problema sem transferir a
      // informação: quem for resolver não sabe o que estava errado.
      throw new SignalRuleError(
        "mapping.review.note",
        "Diga o que está sendo contestado — quem for recalcular precisa saber o que revisar."
      );
    }

    await withTenantDb(ctx.tenantId, async (db) => {
      const latest = await db.signalMetricMapping.findFirst({
        where: { tenantId: ctx.tenantId, code: input.code },
        orderBy: { version: "desc" },
        include: { connection: { select: { health: true } } },
      });
      if (!latest) {
        throw new SignalRuleError(
          "mapping.not-found",
          `Mapeamento ${input.code} não encontrado nesta organização.`
        );
      }

      // Sair de REVIEW devolve o estado à saúde da fonte, em vez de assumir
      // ACTIVE: a contestação pode ter sido resolvida enquanto a fonte caía.
      const next =
        input.state === "REVIEW"
          ? "REVIEW"
          : deriveMappingState(latest.connection.health, null);

      await db.signalMetricMapping.update({
        where: { id: latest.id },
        data: { state: next, changedById: ctx.userId, changedAt: new Date() },
      });

      await logSignalAudit(db, ctx, {
        action:
          input.state === "REVIEW"
            ? "Mapeamento contestado"
            : "Contestação encerrada",
        entityType: "signal.mapping",
        entityId: latest.id,
        target: `${latest.code} · ${latest.metricLabel}`,
        note: input.note,
        diff: [[FIELD_LABELS.state, latest.state, next]],
      });
    });

    revalidatePath("/signal/mapping");
    return { state: input.state };
  });
}
