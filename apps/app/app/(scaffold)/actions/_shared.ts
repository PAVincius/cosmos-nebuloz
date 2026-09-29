import "server-only";

import type { Prisma, PrismaClient } from "@repo/database";
import type { ScaffoldContext } from "@/lib/scaffold/guards";

// Primitivas compartilhadas pelas actions do Scaffold.

/** Cliente dentro de withTenantDb / $transaction — sem os métodos de conexão. */
export type Db = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Diff campo-a-campo, no formato normativo da trilha: [campo, antes, depois]. */
export type AuditDiff = [string, string, string][];

export type ScaffoldEntity =
  | "scaffold.track"
  | "scaffold.phase"
  | "scaffold.step"
  | "scaffold.artefact"
  | "scaffold.gateresult"
  | "scaffold.override"
  | "scaffold.businesscase"
  | "scaffold.template"
  | "scaffold.overlay"
  | "scaffold.membership"
  | "scaffold.deliverable"
  | "scaffold.processlink";

/**
 * Grava entrada de auditoria do Scaffold (SN-03).
 *
 * Escreve direto na tabela, como o Charter e o Meridian, pelos mesmos dois
 * motivos: o helper `logAudit()` do Cosmos tipa `diff` como
 * Record<string,string> e o formato normativo aqui é Array<[campo, antes,
 * depois]>; e ele engole erro de propósito (fire-and-forget), o que é aceitável
 * para telemetria e inaceitável para evidência de auditoria.
 *
 * A distinção importa mais aqui do que nos outros dois produtos: um override de
 * gate persistido sem trilha é um gate desligado sem registro — exatamente o
 * cenário que o SRD chama de defeito de correção. Por isso recebe `db` e
 * participa da mesma transação da escrita principal.
 *
 * A tabela é append-only por trigger. Nenhuma action do Scaffold pode chamar
 * auditLog.update ou delete.
 */
export async function logScaffoldAudit(
  db: Db,
  ctx: ScaffoldContext,
  entry: {
    action: string;
    entityType: ScaffoldEntity;
    entityId: string;
    /** Alvo legível: "TR-104 · Triagem de autorizações prévias". */
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
        scaffoldRole: ctx.scaffoldRole,
        actorName: ctx.user.name ?? ctx.user.email ?? null,
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Próximo código legível do tenant (TR-104, BC-104).
 *
 * O upsert + increment é atômico no Postgres, então duas criações concorrentes
 * não pegam o mesmo número. Precisa rodar dentro da transação da escrita para
 * não consumir número quando a escrita falha.
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
  /** "track", "businesscase" ou `deliverable:<trackId>` (extras da trilha). */
  kind: "track" | "businesscase" | `deliverable:${string}`;
  prefix: string;
  pad?: number;
}): Promise<string> {
  const row = await db.scaffoldSequence.upsert({
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
  state: "Estado",
  status: "Status",
  phase: "Fase",
  currentPhase: "Fase atual",
  processName: "Processo",
  ownerId: "Dono do processo",
  consultantId: "Consultor",
  templateVersionId: "Versão do template",
  outcome: "Resultado do gate",
  rationale: "Justificativa",
  unmetCriteria: "Critérios não atendidos",
  signedVersionId: "Versão assinada",
  archetype: "Arquétipo",
  scaffoldRole: "Papel de adoção",
} as const;
