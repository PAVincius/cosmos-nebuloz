"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import { listDecisions as readDecisionEntries } from "../../actions/governance/decision-log";

// O Decision Log é artefato de compliance, não painel: FR-010
// (docs/srd-epic-006.md:126) e FR-816 (docs/srd-epic-008.md:178) restringem o
// SELECT a ORG_ADMIN/RTE/PORTFOLIO_MANAGER. No vocabulário de MemberRole deste
// repo isso é ADMIN/RTE/STE — o mesmo trio que já pode escrever, porque um log
// não deve ser mais aberto para ler do que para registrar.
const DECISION_LOG_ROLES = ["ADMIN", "RTE", "STE"] as const;

export type DecisionView = {
  id: string;
  titulo: string;
  decisao: string;
  justificativa: string;
  tipo: string;
  dataDecisao: string;
  tags: string[];
  decisorName: string | null;
};

/** AuditLog só guarda userId; o nome vem de uma consulta em lote. Nenhuma
 *  consulta quando não há decisor algum — o log pode ser todo de sistema. */
async function decisorNamesById(
  rows: { decisorId?: string | null }[]
): Promise<Map<string, string | null>> {
  const ids = [
    ...new Set(rows.map((r) => r.decisorId).filter((id): id is string => !!id)),
  ];
  if (ids.length === 0) {
    return new Map();
  }
  const users = await database.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function listDecisions(): Promise<Result<DecisionView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole([...DECISION_LOG_ROLES], ctx);
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
        decisorId: true,
      },
    });

    const decisorNameById = await decisorNamesById(rows);

    return rows.map((d) => ({
      id: d.id,
      titulo: d.titulo ?? `${d.tipo} · ${d.targetType}`,
      decisao: d.decisao,
      justificativa: d.justificativa,
      tipo: d.tipo,
      dataDecisao: d.dataDecisao.toISOString(),
      tags: d.tags,
      decisorName: (d.decisorId && decisorNameById.get(d.decisorId)) || null,
    }));
  });
}

export type DecisionLogExportEntry = {
  id: string;
  titulo: string | null;
  tipo: string;
  targetType: string;
  targetId: string;
  decisao: string;
  justificativa: string;
  tags: string[];
  dataDecisao: string;
  decisorId: string;
  decisorName: string | null;
  dadosSuporte: unknown;
};

export type DecisionLogExport = {
  exportedAt: string;
  exportedBy: { id: string; name: string | null };
  tenantId: string;
  totalEntries: number;
  entries: DecisionLogExportEntry[];
};

/**
 * Export do Decision Log para auditoria externa (FR-010, FR-816).
 *
 * Não reusa exportDecisionsCSV (app/actions/governance/export-decisions.ts):
 * aquele é outro artefato — CSV obrigatoriamente recortado por janela de até um
 * ano, sem papel exigido e sem registro do próprio export. Este é o log inteiro
 * em JSON com rodapé de metadados, que é o que o FR-010 pede. O que os dois
 * compartilham — a leitura tenant-scoped — vem do mesmo lugar.
 *
 * Ordem ascendente de propósito: a tela lista da decisão mais recente para a
 * mais antiga, porque é assim que se acompanha; o export vai do começo, porque
 * é assim que se lê uma trilha de auditoria.
 *
 * O próprio export é auditado — um export de registro de governança que não
 * deixa rastro é exatamente o buraco de exfiltração silenciosa que o controle
 * de change management do SOC2 procura (PRD BR-7.4.4.2).
 */
export async function exportDecisionLog(): Promise<Result<DecisionLogExport>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole([...DECISION_LOG_ROLES], ctx);

    // Leitor maduro e tenant-scoped, já usado pelo export CSV. Ele devolve do
    // mais recente para o mais antigo; a inversão aqui é a ordem de auditoria.
    const rows = [...(await readDecisionEntries(ctx.tenantId))].reverse();
    const decisorNameById = await decisorNamesById(rows);

    const payload: DecisionLogExport = {
      exportedAt: new Date().toISOString(),
      exportedBy: { id: ctx.userId, name: ctx.user?.name ?? null },
      tenantId: ctx.tenantId,
      totalEntries: rows.length,
      entries: rows.map((d) => ({
        id: d.id,
        titulo: d.titulo,
        tipo: d.tipo,
        targetType: d.targetType,
        targetId: d.targetId,
        decisao: d.decisao,
        justificativa: d.justificativa,
        tags: d.tags,
        dataDecisao: d.dataDecisao.toISOString(),
        decisorId: d.decisorId,
        decisorName: (d.decisorId && decisorNameById.get(d.decisorId)) || null,
        dadosSuporte: d.dadosSuporte,
      })),
    };

    // Auditado só depois de o payload existir: não se registra export que não
    // aconteceu.
    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "decision_log_export",
      entityId: ctx.tenantId,
      diff: {
        totalEntries: String(payload.totalEntries),
        exportedAt: payload.exportedAt,
      },
    });

    return payload;
  });
}

// Only "epic" and "theme" are searchable via EntityLinkField (RF-94's
// allow-listed entity kinds). "guardrail" targetType exists in the schema
// comment but has no entity-search kind, so the create form does not offer
// it for now.
const CreateDecisionSchema = z.object({
  tipo: z.enum(["epic_decision", "budget_decision", "theme_decision"]),
  targetType: z.enum(["epic", "theme"]),
  targetId: z.string().min(1),
  decisao: z.enum(["approved", "rejected", "deferred", "changed"]),
  justificativa: z.string().min(1).max(4000),
  titulo: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

export async function createDecision(
  input: z.input<typeof CreateDecisionSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole([...DECISION_LOG_ROLES], ctx);
    const { tipo, targetType, targetId, decisao, justificativa, titulo, tags } =
      CreateDecisionSchema.parse(input);

    // Cross-tenant IDOR guard — client-supplied targetId must belong to this
    // tenant, scoped by the chosen targetType.
    if (targetType === "epic") {
      const epic = await database.epic.findFirst({
        where: { id: targetId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!epic) {
        throw new Error("Epic inválido.");
      }
    } else {
      const theme = await database.strategicTheme.findFirst({
        where: { id: targetId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!theme) {
        throw new Error("Tema inválido.");
      }
    }

    const created = await database.decisionLogEntry.create({
      data: {
        tenantId: ctx.tenantId,
        tipo,
        targetType,
        targetId,
        decisao,
        justificativa,
        titulo: titulo?.trim() || null,
        tags: tags ?? [],
        decisorId: ctx.userId,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "decision",
      entityId: created.id,
      diff: { tipo, targetType, targetId, decisao },
    });
    revalidateTag(`decisions:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}
