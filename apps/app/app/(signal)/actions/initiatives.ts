"use server";

import { type Prisma, withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adoptionPct, computeAdoption } from "@/lib/signal/adoption";
import { computeConfidence } from "@/lib/signal/confidence";
import { SignalRuleError, SignalStateConflictError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  requireSignalPermissionContext,
  type SignalContext,
} from "@/lib/signal/guards";
import {
  canTransition,
  type InitiativeStatus,
  requiresReason,
  requiresSignedBaseline,
  STATUS_LABEL,
} from "@/lib/signal/lifecycle";
import { computeOutcome } from "@/lib/signal/outcome";
import {
  computePortfolio,
  type PortfolioSummary,
} from "@/lib/signal/portfolio";
import { computeRoi } from "@/lib/signal/roi";
import { verdictWithMeta } from "@/lib/signal/verdict";
import { cuid, nnStr, optStr } from "../../actions/_base";
import {
  buildDiff,
  type Db,
  FIELD_LABELS,
  logSignalAudit,
  nextCode,
  type SignalResult,
  signalAction,
} from "./_shared";

// Iniciativas — US1 e US2.
//
// `getInitiative` monta o detalhe inteiro numa consulta e deixa TODO o cálculo
// para `lib/signal/*`. É o que garante a regra-mãe: adoção, resultado, ROI,
// confiança e veredito saem da mesma leitura, e nenhum deles pode aparecer na
// tela sem os outros porque nenhum deles existe sozinho aqui.

const REASON_MIN = 20;

const CategoryEnum = z.enum(["PRODUCTIVITY", "QUALITY", "RISK", "REVENUE"]);
const StatusEnum = z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "CANCELLED"]);

const CreateSchema = z.object({
  name: nnStr,
  businessUnit: nnStr,
  category: CategoryEnum,
  // Opcional: o dono padrão é quem cria. Exigir o id no formulário obrigaria a
  // casca a levar o `userId` da sessão até o cliente só para devolvê-lo ao
  // servidor — e o servidor já sabe quem está chamando.
  ownerId: cuid.optional(),
  hypothesis: z.string().trim().min(20).max(4000),
  expectedValue: z.coerce.number().nonnegative().optional(),
});

const UpdateSchema = z.object({
  code: nnStr,
  name: nnStr.optional(),
  businessUnit: nnStr.optional(),
  category: CategoryEnum.optional(),
  ownerId: cuid.optional(),
  hypothesis: z.string().trim().min(20).max(4000).optional(),
  expectedValue: z.coerce.number().nonnegative().optional(),
});

const TransitionSchema = z.object({
  code: nnStr,
  to: StatusEnum,
  reason: optStr,
});

const ListSchema = z.object({
  status: StatusEnum.optional(),
  category: CategoryEnum.optional(),
  businessUnit: nnStr.optional(),
  q: z.string().trim().max(120).optional(),
});

/** Seleção mínima para calcular veredito de uma linha de lista. */
const CARD_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  roiFormulas: {
    where: { state: "ACTIVE" as const },
    select: { version: true, entries: { select: { kind: true, total: true } } },
  },
  adoption: {
    orderBy: { periodStart: "desc" as const },
    take: 1,
    select: { activeUsers: true, licensedUsers: true },
  },
  confidenceScores: {
    select: {
      got: true,
      note: true,
      rule: { select: { key: true, label: true, weight: true } },
    },
  },
  baselines: {
    where: { signedAt: { not: null } },
    orderBy: { version: "desc" as const },
    take: 1,
    select: { version: true },
  },
} as const;

type Bars = { adoptionBar: number; valueBar: number };

async function barsOf(
  db: Parameters<Parameters<typeof withTenantDb>[1]>[0],
  tenantId: string
): Promise<Bars> {
  const s = await db.signalSettings.findUnique({ where: { tenantId } });
  return s
    ? { adoptionBar: s.adoptionBar, valueBar: Number(s.valueBar) }
    : { adoptionBar: 60, valueBar: 1.5 };
}

export type InitiativeCard = {
  code: string;
  name: string;
  businessUnit: string;
  category: z.infer<typeof CategoryEnum>;
  status: InitiativeStatus;
  owner: { id: string; name: string };
  adoptionPct: number;
  multiple: number | null;
  formulaVersion: number | null;
  baselineVersion: number | null;
  confidenceScore: number;
  confidenceBand: string;
  verdict: string;
  verdictLabel: string;
  verdictTone: string;
  verdictAction: string;
};

