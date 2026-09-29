"use server";

import { AuthError } from "@repo/auth/server";
import type {
  ScaffoldDeliverableAction,
  ScaffoldDeliverableKind,
  ScaffoldDeliverableProducer,
  ScaffoldDeliverableStatus,
  ScaffoldPhase,
} from "@repo/database";
import { withTenantDb } from "@repo/database";
import { log } from "@repo/observability/log";
import {
  ensureBucket,
  SCAFFOLD_ALLOWED_MIME_TYPES,
  SCAFFOLD_ARTEFACT_BUCKET,
  scaffoldFileMimeType,
  storageClient,
} from "@repo/storage";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import {
  availableActions,
  type DeliverableActor,
  type DeliverableSubject,
  type DeliverableTransition,
  decideAttach,
  decideEdit,
  decideLink,
  decideTransition,
  deliverableGrants,
  effectiveStatus,
  type TransitionDenial,
} from "@/lib/scaffold/deliverable-machine";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import {
  appHostsFromEnv,
  checkExternalLink,
  PROVIDER_LABEL,
} from "@/lib/scaffold/external-links";
import { safeFileName } from "@/lib/scaffold/file-name";
import { emitGateReopened } from "@/lib/scaffold/gate-events";
import {
  requireScaffoldPermissionContext,
  type ScaffoldContext,
} from "@/lib/scaffold/guards";
import {
  AddDeliverableLinkSchema,
  AddDeliverableSchema,
  AssignDeliverableSchema,
  AttachDeliverableVersionSchema,
  DeliverableIdSchema,
  DeliverableTransitionSchema,
  EditDeliverableSummarySchema,
  ReadDeliverableFileSchema,
  RemoveDeliverableLinkSchema,
  TrackIdSchema,
} from "@/lib/scaffold/schemas";
import { reopenPhaseForDeliverable } from "./_phase-reopen";
import { type Db, logScaffoldAudit, nextCode } from "./_shared";

// Entregáveis da trilha (SC-DEV-03/05/07, SC-PO-03/04).
//
// A regra mora em `lib/scaffold/deliverable-machine.ts`. Aqui só se lê o
// entregável do tenant da sessão, pergunta à máquina, e grava status, evento
// append-only e auditoria numa transação. A escrita do status é condicional ao
// estado lido (`updateMany ... status`), para que duas pessoas agindo ao mesmo
// tempo não passem por cima uma da outra.

const actorOf = (ctx: ScaffoldContext): DeliverableActor => ({
  userId: ctx.userId,
  grants: deliverableGrants(ctx.scaffoldRole),
});

/** Recusa da máquina → erro tipado. Falta de permissão vira 403 (`AuthError`);
 *  estado e comentário são regra de domínio (422). */
function refuse(code: TransitionDenial, message: string): never {
  if (code === "FORBIDDEN" || code === "SELF_REVIEW") {
    throw new AuthError("FORBIDDEN", message);
  }
  const domain = {
    COMMENT_REQUIRED: "DELIVERABLE_COMMENT_REQUIRED",
    FILE_REQUIRED: "DELIVERABLE_FILE_REQUIRED",
    PHASE_NOT_OPEN: "DELIVERABLE_PHASE_NOT_OPEN",
    INVALID_TRANSITION: "DELIVERABLE_TRANSITION_INVALID",
  } as const;
  throw new ScaffoldRuleError(domain[code]);
}

async function loadSubject(db: Db, tenantId: string, deliverableId: string) {
  const d = await db.scaffoldDeliverableInstance.findFirst({
    where: { id: deliverableId, tenantId },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      ownerId: true,
      approverId: true,
      trackId: true,
      version: true,
      fileKey: true,
      fileName: true,
      track: { select: { code: true } },
      phaseInstance: { select: { id: true, phase: true, state: true } },
    },
  });
  if (!d) {
    throw new ScaffoldRuleError("DELIVERABLE_NOT_FOUND");
  }
  return d;
}

