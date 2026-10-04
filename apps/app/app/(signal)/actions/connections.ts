"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import { requireSignalPermissionContext } from "@/lib/signal/guards";
import {
  type ConnHealth,
  deriveHealth,
  deriveMappingState,
  describeImpact,
  HEALTH_META,
} from "@/lib/signal/health";
import { nnStr, optStr } from "../../actions/_base";
import {
  type Db,
  FIELD_LABELS,
  logSignalAudit,
  logSignalSystemAudit,
  nextCode,
  requireSignalMember,
  type SignalResult,
  signalAction,
} from "./_shared";

// Conexões — US4.
//
// O coração deste arquivo é `recordSync`: quando uma fonte cai, a queda tem de
// PROPAGAR na mesma transação — mapeamentos quebram, observações abertas ganham
// ressalva e congelam, alerta abre. Fazer isso em passos separados deixaria uma
// janela em que o painel mostra a fonte vermelha e o número dela verde, que é
// pior do que não mostrar nada: sugere que alguém já conferiu.

const UpsertSchema = z.object({
  /** Ausente = criação. */
  code: nnStr.optional(),
  name: nnStr,
  kind: nnStr,
  icon: nnStr.optional(),
  expectedFreqMinutes: z.coerce.number().int().positive().nullable().optional(),
  ownerId: nnStr.optional(),
});

const SyncSchema = z.object({
  code: nnStr,
  ok: z.coerce.boolean(),
  rowsLabel: optStr,
  /** Obrigatório quando `ok` é falso — e tem de dizer o CONSERTO. */
  error: optStr,
});

export type ConnectionRow = {
  code: string;
  name: string;
  kind: string;
  icon: string | null;
  health: ConnHealth;
  healthLabel: string;
  healthTone: string;
  lastSyncAt: Date | null;
  expectedFreqMinutes: number | null;
  rowsLabel: string | null;
  owner: string | null;
  errorMessage: string | null;
  impactNote: string | null;
  /** Iniciativas que dependem desta fonte, via mapeamento. */
  feeds: string[];
  mappingCount: number;
};

export async function listConnections(): Promise<
  SignalResult<ConnectionRow[]>
> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.signalConnection.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          owner: { select: { name: true, email: true } },
          mappings: {
            select: { initiative: { select: { code: true } } },
          },
        },
        orderBy: [{ health: "desc" }, { code: "asc" }],
      });

      return rows.map((c) => ({
        code: c.code,
        name: c.name,
        kind: c.kind,
        icon: c.icon,
        health: c.health,
        healthLabel: HEALTH_META[c.health].label,
        healthTone: HEALTH_META[c.health].tone,
        lastSyncAt: c.lastSyncAt,
        expectedFreqMinutes: c.expectedFreqMinutes,
        rowsLabel: c.rowsLabel,
        owner: c.owner?.name ?? c.owner?.email ?? null,
        errorMessage: c.errorMessage,
        impactNote: c.impactNote,
        feeds: [
          ...new Set(
            c.mappings
              .map((m) => m.initiative?.code)
              .filter((code): code is string => Boolean(code))
          ),
        ].sort(),
        mappingCount: c.mappings.length,
      }));
    });
  });
}

export async function upsertConnection(
  raw: z.input<typeof UpsertSchema>
): Promise<SignalResult<{ code: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.connection.write");
    const input = UpsertSchema.parse(raw);

    const saved = await withTenantDb(ctx.tenantId, async (db) => {
      if (input.ownerId) {
        await requireSignalMember(db, ctx.tenantId, input.ownerId);
      }
      if (input.code) {
        const before = await db.signalConnection.findUnique({
          where: {
            tenantId_code: { tenantId: ctx.tenantId, code: input.code },
          },
        });
        if (!before) {
          throw new SignalRuleError(
            "connection.not-found",
            `Conexão ${input.code} não encontrada nesta organização.`
          );
        }
        await db.signalConnection.update({
          where: { id: before.id },
          data: {
            name: input.name,
            kind: input.kind,
            icon: input.icon,
            expectedFreqMinutes: input.expectedFreqMinutes,
            ownerId: input.ownerId,
            updatedBy: ctx.userId,
          },
        });
        await logSignalAudit(db, ctx, {
          action: "Conexão editada",
          entityType: "signal.connection",
          entityId: before.id,
          target: `${before.code} · ${input.name}`,
        });
        return { code: before.code };
      }

      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "connection",
      });
      const created = await db.signalConnection.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          name: input.name,
          kind: input.kind,
          icon: input.icon,
          expectedFreqMinutes: input.expectedFreqMinutes,
          ownerId: input.ownerId,
          // Nasce saudável e sem sync: `recomputeHealth` a marcará atrasada
          // quando o prazo passar, e é isso que queremos — não fingir que uma
          // fonte recém-criada já entregou dado.
          health: "HEALTHY",
          updatedBy: ctx.userId,
        },
      });
      await logSignalAudit(db, ctx, {
        action: "Conexão criada",
        entityType: "signal.connection",
        entityId: created.id,
        target: `${code} · ${input.name}`,
      });
      return { code };
    });

    revalidatePath("/signal/connections");
    return saved;
  });
}