export async function listInitiatives(
  raw: z.input<typeof ListSchema> = {}
): Promise<SignalResult<InitiativeCard[]>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const input = ListSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const bars = await barsOf(db, ctx.tenantId);
      const rows = await db.signalInitiative.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: input.status,
          category: input.category,
          businessUnit: input.businessUnit,
          ...(input.q
            ? {
                OR: [
                  { code: { contains: input.q, mode: "insensitive" as const } },
                  { name: { contains: input.q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        include: CARD_INCLUDE,
        orderBy: [{ status: "asc" }, { code: "asc" }],
      });

      return rows.map((r) => {
        const roi = computeRoi(
          (r.roiFormulas[0]?.entries ?? []).map((e) => ({
            kind: e.kind,
            label: "",
            total: Number(e.total),
            sourceLabel: "",
          }))
        );
        const snapshot = r.adoption[0];
        const pct = snapshot ? adoptionPct(snapshot) : 0;
        const confidence = computeConfidence(
          r.confidenceScores.map((s) => ({
            key: s.rule.key,
            label: s.rule.label,
            weight: s.rule.weight,
            got: s.got,
            note: s.note,
          }))
        );
        const verdict = verdictWithMeta(
          { adoptionPct: pct, multiple: roi.multiple },
          bars
        );
        return {
          code: r.code,
          name: r.name,
          businessUnit: r.businessUnit,
          category: r.category,
          status: r.status,
          owner: {
            id: r.owner.id,
            name: r.owner.name ?? r.owner.email ?? "—",
          },
          adoptionPct: pct,
          multiple: roi.multiple,
          formulaVersion: r.roiFormulas[0]?.version ?? null,
          baselineVersion: r.baselines[0]?.version ?? null,
          confidenceScore: confidence.score,
          confidenceBand: confidence.band,
          verdict: verdict.verdict,
          verdictLabel: verdict.label,
          verdictTone: verdict.tone,
          verdictAction: verdict.action,
        };
      });
    });
  });
}

/**
 * Agregado do portfólio — US3.
 *
 * Reusa `CARD_INCLUDE`: a visão geral e a lista respondem a perguntas
 * diferentes, mas leem os mesmos campos, e duas projeções divergentes sobre a
 * mesma linha é como um número aparece diferente em duas telas.
 *
 * Só iniciativas ATIVAS entram. Encerrada não é "portfólio", é história — e
 * somá-la ao múltiplo corrente diluiria o retorno do que está rodando hoje com
 * o de algo que já foi decidido.
 */
export async function getPortfolioSummary(): Promise<
  SignalResult<PortfolioSummary>
> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const bars = await barsOf(db, ctx.tenantId);
      const rows = await db.signalInitiative.findMany({
        where: { tenantId: ctx.tenantId, status: "ACTIVE" },
        include: CARD_INCLUDE,
      });

      return computePortfolio(
        rows.map((r) => ({
          code: r.code,
          name: r.name,
          businessUnit: r.businessUnit,
          category: r.category,
          status: r.status,
          entries: (r.roiFormulas[0]?.entries ?? []).map((e) => ({
            kind: e.kind,
            label: "",
            total: Number(e.total),
            sourceLabel: "",
          })),
          adoption: r.adoption[0] ?? null,
        })),
        bars
      );
    });
  });
}

export type InitiativeDetail = {
  code: string;
  name: string;
  businessUnit: string;
  category: z.infer<typeof CategoryEnum>;
  status: InitiativeStatus;
  hypothesis: string;
  startedAt: Date | null;
  owner: { id: string; name: string };
  closure: { at: Date; by: string; reason: string | null } | null;
  baseline: {
    version: number;
    windowLabel: string;
    signedAt: Date | null;
    signedBy: string;
    dimensions: {
      key: string;
      label: string;
      value: string;
      sourceLabel: string;
    }[];
  } | null;
  baselineVersions: { version: number; signedAt: Date | null }[];
  adoption: ReturnType<typeof computeAdoption>;
  outcome: {
    primary: ReturnType<typeof computeOutcome>;
    secondary: ReturnType<typeof computeOutcome>;
  };
  roi: ReturnType<typeof computeRoi> & {
    version: number | null;
    horizonMonths: number | null;
    assumptions: { label: string; value: string; note: string }[];
  };
  confidence: ReturnType<typeof computeConfidence>;
  verdict: ReturnType<typeof verdictWithMeta>;
  bars: Bars;
  evidenceCount: number;
  alerts: { code: string; kind: string; what: string; nextStep: string }[];
};