/** O entregável lido, no formato que a máquina de estados consome. */
function toSubject(d: {
  status: string;
  ownerId: string | null;
  approverId: string | null;
  fileKey: string | null;
  phaseInstance: { state: string };
}): DeliverableSubject {
  return {
    status: d.status as DeliverableSubject["status"],
    ownerId: d.ownerId,
    approverId: d.approverId,
    phaseState: d.phaseInstance.state as DeliverableSubject["phaseState"],
    hasFile: d.fileKey !== null,
  };
}

async function assertTenantMember(db: Db, tenantId: string, userId: string) {
  const m = await db.tenantMember.findFirst({
    where: { tenantId, userId },
    select: { userId: true },
  });
  if (!m) {
    throw new ScaffoldRuleError("MEMBER_NOT_IN_TENANT");
  }
}

// ── Transições ────────────────────────────────────────────────────────────────

type Step = {
  transition: DeliverableTransition;
  permission: "deliverable.work" | "deliverable.review" | "deliverable.reopen";
  event: ScaffoldDeliverableAction;
  audit: string;
};

async function runTransition(
  raw: z.input<typeof DeliverableTransitionSchema>,
  step: Step
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext(step.permission);
    const input = DeliverableTransitionSchema.parse(raw);

    const reopened = await withTenantDb(ctx.tenantId, async (db) => {
      const d = await loadSubject(db, ctx.tenantId, input.deliverableId);
      const decision = decideTransition(
        step.transition,
        toSubject(d),
        actorOf(ctx),
        input.comment
      );
      if (!decision.ok) {
        refuse(decision.code, decision.message);
      }

      // A versão é gravada ao emitir a URL de upload, antes do PUT. Enviar só
      // vale se o arquivo chegou de fato ao storage.
      if (step.transition === "SUBMIT" && d.fileKey) {
        const { data: present, error } = await storageClient.storage
          .from(SCAFFOLD_ARTEFACT_BUCKET)
          .exists(d.fileKey);
        if (error || !present) {
          throw new ScaffoldRuleError("DELIVERABLE_FILE_REQUIRED");
        }
      }

      // Aprovar e pedir ajuste valem para a versão do arquivo que o revisor viu:
      // se outra subiu no meio, nada é aprovado sem ter sido lido.
      const reviews =
        step.transition === "APPROVE" ||
        step.transition === "REQUEST_ADJUSTMENT";
      const moved = await db.scaffoldDeliverableInstance.updateMany({
        where: {
          id: d.id,
          tenantId: ctx.tenantId,
          status: d.status,
          ...(reviews ? { version: d.version } : {}),
        },
        data: { status: decision.to },
      });
      if (moved.count !== 1) {
        throw new ScaffoldRuleError("DELIVERABLE_TRANSITION_INVALID");
      }

      const comment = input.comment?.trim() || null;
      await db.scaffoldDeliverableEvent.create({
        data: {
          tenantId: ctx.tenantId,
          deliverableId: d.id,
          action: step.event,
          actorId: ctx.userId,
          fromStatus: d.status,
          toStatus: decision.to,
          version: d.version,
          comment,
        },
      });
      await logScaffoldAudit(db, ctx, {
        action: step.audit,
        entityType: "scaffold.deliverable",
        entityId: d.id,
        target: `${d.code} · ${d.title}`,
        note: comment ?? undefined,
        diff: [["Estado", d.status, decision.to]],
      });

      // Reabrir um aprovado tira a fase do estado em que ele a fazia estar
      // pronta ou fechada (SC-PO-03).
      if (step.transition === "REOPEN") {
        return reopenPhaseForDeliverable(db, ctx, {
          phase: d.phaseInstance,
          trackId: d.trackId,
          trackCode: d.track.code,
          deliverableCode: d.code,
        });
      }
      return null;
    });

    // Depois da transação: evento de fase que ainda poderia desfazer não presta.
    // Falha do emissor não desfaz a reabertura já gravada.
    if (reopened) {
      try {
        await emitGateReopened(reopened);
      } catch (e) {
        log.error("[scaffold] gate.reopened não emitido", {
          error: String(e),
        });
      }
    }

    revalidatePath("/scaffold");
  });
}

