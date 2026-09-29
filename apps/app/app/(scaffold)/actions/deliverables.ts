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
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import {
  type DeliverableActor,
  type DeliverableSubject,
  type DeliverableTransition,
  decideEdit,
  decideTransition,
  deliverableGrants,
  type TransitionDenial,
} from "@/lib/scaffold/deliverable-machine";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import {
  requireScaffoldPermissionContext,
  type ScaffoldContext,
} from "@/lib/scaffold/guards";
import {
  AddDeliverableSchema,
  AssignDeliverableSchema,
  DeliverableIdSchema,
  DeliverableTransitionSchema,
  EditDeliverableSummarySchema,
  TrackIdSchema,
} from "@/lib/scaffold/schemas";
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
  throw new ScaffoldRuleError(
    code === "COMMENT_REQUIRED"
      ? "DELIVERABLE_COMMENT_REQUIRED"
      : "DELIVERABLE_TRANSITION_INVALID"
  );
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
    },
  });
  if (!d) {
    throw new ScaffoldRuleError("DELIVERABLE_NOT_FOUND");
  }
  return d;
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

    await withTenantDb(ctx.tenantId, async (db) => {
      const d = await loadSubject(db, ctx.tenantId, input.deliverableId);
      const decision = decideTransition(
        step.transition,
        d as DeliverableSubject,
        actorOf(ctx),
        input.comment
      );
      if (!decision.ok) {
        refuse(decision.code, decision.message);
      }

      const moved = await db.scaffoldDeliverableInstance.updateMany({
        where: { id: d.id, tenantId: ctx.tenantId, status: d.status },
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
    });

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
      const decision = decideEdit(d as DeliverableSubject, actorOf(ctx));
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
} as const;

/** Entregáveis da trilha, na ordem do método. Qualquer papel lê (SC-PO-04). */
export async function listDeliverables(raw: z.input<typeof TrackIdSchema>) {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("deliverable.read");
    const input = TrackIdSchema.parse(raw);
    return withTenantDb(ctx.tenantId, (db) =>
      db.scaffoldDeliverableInstance.findMany({
        where: { tenantId: ctx.tenantId, trackId: input.trackId },
        orderBy: [{ code: "asc" }],
        select: LIST_SELECT,
      })
    );
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
      return { ...d, events, comments, links };
    });
  });
}
