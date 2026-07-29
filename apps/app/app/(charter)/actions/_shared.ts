import "server-only";

import type { Prisma, PrismaClient } from "@repo/database";
import type { CharterContext } from "@/lib/charter/guards";

// Primitivas compartilhadas pelas actions do Charter.

/** Cliente dentro de withTenantDb / $transaction — sem os métodos de conexão. */
export type Db = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Diff campo-a-campo, no formato do DATA-MODEL: [campo, antes, depois]. */
export type AuditDiff = [string, string, string][];

export type CharterEntity =
  | "charter.policy"
  | "charter.section"
  | "charter.usecase"
  | "charter.decision"
  | "charter.risk"
  | "charter.mitigation"
  | "charter.vendor"
  | "charter.clause"
  | "charter.track"
  | "charter.export"
  | "charter.settings";

/**
 * Grava entrada de auditoria do Charter.
 *
 * Escreve direto na tabela em vez de usar `logAudit()` do Cosmos por dois
 * motivos: aquele helper tipa `diff` como Record<string,string> e o formato
 * normativo aqui é Array<[campo, antes, depois]>; e ele engole erro de
 * propósito (fire-and-forget), o que é aceitável para telemetria e inaceitável
 * para evidência de auditoria — se a entrada não gravou, a operação inteira
 * tem de falhar.
 *
 * Recebe `db` para participar da mesma transação da escrita principal: uma
 * decisão persistida sem trilha é pior do que uma decisão que não persistiu.
 *
 * A tabela é append-only por trigger (20260603000002_audit_log_immutable_trigger).
 * Nenhuma action do Charter pode chamar auditLog.update ou delete.
 */
export async function logCharterAudit(
  db: Db,
  ctx: CharterContext,
  entry: {
    action: string;
    entityType: CharterEntity;
    entityId: string;
    /** Alvo legível: "UC-118 · Triagem de sinistros". */
    target: string;
    note?: string;
    diff?: AuditDiff;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      actorId: ctx.userId,
      actorType: "user",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      diff: (entry.diff ?? null) as Prisma.InputJsonValue,
      metadata: {
        target: entry.target,
        note: entry.note ?? null,
        // Papel no momento do ato. O papel muda; o registro não pode mudar com
        // ele, senão a trilha reescreve a história a cada troca de função.
        charterRole: ctx.charterRole,
        actorName: ctx.user.name ?? ctx.user.email ?? null,
      } as Prisma.InputJsonValue,
    },
  });
}

/** Monta diff só com os campos que de fato mudaram. Diff com linha "X → X"
 *  polui a evidência e faz o auditor procurar mudança onde não houve. */
export function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>
): AuditDiff {
  const diff: AuditDiff = [];
  for (const key of Object.keys(labels)) {
    const b = before[key];
    const a = after[key];
    if (a === undefined || String(b ?? "—") === String(a ?? "—")) {
      continue;
    }
    diff.push([labels[key], String(b ?? "—"), String(a ?? "—")]);
  }
  return diff;
}

/**
 * Próximo código legível do tenant (UC-118, MIT-31, V-08).
 *
 * O upsert + increment é atômico no Postgres, então duas submissões
 * concorrentes não pegam o mesmo número. Precisa rodar dentro da transação da
 * escrita para não consumir número quando a escrita falha.
 */
export async function nextCode({
  db,
  tenantId,
  kind,
  prefix,
  pad = 3,
}: {
  db: Db;
  tenantId: string;
  kind: "usecase" | "mitigation" | "vendor" | "clause" | "track";
  prefix: string;
  pad?: number;
}): Promise<string> {
  const row = await db.charterSequence.upsert({
    where: { tenantId_kind: { tenantId, kind } },
    create: { tenantId, kind, next: 2 },
    update: { next: { increment: 1 } },
    select: { next: true },
  });
  // create devolve next=2 (já reservando o próximo), então o número emitido é
  // next-1 nos dois caminhos.
  const n = row.next - 1;
  return `${prefix}-${String(n).padStart(pad, "0")}`;
}

/** Rótulos pt-BR usados em diff de auditoria. Centralizados para que a mesma
 *  mudança apareça com o mesmo nome em toda a trilha. */
export const FIELD_LABELS = {
  status: "Status",
  tier: "Tier",
  maxClass: "Classe máxima",
  version: "Versão",
  dataClass: "Classe de dado",
  exposure: "Exposição",
  criticality: "Criticidade",
  restrictions: "Restrições",
  blockReason: "Motivo do bloqueio",
  changeRequest: "Ajuste pedido",
  body: "Corpo da seção",
  dpa: "DPA",
  retention: "Retenção",
  assigned: "Atribuídos",
  policyVersion: "Versão de política",
  riskPrivacy: "Privacidade",
  riskRegulatory: "Regulatório",
  riskSecurity: "Segurança",
  riskBias: "Viés",
  riskIp: "PI / Confidencialidade",
  riskOperational: "Operacional",
  riskReputational: "Reputacional",
  severity: "Severidade geral",
  score: "Score de risco",
} as const;