export async function startDeliverable(
  raw: z.input<typeof DeliverableTransitionSchema>
) {
  return runTransition(raw, {
    transition: "START",
    permission: "deliverable.work",
    event: "START",
    audit: "scaffold.deliverable.start",
  });
}

export async function submitDeliverable(
  raw: z.input<typeof DeliverableTransitionSchema>
) {
  return runTransition(raw, {
    transition: "SUBMIT",
    permission: "deliverable.work",
    event: "SUBMIT",
    audit: "scaffold.deliverable.submit",
  });
}

export async function approveDeliverable(
  raw: z.input<typeof DeliverableTransitionSchema>
) {
  return runTransition(raw, {
    transition: "APPROVE",
    permission: "deliverable.review",
    event: "APPROVE",
    audit: "scaffold.deliverable.approve",
  });
}

export async function requestDeliverableAdjustment(
  raw: z.input<typeof DeliverableTransitionSchema>
) {
  return runTransition(raw, {
    transition: "REQUEST_ADJUSTMENT",
    permission: "deliverable.review",
    event: "REQUEST_ADJUSTMENT",
    audit: "scaffold.deliverable.request-adjustment",
  });
}

export async function reopenDeliverable(
  raw: z.input<typeof DeliverableTransitionSchema>
) {
  return runTransition(raw, {
    transition: "REOPEN",
    permission: "deliverable.reopen",
    event: "REOPEN",
    audit: "scaffold.deliverable.reopen",
  });
}

// ── Edição, atribuição e extra ────────────────────────────────────────────────

export async function editDeliverableSummary(
  raw: z.input<typeof EditDeliverableSummarySchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.work");
    const input = EditDeliverableSummarySchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const d = await loadSubject(db, ctx.tenantId, input.deliverableId);
      const decision = decideEdit(toSubject(d), actorOf(ctx));
      if (!decision.ok) {
        refuse(decision.code, decision.message);
      }
      await db.scaffoldDeliverableInstance.update({
        where: { id: d.id },
        data: { summary: input.summary },
      });
      await db.scaffoldDeliverableEvent.create({
        data: {
          tenantId: ctx.tenantId,
          deliverableId: d.id,
          action: "EDIT",
          actorId: ctx.userId,
          fromStatus: d.status,
          toStatus: d.status,
          version: d.version,
        },
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.deliverable.edit",
        entityType: "scaffold.deliverable",
        entityId: d.id,
        target: `${d.code} · ${d.title}`,
      });
    });

    revalidatePath("/scaffold");
  });
}

/** Define responsável e/ou aprovador. Quem adiciona entregável é quem os
 *  designa (`deliverable.add`). Os dois têm de ser do tenant, e não podem ser a
 *  mesma pessoa: um entregável cujo aprovador é o responsável não teria quem o
 *  aprovasse. */
export async function assignDeliverable(
  raw: z.input<typeof AssignDeliverableSchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.add");
    const input = AssignDeliverableSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const d = await loadSubject(db, ctx.tenantId, input.deliverableId);
      const ownerId = input.ownerId ?? d.ownerId;
      const approverId = input.approverId ?? d.approverId;
      if (ownerId && approverId && ownerId === approverId) {
        throw new ScaffoldRuleError("DELIVERABLE_SELF_REVIEW");
      }
      for (const id of [input.ownerId, input.approverId]) {
        if (id) {
          await assertTenantMember(db, ctx.tenantId, id);
        }
      }
      await db.scaffoldDeliverableInstance.update({
        where: { id: d.id },
        data: {
          ...(input.ownerId ? { ownerId: input.ownerId } : {}),
          ...(input.approverId ? { approverId: input.approverId } : {}),
        },
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.deliverable.assign",
        entityType: "scaffold.deliverable",
        entityId: d.id,
        target: `${d.code} · ${d.title}`,
        diff: [
          ["Responsável", d.ownerId ?? "—", ownerId ?? "—"],
          ["Aprovador", d.approverId ?? "—", approverId ?? "—"],
        ],
      });
    });

    revalidatePath("/scaffold");
  });
}