/**
 * Tudo que o detalhe carrega. Extraído para constante para que o TIPO da linha
 * saia do próprio Prisma (`GetPayload`) em vez de `any` — o `include` aninhado
 * é grande, mas grande não é motivo para desligar o compilador justamente na
 * função que monta a tela mais importante do produto.
 */
const DETAIL_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  closedBy: { select: { name: true, email: true } },
  baselines: {
    orderBy: { version: "desc" as const },
    include: {
      dimensions: { orderBy: { order: "asc" as const } },
      signedBy: { select: { name: true, email: true } },
    },
  },
  roiFormulas: {
    where: { state: "ACTIVE" as const },
    include: {
      entries: { orderBy: { order: "asc" as const } },
      assumptions: { orderBy: { order: "asc" as const } },
    },
  },
  adoption: { orderBy: { periodStart: "asc" as const } },
  outcomes: { orderBy: { periodStart: "asc" as const } },
  confidenceScores: {
    include: { rule: true },
    orderBy: { rule: { order: "asc" as const } },
  },
  alerts: {
    where: { state: "OPEN" as const },
    orderBy: { raisedAt: "desc" as const },
  },
  _count: { select: { observations: true } },
} satisfies Prisma.SignalInitiativeInclude;

type DetailRow = Prisma.SignalInitiativeGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

const person = (p: { name?: string | null; email?: string | null } | null) =>
  p?.name ?? p?.email ?? "—";

/**
 * Projeta a linha crua no que a tela consome.
 *
 * Extraída da action por dois motivos: a leitura ficava com complexidade alta
 * o bastante para o lint recusar, e — mais importante — o TIPO de retorno agora
 * é explícito e exportado. Antes a tela recebia `unknown` e precisava de `any`
 * para chegar nos campos, o que anulava a checagem justamente onde a regra-mãe
 * do produto é montada.
 */
function projectDetail(row: DetailRow, bars: Bars): InitiativeDetail {
  const formula = row.roiFormulas[0];
  const roi = computeRoi(
    (formula?.entries ?? []).map((e) => ({
      kind: e.kind,
      label: e.label,
      total: Number(e.total),
      quantityLabel: e.quantityLabel,
      unitLabel: e.unitLabel,
      sourceLabel: e.sourceLabel,
    }))
  );
  const adoption = computeAdoption(row.adoption);
  // Decimal do Prisma vira number aqui, na fronteira: o motor de cálculo é puro
  // e não deveria conhecer o tipo do driver de banco.
  const toOutcome = (o: DetailRow["outcomes"][number]) => ({
    ...o,
    numericBaseline: o.numericBaseline ? Number(o.numericBaseline) : null,
    numericCurrent: o.numericCurrent ? Number(o.numericCurrent) : null,
  });
  const confidence = computeConfidence(
    row.confidenceScores.map((s) => ({
      key: s.rule.key,
      label: s.rule.label,
      weight: s.rule.weight,
      got: s.got,
      note: s.note,
    }))
  );
  const signed = row.baselines.find((b) => b.signedAt !== null);

  return {
    code: row.code,
    name: row.name,
    businessUnit: row.businessUnit,
    category: row.category,
    status: row.status,
    hypothesis: row.hypothesis,
    startedAt: row.startedAt,
    owner: { id: row.owner.id, name: person(row.owner) },
    closure: row.closedAt
      ? {
          at: row.closedAt,
          by: person(row.closedBy),
          reason: row.closureReason,
        }
      : null,
    baseline: signed
      ? {
          version: signed.version,
          windowLabel: signed.windowLabel,
          signedAt: signed.signedAt,
          signedBy: person(signed.signedBy),
          dimensions: signed.dimensions.map((d) => ({
            key: d.key,
            label: d.label,
            value: d.value,
            sourceLabel: d.sourceLabel,
          })),
        }
      : null,
    baselineVersions: row.baselines.map((b) => ({
      version: b.version,
      signedAt: b.signedAt,
    })),
    adoption,
    outcome: {
      primary: computeOutcome(
        row.outcomes.filter((o) => !o.isSecondary).map(toOutcome)
      ),
      secondary: computeOutcome(
        row.outcomes.filter((o) => o.isSecondary).map(toOutcome)
      ),
    },
    roi: {
      ...roi,
      // A versão viaja JUNTO do múltiplo, sempre. É o que impede a tela de
      // exibir um sem o outro por descuido de composição.
      version: formula?.version ?? null,
      horizonMonths: formula?.horizonMonths ?? null,
      assumptions: (formula?.assumptions ?? []).map((a) => ({
        label: a.label,
        value: a.value,
        note: a.note,
      })),
    },
    confidence,
    verdict: verdictWithMeta(
      { adoptionPct: adoption.pct, multiple: roi.multiple },
      bars
    ),
    bars,
    evidenceCount: row._count.observations,
    alerts: row.alerts.map((a) => ({
      code: a.code,
      kind: a.kind,
      what: a.what,
      nextStep: a.nextStep,
    })),
  };
}

