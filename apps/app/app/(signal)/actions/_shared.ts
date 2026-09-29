import "server-only";

import type { Prisma, PrismaClient } from "@repo/database";
import { SignalRuleError, SignalStateConflictError } from "@/lib/signal/errors";
import type { SignalContext } from "@/lib/signal/guards";
import { toActionError } from "../../actions/_base";

// Primitivas compartilhadas pelas actions do Signal.

/**
 * Resultado das actions do Signal.
 *
 * Estende o `Result<T>` do `_base` com `rule` e `blockers` porque o
 * `safeAction` compartilhado colapsa todo erro em `{ ok:false, error }` e
 * descarta o resto — e o contrato deste módulo promete o contrário: 422 traz a
 * regra nomeada, 409 traz a lista do que destravar. Sem os dois campos, a tela
 * teria de adivinhar pelo texto da mensagem.
 *
 * Local ao Signal de propósito: mexer no `safeAction` mudaria o retorno de
 * todas as actions do app para servir uma feature.
 */
export type SignalResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      rule?: string;
      blockers?: string[];
      status?: number;
    };

/** Wrapper equivalente ao `safeAction`, preservando regra e bloqueadores. */
export async function signalAction<T>(
  fn: () => Promise<T>
): Promise<SignalResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof SignalStateConflictError) {
      return {
        ok: false,
        error: e.message,
        rule: e.rule,
        blockers: e.blockers,
        status: e.status,
      };
    }
    if (e instanceof SignalRuleError) {
      return { ok: false, error: e.message, rule: e.rule, status: e.status };
    }
    return { ok: false, error: toActionError(e) };
  }
}

/** Re-export para as actions não precisarem importar de dois lugares. */
export type { Result } from "../../actions/_base";

/** Cliente dentro de withTenantDb / $transaction — sem os métodos de conexão. */
export type Db = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Diff campo-a-campo, no formato normativo da trilha: [campo, antes, depois]. */
export type AuditDiff = [string, string, string][];

export type SignalEntity =
  | "signal.initiative"
  | "signal.baseline"
  | "signal.baselinedimension"
  | "signal.connection"
  | "signal.mapping"
  | "signal.planmetric"
  | "signal.observation"
  | "signal.roiformula"
  | "signal.confidence"
  | "signal.alert"
  | "signal.report"
  | "signal.settings"
  | "signal.member";

/**
 * Grava entrada de auditoria do Signal.
 *
 * Escreve direto na tabela, como o Charter e o Meridian, pelos mesmos dois
 * motivos: o helper `logAudit()` do Cosmos tipa `diff` como
 * Record<string,string> e o formato normativo aqui é Array<[campo, antes,
 * depois]>; e ele engole erro de propósito (fire-and-forget), o que é aceitável
 * para telemetria e inaceitável para evidência de auditoria — se a entrada não
 * gravou, a operação inteira tem de falhar.
 *
 * Recebe `db` para participar da mesma transação da escrita principal: uma
 * fórmula de ROI versionada sem trilha é pior do que uma fórmula que não
 * versionou. É o número que vai ao board sem dizer quem o mudou.
 *
 * A tabela é append-only por trigger. Nenhuma action do Signal pode chamar
 * auditLog.update ou delete.
 */
export async function logSignalAudit(
  db: Db,
  ctx: SignalContext,
  entry: {
    action: string;
    entityType: SignalEntity;
    entityId: string;
    /** Alvo legível: "IN-014 · Triagem assistida de autorizações". */
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
        signalRole: ctx.signalRole,
        actorName: ctx.user.name ?? ctx.user.email ?? null,
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Trilha de ato do próprio sistema — alerta disparado, sync registrado,
 * confiança reavaliada.
 *
 * `actorType: "system"` e `actorId` nulo: sem isso, um alerta automático
 * apareceria na trilha como se uma pessoa o tivesse aberto, e a primeira
 * pergunta do auditor ("quem decidiu isso?") teria a resposta errada.
 */
export async function logSignalSystemAudit(
  db: Db,
  input: {
    tenantId: string;
    action: string;
    entityType: SignalEntity;
    entityId: string;
    target: string;
    note?: string;
    diff?: AuditDiff;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorType: "system",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      diff: (input.diff ?? null) as Prisma.InputJsonValue,
      metadata: {
        target: input.target,
        note: input.note ?? null,
        actorName: "Signal",
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

export type SequenceKind =
  | "initiative"
  | "evidence"
  | "alert"
  | "report"
  | "mapping"
  | "connection";

const PREFIX: Record<SequenceKind, { prefix: string; pad: number }> = {
  initiative: { prefix: "IN", pad: 3 },
  evidence: { prefix: "EV", pad: 4 },
  alert: { prefix: "AL", pad: 2 },
  report: { prefix: "RP", pad: 3 },
  mapping: { prefix: "MP", pad: 2 },
  connection: { prefix: "CN", pad: 2 },
};

/**
 * Próximo código legível do tenant (IN-014, EV-8841, AL-31).
 *
 * O upsert + increment é atômico no Postgres, então duas criações concorrentes
 * não pegam o mesmo número. Precisa rodar dentro da transação da escrita para
 * não consumir número quando a escrita falha.
 *
 * Os códigos aparecem em toda a UI e nas referências cruzadas — o alerta cita a
 * iniciativa, a evidência cita o mapeamento. Um id opaco obrigaria o usuário a
 * copiar e colar cuid para conversar com um colega.
 */
export async function nextCode({
  db,
  tenantId,
  kind,
}: {
  db: Db;
  tenantId: string;
  kind: SequenceKind;
}): Promise<string> {
  const row = await db.signalSequence.upsert({
    where: { tenantId_kind: { tenantId, kind } },
    create: { tenantId, kind, next: 2 },
    update: { next: { increment: 1 } },
    select: { next: true },
  });
  // create devolve next=2 (já reservando o próximo), então o número emitido é
  // next-1 nos dois caminhos.
  const n = row.next - 1;
  const { prefix, pad } = PREFIX[kind];
  return `${prefix}-${String(n).padStart(pad, "0")}`;
}

/** Rótulos pt-BR usados em diff de auditoria. Centralizados para que a mesma
 *  mudança apareça com o mesmo nome em toda a trilha. */
export const FIELD_LABELS = {
  name: "Nome",
  status: "Status",
  state: "Estado",
  category: "Categoria",
  businessUnit: "Área",
  ownerId: "Dono",
  hypothesis: "Hipótese",
  expectedValue: "Valor esperado",
  closureReason: "Motivo do encerramento",
  version: "Versão",
  signedAt: "Assinatura",
  windowLabel: "Janela",
  health: "Saúde da fonte",
  lastSyncAt: "Último sync",
  transform: "Transformação",
  eventKey: "Evento de origem",
  metricLabel: "Métrica",
  unit: "Unidade",
  horizonMonths: "Horizonte",
  total: "Total",
  got: "Pontuação do fator",
  weight: "Peso do fator",
  adoptionBar: "Régua de adoção",
  valueBar: "Régua de valor",
  weakRoi: "Limiar de ROI fraco",
  staleHours: "Limiar de dado parado",
  lowAdoptionPct: "Limiar de adoção baixa",
  lowAdoptionWeeks: "Semanas para adoção baixa",
  role: "Papel",
  formula: "Fórmula",
  targetValue: "Meta",
  sourceMappingId: "Fonte",
  flag: "Ressalva",
} as const;