/** Entregável fora do template (SC-PO-04). Quem adiciona escolhe se é
 *  obrigatório — é o que decide se ele trava o gate da fase. */
export async function addDeliverable(
  raw: z.input<typeof AddDeliverableSchema>
): Promise<ScaffoldResult<{ deliverableId: string; code: string }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.add");
    const input = AddDeliverableSchema.parse(raw);

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      // A fase é escopada pela trilha do tenant: `phaseInstanceId` de outra
      // organização não pode ganhar entregável aqui.
      const phase = await db.scaffoldPhaseInstance.findFirst({
        where: {
          trackId: input.trackId,
          phase: input.phase as ScaffoldPhase,
          track: { tenantId: ctx.tenantId },
        },
        select: { id: true },
      });
      if (!phase) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }
      for (const id of [input.ownerId, input.approverId]) {
        if (id) {
          await assertTenantMember(db, ctx.tenantId, id);
        }
      }
      if (input.ownerId && input.ownerId === input.approverId) {
        throw new ScaffoldRuleError("DELIVERABLE_SELF_REVIEW");
      }

      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: `deliverable:${input.trackId}`,
        prefix: "X",
      });
      const row = await db.scaffoldDeliverableInstance.create({
        data: {
          tenantId: ctx.tenantId,
          trackId: input.trackId,
          phaseInstanceId: phase.id,
          stepCode: "X",
          code,
          title: input.title,
          description: input.description,
          kind: input.kind as ScaffoldDeliverableKind,
          producer: input.producer as ScaffoldDeliverableProducer,
          isExtra: true,
          required: input.required,
          status: "NOT_STARTED" as ScaffoldDeliverableStatus,
          ownerId: input.ownerId ?? null,
          approverId: input.approverId ?? null,
        },
        select: { id: true, code: true },
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.deliverable.add",
        entityType: "scaffold.deliverable",
        entityId: row.id,
        target: `${row.code} · ${input.title}`,
        note: input.required ? "Obrigatório." : "Opcional.",
      });
      return row;
    });

    revalidatePath("/scaffold");
    return { deliverableId: created.id, code: created.code };
  });
}

// ── Leitura ───────────────────────────────────────────────────────────────────

const LIST_SELECT = {
  id: true,
  phaseInstanceId: true,
  stepCode: true,
  code: true,
  title: true,
  description: true,
  kind: true,
  producer: true,
  isExtra: true,
  required: true,
  dispensedReason: true,
  status: true,
  ownerId: true,
  approverId: true,
  summary: true,
  dueAt: true,
  version: true,
  fileName: true,
  fileKey: true,
  phaseInstance: { select: { state: true } },
} as const;

/** A linha sem a chave do objeto no storage: o cliente só precisa saber se há
 *  arquivo e como ele se chama. Baixar passa por `readDeliverableFile`, que
 *  audita. */
function publicRow<
  T extends { fileKey: string | null; phaseInstance: { state: string } },
>({ fileKey, phaseInstance: _phase, ...rest }: T) {
  return { ...rest, hasFile: fileKey !== null };
}

const DERIVED_REASON = "Aprovado pela assinatura do caso de negócio.";

export type LastReview = {
  action: "REQUEST_ADJUSTMENT" | "REOPEN";
  comment: string;
  byName: string;
  at: Date;
};

/**
 * O último pedido de ajuste (ou reabertura) de cada entregável que ainda o
 * espera, para quem produz ver o que precisa mudar (Crivo F1). O comentário já
 * era gravado no evento; faltava mostrá-lo. Só vale enquanto o pedido está de
 * pé: em revisão ou aprovado, o comentário velho seria ruído.
 */