export async function getInitiative(raw: {
  code: string;
}): Promise<SignalResult<InitiativeDetail>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const { code } = z.object({ code: nnStr }).parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const bars = await barsOf(db, ctx.tenantId);
      const row = await db.signalInitiative.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code } },
        include: DETAIL_INCLUDE,
      });

      if (!row) {
        // Não encontrado, nunca "sem permissão": a segunda resposta já revelaria
        // que a iniciativa existe em outro tenant.
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${code} não encontrada nesta organização.`
        );
      }

      return projectDetail(row, bars);
    });
  });
}

export async function createInitiative(
  raw: z.input<typeof CreateSchema>
): Promise<SignalResult<{ code: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.initiative.write");
    const input = CreateSchema.parse(raw);

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "initiative",
      });
      const row = await db.signalInitiative.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          name: input.name,
          businessUnit: input.businessUnit,
          category: input.category,
          ownerId: input.ownerId ?? ctx.userId,
          hypothesis: input.hypothesis,
          expectedValue: input.expectedValue,
          status: "DRAFT",
          updatedBy: ctx.userId,
        },
      });
      await logSignalAudit(db, ctx, {
        action: "Iniciativa criada",
        entityType: "signal.initiative",
        entityId: row.id,
        target: `${code} · ${input.name}`,
      });
      return row;
    });

    revalidatePath("/signal/initiatives");
    return { code: created.code };
  });
}

export async function updateInitiative(
  raw: z.input<typeof UpdateSchema>
): Promise<SignalResult<{ code: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.initiative.write");
    const input = UpdateSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const before = await db.signalInitiative.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
      });
      if (!before) {
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${input.code} não encontrada nesta organização.`
        );
      }
      // O quinto portão: a permissão passou, a posse ainda não foi checada.
      requireInitiativeOwnership(ctx, before);

      const { code: _code, ...fields } = input;
      const after = await db.signalInitiative.update({
        where: { id: before.id },
        data: { ...fields, updatedBy: ctx.userId },
      });

      const diff = buildDiff(before, after, {
        name: FIELD_LABELS.name,
        businessUnit: FIELD_LABELS.businessUnit,
        category: FIELD_LABELS.category,
        ownerId: FIELD_LABELS.ownerId,
        hypothesis: FIELD_LABELS.hypothesis,
        expectedValue: FIELD_LABELS.expectedValue,
      });
      if (diff.length > 0) {
        await logSignalAudit(db, ctx, {
          action: "Iniciativa editada",
          entityType: "signal.initiative",
          entityId: before.id,
          target: `${before.code} · ${after.name}`,
          diff,
        });
      }
    });

    revalidatePath("/signal/initiatives");
    revalidatePath(`/signal/initiative/${input.code}`);
    return { code: input.code };
  });
}

/** O que o usuário pode fazer a partir do estado atual, em prosa. */
function validDestinations(from: InitiativeStatus): string {
  const labels = (["ACTIVE", "PAUSED", "CLOSED", "CANCELLED"] as const)
    .filter((s) => canTransition(from, s))
    .map((s) => STATUS_LABEL[s]);
  return labels.join(", ");
}

/**
 * As quatro pré-condições de uma transição, separadas da action.
 *
 * Ficam juntas aqui porque são a MESMA pergunta ("esta mudança de estado é
 * legítima?") vista de quatro ângulos, e porque a action já carrega guard,
 * carregamento e escrita — misturar tudo tornava a função ilegível e o lint
 * recusava, com razão.
 */