/**
 * Propaga uma queda de fonte para tudo que depende dela.
 *
 * Roda DENTRO da transação de `recordSync`. Se qualquer passo falhar, nada
 * acontece — e é isso que impede a janela em que o painel mostra a fonte
 * vermelha e o número dela verde.
 */
async function propagateOutage(
  db: Db,
  ctx: { tenantId: string; userId: string },
  connection: { id: string; code: string; name: string },
  health: ConnHealth
): Promise<string | null> {
  const mappings = await db.signalMetricMapping.findMany({
    where: { tenantId: ctx.tenantId, connectionId: connection.id },
    include: { initiative: { select: { id: true, code: true } } },
  });

  for (const m of mappings) {
    const next = deriveMappingState(health, m.state);
    if (next !== m.state) {
      await db.signalMetricMapping.update({
        where: { id: m.id },
        data: { state: next },
      });
    }
  }

  if (health === "HEALTHY") {
    return null;
  }

  const frozenAt = new Date();
  const flag =
    health === "DOWN"
      ? `Congelada — fonte ${connection.name} desconectada em ${frozenAt.toLocaleDateString("pt-BR")}`
      : `Fonte ${connection.name} atrasada desde ${frozenAt.toLocaleDateString("pt-BR")}`;

  // Observações abertas (não congeladas) da fonte ganham a ressalva. As já
  // congeladas ficam como estão: a data do primeiro congelamento é o que
  // responde "até quando este número valeu".
  const mappingIds = mappings.map((m) => m.id);
  if (mappingIds.length > 0) {
    await db.signalMetricObservation.updateMany({
      where: {
        tenantId: ctx.tenantId,
        mappingId: { in: mappingIds },
        frozenAt: null,
      },
      data: { flag, frozenAt },
    });
  }

  return describeImpact(
    mappings.map((m) => ({
      metricLabel: m.metricLabel,
      initiativeCode: m.initiative?.code ?? "todas",
    })),
    frozenAt
  );
}

/** Carrega a conexão pelo código, ou diz que ela não existe aqui. */
async function loadConnection(db: Db, tenantId: string, code: string) {
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

/**
 * O que um sync bem ou malsucedido deixa na conexão.
 *
 * Numa falha o `rowsLabel` anterior é APAGADO: manter "12.480 tickets" ao lado
 * de "desconectada" faria o painel sugerir que o número ainda vale.
 */
function syncOutcome(
  input: { ok: boolean; error?: string | null; rowsLabel?: string | null },
  before: { rowsLabel: string | null }
): { errorMessage: string | null; rowsLabel: string | null; action: string } {
  if (input.ok) {
    return {
      errorMessage: null,
      rowsLabel: input.rowsLabel ?? before.rowsLabel,
      action: "Sync registrado",
    };
  }
  return {
    errorMessage: input.error?.trim() ?? null,
    rowsLabel: null,
    action: "Falha de sync registrada",
  };
}

export async function recordSync(
  raw: z.input<typeof SyncSchema>
): Promise<SignalResult<{ health: ConnHealth }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.connection.write");
    const input = SyncSchema.parse(raw);

    if (!(input.ok || input.error?.trim())) {
      // Falha sem mensagem é um alerta que ninguém sabe resolver. O texto tem
      // de dizer o conserto, não o sintoma.
      throw new SignalRuleError(
        "connection.error.required",
        "Registre o que falhou e como consertar — um alerta sem conserto vira ruído na fila."
      );
    }

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const before = await loadConnection(db, ctx.tenantId, input.code);
      const settings = await db.signalSettings.findUnique({
        where: { tenantId: ctx.tenantId },
      });
      const now = new Date();
      const { errorMessage, rowsLabel, action } = syncOutcome(input, before);
      const health = deriveHealth({
        lastSyncAt: now,
        expectedFreqMinutes: before.expectedFreqMinutes,
        errorMessage,
        staleHours: settings?.staleHours ?? 48,
        now,
      });

      const impactNote = await propagateOutage(
        db,
        ctx,
        { id: before.id, code: before.code, name: before.name },
        health
      );

      await db.signalConnection.update({
        where: { id: before.id },
        data: {
          // O relógio avança mesmo na falha: `lastSyncAt` é "última TENTATIVA",
          // e é o que diz há quanto tempo o sistema está batendo na porta.
          lastSyncAt: now,
          health,
          errorMessage,
          impactNote,
          rowsLabel,
          updatedBy: ctx.userId,
        },
      });

      if (health !== "HEALTHY" && before.health === "HEALTHY") {
        await openStaleAlert(db, ctx.tenantId, before, impactNote);
      }

      await logSignalAudit(db, ctx, {
        action,
        entityType: "signal.connection",
        entityId: before.id,
        target: `${before.code} · ${before.name}`,
        note: errorMessage || undefined,
        diff: [[FIELD_LABELS.health, before.health, health]],
      });

      return { health };
    });

    revalidatePath("/signal/connections");
    revalidatePath("/signal/mapping");
    revalidatePath("/signal/evidence");
    return result;
  });
}