async function lastReviews(
  db: Db,
  tenantId: string,
  rows: { id: string; status: string }[]
): Promise<Map<string, LastReview>> {
  const pending = rows.filter(
    (d) => d.status === "ADJUSTMENT_REQUESTED" || d.status === "REOPENED"
  );
  const out = new Map<string, LastReview>();
  if (pending.length === 0) {
    return out;
  }
  const events = await db.scaffoldDeliverableEvent.findMany({
    where: {
      tenantId,
      deliverableId: { in: pending.map((d) => d.id) },
      action: { in: ["REQUEST_ADJUSTMENT", "REOPEN"] },
    },
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, (typeof events)[number]>();
  for (const e of events) {
    // Ordem decrescente: o primeiro de cada entregável é o mais recente.
    if (!latest.has(e.deliverableId)) {
      latest.set(e.deliverableId, e);
    }
  }
  const people = await db.user.findMany({
    where: {
      id: { in: [...new Set([...latest.values()].map((e) => e.actorId))] },
    },
    select: { id: true, name: true, email: true },
  });
  const nameOf = new Map(people.map((u) => [u.id, u.name ?? u.email ?? u.id]));
  for (const [id, e] of latest) {
    out.set(id, {
      action: e.action as LastReview["action"],
      comment: e.comment ?? "",
      byName: nameOf.get(e.actorId) ?? e.actorId,
      at: e.createdAt,
    });
  }
  return out;
}

export type LinkView = {
  id: string;
  provider: string;
  externalId: string;
  url: string;
};

/** Vínculos externos de cada entregável, numa consulta só. */
async function linksOf(
  db: Db,
  tenantId: string,
  rows: { id: string }[]
): Promise<Map<string, LinkView[]>> {
  const out = new Map<string, LinkView[]>();
  if (rows.length === 0) {
    return out;
  }
  const found = await db.scaffoldDeliverableLink.findMany({
    where: { tenantId, deliverableId: { in: rows.map((d) => d.id) } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      deliverableId: true,
      provider: true,
      externalId: true,
      url: true,
    },
  });
  for (const { deliverableId, ...link } of found) {
    out.set(deliverableId, [...(out.get(deliverableId) ?? []), link]);
  }
  return out;
}

const linkAccessOf = (
  d: { ok: true } | { ok: false; message: string }
): { allowed: boolean; reason: string | null } =>
  d.ok
    ? { allowed: true, reason: null }
    : { allowed: false, reason: d.message };

/** Entregáveis da trilha, na ordem do método. Qualquer papel lê (SC-PO-04). */
export async function listDeliverables(raw: z.input<typeof TrackIdSchema>) {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.read");
    const input = TrackIdSchema.parse(raw);
    const { rows, reviews, links, signed } = await withTenantDb(
      ctx.tenantId,
      async (db) => {
        const found = await db.scaffoldDeliverableInstance.findMany({
          where: { tenantId: ctx.tenantId, trackId: input.trackId },
          orderBy: [{ code: "asc" }],
          select: LIST_SELECT,
        });
        // O A3.2 é o caso de negócio: a lista precisa saber se ele está assinado
        // para mostrar o que o gate já conta (Crivo G1).
        const bc = found.length
          ? await db.scaffoldBusinessCase.findFirst({
              where: { tenantId: ctx.tenantId, trackId: input.trackId },
              select: { signedVersionId: true },
            })
          : null;
        return {
          rows: found,
          reviews: await lastReviews(db, ctx.tenantId, found),
          links: await linksOf(db, ctx.tenantId, found),
          signed: Boolean(bc?.signedVersionId),
        };
      }
    );
    // O que o ator pode fazer, calculado no servidor: a tela desabilita o
    // controle com o motivo e nunca precisa conhecer papel nem regra.
    const actor = actorOf(ctx);
    return rows.map((d) => {
      const subject = toSubject(d);
      const shown = effectiveStatus(
        d.code,
        d.status as DeliverableSubject["status"],
        signed
      );
      // Derivado da assinatura: a lista mostra o que o gate conta, e nenhuma ação
      // manual mexe nele (aprovar, reabrir ou enviar à mão contradiria a
      // assinatura, que é a única fonte).
      const derived = shown !== d.status;
      const attach = decideAttach(subject, actor);
      const denied = { allowed: false, reason: DERIVED_REASON };
      return {
        ...publicRow(d),
        status: shown,
        derived,
        lastReview: reviews.get(d.id) ?? null,
        links: links.get(d.id) ?? [],
        linkAccess: linkAccessOf(decideLink(subject, actor)),
        actions: derived
          ? {
              START: denied,
              SUBMIT: denied,
              APPROVE: denied,
              REQUEST_ADJUSTMENT: denied,
              REOPEN: denied,
            }
          : availableActions(subject, actor),
        attach: derived
          ? denied
          : attach.ok
            ? { allowed: true, reason: null }
            : { allowed: false, reason: attach.message },
      };
    });
  });
}