function assertTransitionAllowed(input: {
  from: InitiativeStatus;
  to: InitiativeStatus;
  hasSignedBaseline: boolean;
  reason?: string;
}): void {
  const { from, to } = input;

  if (from === to) {
    throw new SignalRuleError(
      "initiative.no-change",
      `A iniciativa já está em "${STATUS_LABEL[to]}".`
    );
  }

  if (!canTransition(from, to)) {
    const terminal = from === "CLOSED" || from === "CANCELLED";
    throw new SignalStateConflictError(
      "initiative.transition",
      `Não dá para ir de "${STATUS_LABEL[from]}" para "${STATUS_LABEL[to]}".`,
      [
        terminal
          ? "Iniciativa encerrada não reabre — crie uma nova, com hipótese nova."
          : `Transições válidas a partir de "${STATUS_LABEL[from]}": ${validDestinations(from)}.`,
      ]
    );
  }

  if (requiresSignedBaseline(to) && !input.hasSignedBaseline) {
    throw new SignalRuleError(
      "baseline.required",
      "Ative só depois de assinar o baseline — sem linha de base, a melhora medida depois não tem contra-prova."
    );
  }

  if (requiresReason(to) && (input.reason?.trim().length ?? 0) < REASON_MIN) {
    throw new SignalRuleError(
      "closure.reason.required",
      `Encerrar exige um motivo de pelo menos ${REASON_MIN} caracteres — é o que o comitê lê na próxima rodada de orçamento.`
    );
  }
}

/**
 * Escreve a transição e a trilha, na mesma transação.
 *
 * `startedAt` só é carimbado na PRIMEIRA ativação: uma iniciativa que pausa e
 * retoma não recomeça a contar do zero, senão toda série temporal dela mentiria
 * sobre há quanto tempo está rodando.
 */
async function applyTransition(args: {
  db: Db;
  ctx: SignalContext;
  before: { id: string; code: string; name: string; startedAt: Date | null };
  from: InitiativeStatus;
  to: InitiativeStatus;
  reason?: string;
}): Promise<void> {
  const { db, ctx, before, from, to } = args;
  const terminal = to === "CLOSED" || to === "CANCELLED";
  const reason = args.reason?.trim() ?? null;

  await db.signalInitiative.update({
    where: { id: before.id },
    data: {
      status: to,
      startedAt:
        to === "ACTIVE" && !before.startedAt ? new Date() : before.startedAt,
      closedAt: terminal ? new Date() : null,
      closedById: terminal ? ctx.userId : null,
      closureReason: terminal ? reason : null,
      updatedBy: ctx.userId,
    },
  });

  await logSignalAudit(db, ctx, {
    action: terminal ? "Iniciativa encerrada" : "Status alterado",
    entityType: "signal.initiative",
    entityId: before.id,
    target: `${before.code} · ${before.name}`,
    note: reason ?? undefined,
    diff: [[FIELD_LABELS.status, STATUS_LABEL[from], STATUS_LABEL[to]]],
  });
}

export async function transitionInitiative(
  raw: z.input<typeof TransitionSchema>
): Promise<SignalResult<{ status: InitiativeStatus }>> {
  return await signalAction(async () => {
    const input = TransitionSchema.parse(raw);
    // Encerrar é decisão de portfólio, não de dono de iniciativa.
    const ctx = await requireSignalPermissionContext(
      input.to === "CLOSED"
        ? "signal.initiative.close"
        : "signal.initiative.write"
    );

    await withTenantDb(ctx.tenantId, async (db) => {
      const before = await db.signalInitiative.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
        include: {
          baselines: { where: { signedAt: { not: null } }, take: 1 },
        },
      });
      if (!before) {
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${input.code} não encontrada nesta organização.`
        );
      }
      requireInitiativeOwnership(ctx, before);

      const from = before.status as InitiativeStatus;
      assertTransitionAllowed({
        from,
        to: input.to,
        hasSignedBaseline: before.baselines.length > 0,
        reason: input.reason,
      });

      await applyTransition({
        db,
        ctx,
        before,
        from,
        to: input.to,
        reason: input.reason,
      });
    });

    revalidatePath("/signal/initiatives");
    revalidatePath(`/signal/initiative/${input.code}`);
    return { status: input.to };
  });
}
