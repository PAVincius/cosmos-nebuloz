import "server-only";

import type { Prisma, PrismaClient } from "@repo/database";
import {
  type MeridianContext,
  StateConflictError,
} from "@/lib/meridian/guards";

// Primitivas compartilhadas pelas actions do Meridian.

/** Cliente dentro de withTenantDb / $transaction — sem os métodos de conexão. */
export type Db = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Trava de decisões do assessment finalizado (D-29, FR-029d): override,
 * confirmação, gap, plano e novo scoring são recusados quando o assessment
 * está FINALISED — para reabrir, o consultor reabre (FR-029e). Leitura,
 * relatório, exportação, promoção de gap e reavaliação seguem livres.
 *
 * Sem assessment (id de outro tenant ou inexistente) a trava não decide: quem
 * chama já recusa com "não encontrado" pela própria leitura.
 */
export async function requireDecisionsOpen(
  db: Db,
  tenantId: string,
  assessmentId: string
): Promise<void> {
  const a = await db.meridianAssessment.findFirst({
    where: { id: assessmentId, tenantId },
    select: { status: true },
  });
  if (a?.status === "FINALISED") {
    throw new StateConflictError(
      "assessment.finalised",
      "Assessment finalizado: override, confirmação, gaps, plano e scoring ficam travados. Reabra o assessment para decidir."
    );
  }
}

/** Diff campo-a-campo, no formato normativo da trilha: [campo, antes, depois]. */
export type AuditDiff = [string, string, string][];

export type MeridianEntity =
  | "meridian.assessment"
  | "meridian.respondent"
  | "meridian.response"
  | "meridian.evidence"
  | "meridian.axisscore"
  | "meridian.override"
  | "meridian.gap"
  | "meridian.gapdependency"
  | "meridian.planitem"
  | "meridian.promotion"
  | "meridian.benchmark";

/**
 * Grava entrada de auditoria do Meridian.
 *
 * Escreve direto na tabela, como o Charter, pelos mesmos dois motivos: o helper
 * `logAudit()` do Cosmos tipa `diff` como Record<string,string> e o formato
 * normativo aqui é Array<[campo, antes, depois]>; e ele engole erro de propósito
 * (fire-and-forget), o que é aceitável para telemetria e inaceitável para
 * evidência de auditoria — se a entrada não gravou, a operação inteira tem de
 * falhar.
 *
 * Recebe `db` para participar da mesma transação da escrita principal: um
 * override persistido sem trilha é pior do que um override que não persistiu.
 *
 * A tabela é append-only por trigger. Nenhuma action do Meridian pode chamar
 * auditLog.update ou delete.
 */
export async function logMeridianAudit(
  db: Db,
  ctx: MeridianContext,
  entry: {
    action: string;
    entityType: MeridianEntity;
    entityId: string;
    /** Alvo legível: "AS-104 · Vanta Saúde". */
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
        meridianRole: ctx.meridianRole,
        actorName: ctx.user.name ?? ctx.user.email ?? null,
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Trilha de ato feito por respondente, que não tem conta na plataforma.
 *
 * `actorType: "respondent"` e `actorId` com o id do respondente: sem isso, um
 * upload de evidência apareceria na trilha como se ninguém o tivesse feito.
 */
export async function logRespondentAudit(
  db: Db,
  input: {
    tenantId: string;
    respondentId: string;
    respondentName: string;
    action: string;
    entityType: MeridianEntity;
    entityId: string;
    target: string;
    diff?: AuditDiff;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.respondentId,
      actorType: "respondent",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      diff: (input.diff ?? null) as Prisma.InputJsonValue,
      metadata: {
        target: input.target,
        actorName: input.respondentName,
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
    diff.push([labels[key] as string, String(b ?? "—"), String(a ?? "—")]);
  }
  return diff;
}

/**
 * Próximo código legível do tenant (AS-104, G-01, OV-11).
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
  pad = 2,
}: {
  db: Db;
  tenantId: string;
  kind: "assessment" | "gap" | "override";
  prefix: string;
  pad?: number;
}): Promise<string> {
  const row = await db.meridianSequence.upsert({
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
  state: "Estado",
  final: "Score final",
  computed: "Score computado",
  confidence: "Confiança",
  rationale: "Justificativa",
  severity: "Severidade",
  costOfDelay: "Custo de atraso",
  effort: "Esforço",
  statement: "Enunciado",
  ownerLabel: "Dono sugerido",
  axis: "Eixo",
  deadline: "Prazo",
  benchmarkOptIn: "Opt-in de benchmark",
  targetProduct: "Produto de destino",
  quarter: "Trimestre",
} as const;