/** Entregável com histórico append-only, comentários e links. */
export async function getDeliverable(raw: z.input<typeof DeliverableIdSchema>) {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.read");
    const input = DeliverableIdSchema.parse(raw);
    return withTenantDb(ctx.tenantId, async (db) => {
      const d = await db.scaffoldDeliverableInstance.findFirst({
        where: { id: input.deliverableId, tenantId: ctx.tenantId },
        select: LIST_SELECT,
      });
      if (!d) {
        throw new ScaffoldRuleError("DELIVERABLE_NOT_FOUND");
      }
      const where = {
        tenantId: ctx.tenantId,
        deliverableId: d.id,
      };
      const [events, comments, links] = await Promise.all([
        db.scaffoldDeliverableEvent.findMany({
          where,
          orderBy: { createdAt: "asc" },
        }),
        db.scaffoldDeliverableComment.findMany({
          where,
          orderBy: { createdAt: "asc" },
        }),
        db.scaffoldDeliverableLink.findMany({
          where,
          orderBy: { createdAt: "asc" },
        }),
      ]);
      return { ...publicRow(d), events, comments, links };
    });
  });
}

// ── Arquivo do entregável (SC-PO-03: enviar exige arquivo) ────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// O bucket nasce (ou é atualizado) com o limite de tamanho e de tipo. Uma vez
// por processo, como o do Meridian: listar buckets a cada anexo seria custo à
// toa. Falha não impede o anexo (a action já filtra por extensão e tamanho) e
// a próxima tentativa refaz.
let bucketReady: Promise<void> | null = null;
function ensureScaffoldBucket(): Promise<void> {
  bucketReady ??= ensureBucket(SCAFFOLD_ARTEFACT_BUCKET).catch((e) => {
    bucketReady = null;
    log.error("[scaffold] bucket não configurado", { error: String(e) });
  });
  return bucketReady;
}
const FILE_URL_TTL_SECONDS = 300;

/**
 * Anexa a versão vN do arquivo do entregável e devolve a URL assinada de upload.
 *
 * O bucket é privado e a chave é sempre do tenant e da trilha, com a versão no
 * caminho: `<tenant>/<trilha>/deliverables/<id>/v<N>/<arquivo>`. Assim toda
 * versão anterior segue no storage, e o histórico (append-only) guarda só o
 * número e o nome. A URL é emitida ANTES de gravar: se o storage falhar, nada
 * fica apontando para arquivo que não existe.
 */
