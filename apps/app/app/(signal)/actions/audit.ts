"use server";

import { withTenantDb } from "@repo/database";
import { z } from "zod";
import { requireSignalPermissionContext } from "@/lib/signal/guards";
import { nnStr } from "../../actions/_base";
import { type AuditDiff, type SignalResult, signalAction } from "./_shared";

// Trilha — US7. Somente leitura, e é assim de propósito.
//
// Este arquivo não exporta nenhuma escrita. A trilha é gravada pelas actions
// que praticam os atos (`logSignalAudit`, na mesma transação da escrita) e é
// append-only por trigger no banco. Se houvesse aqui um `deleteAuditEntry`, a
// primeira pergunta de qualquer auditor — "isto pode ter sido apagado?" —
// passaria a ter a resposta errada.
//
// Ler a trilha exige `signal.read` e nada além disso: esconder quem mudou o
// número de quem lê o número inverte a razão de existir da tabela.

const FilterSchema = z.object({
  entityType: nnStr.optional(),
  entityId: nnStr.optional(),
  actorId: nnStr.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type AuditRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  /** Alvo legível gravado no ato: "IN-014 · Copiloto de atendimento". */
  target: string | null;
  note: string | null;
  /** Nome de quem agiu, congelado no momento do ato. */
  actorName: string;
  /** Papel no momento do ato — não o papel de hoje. */
  actorRole: string | null;
  bySystem: boolean;
  diff: AuditDiff;
  at: Date;
};

/** O `metadata` é Json: ler campo a campo com verificação em vez de confiar. */
function readMeta(meta: unknown): {
  target: string | null;
  note: string | null;
  signalRole: string | null;
  actorName: string | null;
} {
  const m = (meta ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    target: str(m.target),
    note: str(m.note),
    signalRole: str(m.signalRole),
    actorName: str(m.actorName),
  };
}

/** Só as entradas do Signal: a tabela é compartilhada com os outros módulos. */
const SIGNAL_ENTITY_PREFIX = "signal.";

/** O filtro da consulta. Fora da action para a leitura ficar de um tamanho só. */
function whereOf(
  tenantId: string,
  input: z.output<typeof FilterSchema>
): Record<string, unknown> {
  const createdAt = {
    ...(input.from ? { gte: input.from } : {}),
    ...(input.to ? { lte: input.to } : {}),
  };
  return {
    tenantId,
    // Sem filtro explícito, só o que é do Signal: a tabela é compartilhada
    // com os outros módulos da plataforma.
    entityType: input.entityType ?? { startsWith: SIGNAL_ENTITY_PREFIX },
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
  };
}

export async function listAudit(
  raw: z.input<typeof FilterSchema> = {}
): Promise<SignalResult<AuditRow[]>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const input = FilterSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.auditLog.findMany({
        where: whereOf(ctx.tenantId, input),
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return rows.map((r) => {
        const meta = readMeta(r.metadata);
        const bySystem = r.actorType === "system";
        return {
          id: r.id,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          target: meta.target,
          note: meta.note,
          // Ato do sistema é dito com todas as letras: sem isso, um alerta
          // automático apareceria como decisão de alguém.
          actorName: bySystem ? "Sistema" : (meta.actorName ?? "—"),
          actorRole: bySystem ? null : meta.signalRole,
          bySystem,
          diff: Array.isArray(r.diff) ? (r.diff as AuditDiff) : [],
          at: r.createdAt,
        };
      });
    });
  });
}