/**
 * Abre o alerta de dado parado para as iniciativas afetadas.
 *
 * Ato do SISTEMA, não de pessoa: quem registrou o sync pode ter sido um job. Um
 * alerta automático que aparecesse na trilha como ato humano daria a resposta
 * errada à primeira pergunta do auditor.
 */
async function openStaleAlert(
  db: Db,
  tenantId: string,
  connection: { id: string; code: string; name: string },
  impactNote: string | null
): Promise<void> {
  const affected = await db.signalMetricMapping.findMany({
    where: {
      tenantId,
      connectionId: connection.id,
      initiativeId: { not: null },
    },
    select: { initiativeId: true, initiative: { select: { code: true } } },
    distinct: ["initiativeId"],
  });

  for (const a of affected) {
    if (!a.initiativeId) {
      continue;
    }
    // Um alerta STALE aberto por iniciativa+fonte basta: repetir a cada
    // tentativa de sync encheria a fila e escondaria os outros dois tipos.
    const existing = await db.signalAlert.findFirst({
      where: {
        tenantId,
        initiativeId: a.initiativeId,
        kind: "STALE",
        state: "OPEN",
      },
    });
    if (existing) {
      continue;
    }

    const code = await nextCode({ db, tenantId, kind: "alert" });
    const created = await db.signalAlert.create({
      data: {
        tenantId,
        code,
        kind: "STALE",
        state: "OPEN",
        initiativeId: a.initiativeId,
        what:
          impactNote ??
          `A fonte ${connection.name} parou de sincronizar e os números que dependem dela ficaram no tempo.`,
        nextStep: `Reconectar ${connection.name} (${connection.code}). Enquanto não voltar, o retorno desta iniciativa está subestimado ou congelado.`,
      },
    });
    await logSignalSystemAudit(db, {
      tenantId,
      action: "Alerta disparado",
      entityType: "signal.alert",
      entityId: created.id,
      target: `${code} · ${a.initiative?.code ?? ""}`,
      note: `Fonte ${connection.code} sem sync.`,
    });
  }
}

/**
 * Reavalia a saúde de todas as fontes contra o relógio.
 *
 * Existe porque STALE é uma condição de TEMPO: nenhum evento acontece quando
 * uma fonte passa do prazo. Sem esta varredura, uma planilha abandonada
 * continuaria verde para sempre — ninguém tentou sincronizar, então ninguém
 * registrou falha.
 */
export async function recomputeHealth(): Promise<
  SignalResult<{ changed: number }>
> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.connection.write");

    const changed = await withTenantDb(ctx.tenantId, async (db) => {
      const settings = await db.signalSettings.findUnique({
        where: { tenantId: ctx.tenantId },
      });
      const staleHours = settings?.staleHours ?? 48;
      const connections = await db.signalConnection.findMany({
        where: { tenantId: ctx.tenantId },
      });

      let count = 0;
      for (const c of connections) {
        const health = deriveHealth({
          lastSyncAt: c.lastSyncAt,
          expectedFreqMinutes: c.expectedFreqMinutes,
          errorMessage: c.errorMessage,
          staleHours,
        });
        if (health === c.health) {
          continue;
        }
        const impactNote = await propagateOutage(
          db,
          ctx,
          { id: c.id, code: c.code, name: c.name },
          health
        );
        await db.signalConnection.update({
          where: { id: c.id },
          data: { health, impactNote },
        });
        if (health !== "HEALTHY") {
          await openStaleAlert(db, ctx.tenantId, c, impactNote);
        }
        count += 1;
      }
      return count;
    });

    revalidatePath("/signal/connections");
    return { changed };
  });
}