export async function attachDeliverableVersion(
  raw: z.input<typeof AttachDeliverableVersionSchema>
) {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.work");
    const input = AttachDeliverableVersionSchema.parse(raw);
    if (input.sizeBytes > MAX_FILE_BYTES) {
      throw new ScaffoldRuleError("ARTEFACT_TOO_LARGE");
    }
    // O cliente escolhe o arquivo: a extensão é a lista de permissão e o tipo
    // que vale é o dela. O declarado só não pode contradizê-la (um .pdf que se
    // diz text/html), e o PUT usa o canônico.
    const contentType = scaffoldFileMimeType(input.filename);
    if (
      !(contentType && SCAFFOLD_ALLOWED_MIME_TYPES.includes(input.contentType))
    ) {
      throw new ScaffoldRuleError("DELIVERABLE_FILE_TYPE_NOT_ALLOWED");
    }

    const out = await withTenantDb(ctx.tenantId, async (db) => {
      const d = await loadSubject(db, ctx.tenantId, input.deliverableId);
      const decision = decideAttach(toSubject(d), actorOf(ctx));
      if (!decision.ok) {
        refuse(decision.code, decision.message);
      }

      const version = d.version + 1;
      const fileName = safeFileName(input.filename);
      const fileKey = `${ctx.tenantId}/${d.trackId}/deliverables/${d.id}/v${version}/${fileName}`;

      await ensureScaffoldBucket();
      const { data, error } = await storageClient.storage
        .from(SCAFFOLD_ARTEFACT_BUCKET)
        .createSignedUploadUrl(fileKey);
      if (error || !data) {
        throw new Error(
          `Falha ao emitir URL de upload: ${error?.message ?? "sem resposta"}`
        );
      }

      // Condicional à versão lida: dois envios ao mesmo tempo não se
      // sobrescrevem em silêncio, e o número de versão não pula nem repete.
      const moved = await db.scaffoldDeliverableInstance.updateMany({
        // Estado E versão lidos: um SUBMIT concorrente não deixa o anexo trocar o
        // arquivo de um entregável que já foi para revisão.
        where: {
          id: d.id,
          tenantId: ctx.tenantId,
          status: d.status,
          version: d.version,
        },
        data: { version, fileKey, fileName },
      });
      if (moved.count !== 1) {
        throw new ScaffoldRuleError("DELIVERABLE_TRANSITION_INVALID");
      }
      await db.scaffoldDeliverableEvent.create({
        data: {
          tenantId: ctx.tenantId,
          deliverableId: d.id,
          action: "ATTACH_VERSION",
          actorId: ctx.userId,
          fromStatus: d.status,
          toStatus: d.status,
          version,
          // O histórico não tem coluna de arquivo: o nome vai aqui, e a chave é
          // reconstruída da convenção acima.
          comment: fileName,
        },
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.deliverable.attach",
        entityType: "scaffold.deliverable",
        entityId: d.id,
        target: `${d.code} · ${fileName}`,
        diff: [["Versão do arquivo", `v${d.version}`, `v${version}`]],
      });
      return { uploadUrl: data.signedUrl, version, fileName, contentType };
    });

    revalidatePath("/scaffold");
    return out;
  });
}

/**
 * URL assinada de leitura do arquivo (atual ou de uma versão anterior), com a
 * trilha de auditoria gravada ANTES de emitir. Qualquer papel lê (SC-PO-04),
 * e por isso o log é o que diz quem baixou o quê.
 */
export async function readDeliverableFile(
  raw: z.input<typeof ReadDeliverableFileSchema>
) {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.read");
    const input = ReadDeliverableFileSchema.parse(raw);

    const target = await withTenantDb(ctx.tenantId, async (db) => {
      const d = await loadSubject(db, ctx.tenantId, input.deliverableId);

      let fileKey = d.fileKey;
      let fileName = d.fileName;
      let version = d.version;
      if (input.version !== undefined && input.version !== d.version) {
        const ev = await db.scaffoldDeliverableEvent.findMany({
          where: {
            tenantId: ctx.tenantId,
            deliverableId: d.id,
            action: "ATTACH_VERSION",
            version: input.version,
          },
          take: 1,
        });
        fileName = ev[0]?.comment ?? null;
        version = input.version;
        fileKey = fileName
          ? `${ctx.tenantId}/${d.trackId}/deliverables/${d.id}/v${version}/${fileName}`
          : null;
      }
      if (!(fileKey && fileName)) {
        throw new ScaffoldRuleError("DELIVERABLE_NO_FILE");
      }

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.deliverable.read",
        entityType: "scaffold.deliverable",
        entityId: d.id,
        target: `${d.code} · ${fileName}`,
        note: `URL assinada emitida para download da v${version}.`,
      });
      return { fileKey, fileName, version };
    });

    const { data, error } = await storageClient.storage
      .from(SCAFFOLD_ARTEFACT_BUCKET)
      // `download`: o navegador baixa com o nome do arquivo, em vez de abrir
      // inline o que o cliente subiu.
      .createSignedUrl(target.fileKey, FILE_URL_TTL_SECONDS, {
        download: target.fileName,
      });
    if (error || !data) {
      throw new Error(
        `Falha ao emitir URL de arquivo: ${error?.message ?? "sem resposta"}`
      );
    }
    return {
      url: data.signedUrl,
      expiresIn: FILE_URL_TTL_SECONDS,
      fileName: target.fileName,
      version: target.version,
    };
  });
}

// ── Vínculos com item externo (S6, Norte e.2) ─────────────────────────────────

const MAX_LINKS = 20;

/**
 * Liga o entregável a um item externo (Cosmos, Linear, GitHub ou Jira).
 *
 * É REFERÊNCIA: o servidor não busca a URL (sem fetch, sem SSRF) e o estado do
 * item externo nunca muda o do entregável. A URL vem do usuário e vira link
 * clicável para outras pessoas, então só entra host da lista do provedor, em
 * https (ver `checkExternalLink`). Quem é responsável liga; aprovado também
 * aceita, porque referência não é conteúdo, mas fase que não abriu é só leitura.
 */
export async function addDeliverableLink(
  raw: z.input<typeof AddDeliverableLinkSchema>
) {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.work");
    const input = AddDeliverableLinkSchema.parse(raw);

    const checked = checkExternalLink(input, {
      appHosts: appHostsFromEnv(process.env.NEXT_PUBLIC_APP_URL),
    });
    if (!checked.ok) {
      throw new ScaffoldRuleError("DELIVERABLE_LINK_INVALID", [
        checked.message,
      ]);
    }

    const created = await withTenantDb(ctx.tenantId, async (db) => {
      const d = await loadSubject(db, ctx.tenantId, input.deliverableId);
      const decision = decideLink(toSubject(d), actorOf(ctx));
      if (!decision.ok) {
        refuse(decision.code, decision.message);
      }

      const same = await db.scaffoldDeliverableLink.findFirst({
        where: {
          tenantId: ctx.tenantId,
          deliverableId: d.id,
          provider: input.provider,
          externalId: checked.externalId,
        },
        select: { id: true },
      });
      if (same) {
        throw new ScaffoldRuleError("DELIVERABLE_LINK_DUPLICATE");
      }
      const total = await db.scaffoldDeliverableLink.count({
        where: { tenantId: ctx.tenantId, deliverableId: d.id },
      });
      if (total >= MAX_LINKS) {
        throw new ScaffoldRuleError("DELIVERABLE_LINK_LIMIT");
      }

      const link = await db.scaffoldDeliverableLink.create({
        data: {
          tenantId: ctx.tenantId,
          deliverableId: d.id,
          provider: input.provider,
          externalId: checked.externalId,
          url: checked.url,
          createdById: ctx.userId,
        },
        select: { id: true },
      });
      // O id externo, e não a URL: o log de auditoria não é lugar de URL de
      // terceiro.
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.deliverable.link-add",
        entityType: "scaffold.deliverable",
        entityId: d.id,
        target: `${d.code} · ${PROVIDER_LABEL[input.provider]} ${checked.externalId}`,
      });
      return link;
    });

    revalidatePath("/scaffold");
    return { linkId: created.id };
  });
}

/** Desliga o vínculo. Mesma regra de escopo e de fase de ligar. */
export async function removeDeliverableLink(
  raw: z.input<typeof RemoveDeliverableLinkSchema>
) {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.work");
    const input = RemoveDeliverableLinkSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const link = await db.scaffoldDeliverableLink.findFirst({
        where: { id: input.linkId, tenantId: ctx.tenantId },
        select: {
          id: true,
          deliverableId: true,
          provider: true,
          externalId: true,
        },
      });
      if (!link) {
        throw new ScaffoldRuleError("DELIVERABLE_LINK_NOT_FOUND");
      }
      const d = await loadSubject(db, ctx.tenantId, link.deliverableId);
      const decision = decideLink(toSubject(d), actorOf(ctx));
      if (!decision.ok) {
        refuse(decision.code, decision.message);
      }
      await db.scaffoldDeliverableLink.delete({ where: { id: link.id } });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.deliverable.link-remove",
        entityType: "scaffold.deliverable",
        entityId: d.id,
        target: `${d.code} · ${PROVIDER_LABEL[link.provider]} ${link.externalId}`,
      });
    });

    revalidatePath("/scaffold");
  });
}
