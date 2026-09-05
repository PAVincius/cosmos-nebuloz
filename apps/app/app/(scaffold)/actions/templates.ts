"use server";

import type { Prisma } from "@repo/database";
import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import {
  detectConflicts,
  type OverlayOp,
  type TemplateShape,
} from "@/lib/scaffold/overlay-merge";
import {
  PublishVersionSchema,
  ResolveConflictSchema,
  SaveOverlaySchema,
  TemplateIdSchema,
} from "@/lib/scaffold/schemas";
import { type Db, logScaffoldAudit } from "./_shared";

// Biblioteca de templates — S-05, S-12, ST-01..ST-04.
//
// Três regras que este arquivo existe para não quebrar:
//
//   ST-01  Versão publicada é IMUTÁVEL. Nenhuma função aqui atualiza
//          `ScaffoldTemplateVersion`; publicar cria linha nova.
//   ST-02  Overlay de cliente sobrevive ao upgrade, ou levanta conflito
//          explícito. Nunca sobrescrita silenciosa.
//   ST-03  Trilha em curso NÃO é afetada por publicação. Nenhum
//          `scaffoldStepInstance.update` sai deste arquivo — os passos foram
//          copiados na criação da trilha, e é isso que os protege.

/** Forma de uma versão, no formato que `overlay-merge` entende. */
function shapeOf(version: {
  steps: {
    key: string;
    statement: string;
    required: boolean;
    expectedArtefact: string;
  }[];
  criteria: { key: string; statement: string; evaluationType: string }[];
}): TemplateShape {
  return {
    steps: version.steps.map((s) => ({
      key: s.key,
      statement: s.statement,
      required: s.required,
      expectedArtefact: s.expectedArtefact,
    })),
    criteria: version.criteria.map((c) => ({
      key: c.key,
      statement: c.statement,
      evaluationType: c.evaluationType,
    })),
  };
}

async function loadShape(db: Db, versionId: string) {
  const v = await db.scaffoldTemplateVersion.findUnique({
    where: { id: versionId },
    include: {
      steps: { orderBy: { seq: "asc" } },
      criteria: { orderBy: { seq: "asc" } },
    },
  });
  return v ? { version: v, shape: shapeOf(v) } : null;
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export type TemplateVersionRow = {
  id: string;
  label: string;
  authorLabel: string;
  note: string;
  publishedAt: Date;
  stepCount: number;
  criterionCount: number;
  /** Quantas trilhas rodam nesta versão. Query agregada, nunca coluna: uma
   *  coluna desincronizaria da realidade no primeiro cancelamento. */
  trackCount: number;
};

export type OverlayRow = {
  id: string;
  name: string;
  baseVersionLabel: string;
  opCount: number;
  /** Ids dos conflitos abertos. A tela precisa deles para resolver: resolução é
   *  por conflito, não por overlay — dois conflitos no mesmo overlay podem
   *  merecer decisões opostas. */
  openConflictIds: string[];
};

export type TemplateRow = {
  id: string;
  key: string;
  name: string;
  archetype: string;
  currentLabel: string | null;
  publishedAt: Date | null;
  versions: TemplateVersionRow[];
  overlays: OverlayRow[];
};

export async function listTemplates(): Promise<ScaffoldResult<TemplateRow[]>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("portfolio.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const templates = await db.scaffoldTemplate.findMany({
        orderBy: { name: "asc" },
        include: {
          versions: {
            orderBy: { publishedAt: "desc" },
            include: {
              _count: { select: { steps: true, criteria: true } },
            },
          },
          // Overlays são do tenant: o template é global, a customização não.
          overlays: {
            where: { tenantId: ctx.tenantId },
            include: {
              baseVersion: { select: { label: true } },
              conflicts: {
                where: { resolvedAt: null },
                select: { id: true, targetKey: true, note: true },
              },
            },
          },
        },
      });

      // Contagem de trilhas por versão, num agregado só — evita N+1 sobre uma
      // tela que lista três templates com sete versões.
      const counts = await db.scaffoldTrack.groupBy({
        by: ["templateVersionId"],
        where: {
          tenantId: ctx.tenantId,
          status: { in: ["ACTIVE", "STALLED", "EMBEDDED"] },
        },
        _count: { _all: true },
      });
      const trackCount = new Map(
        counts.map((c) => [c.templateVersionId, c._count._all])
      );

      return templates.map((t): TemplateRow => {
        const latest = t.versions[0];
        return {
          id: t.id,
          key: t.key,
          name: t.name,
          archetype: t.archetype,
          currentLabel: latest?.label ?? null,
          publishedAt: latest?.publishedAt ?? null,
          versions: t.versions.map((v) => ({
            id: v.id,
            label: v.label,
            authorLabel: v.authorLabel,
            note: v.note,
            publishedAt: v.publishedAt,
            stepCount: v._count.steps,
            criterionCount: v._count.criteria,
            trackCount: trackCount.get(v.id) ?? 0,
          })),
          overlays: t.overlays.map((o) => ({
            id: o.id,
            name: o.name,
            baseVersionLabel: o.baseVersion.label,
            opCount: Array.isArray(o.ops) ? o.ops.length : 0,
            openConflictIds: o.conflicts.map((c) => c.id),
          })),
        };
      });
    });
  });
}

// ── Publicação ────────────────────────────────────────────────────────────────

export type PublishResult = {
  versionId: string;
  label: string;
  /** Conflitos gerados pela reaplicação dos overlays contra a base nova. Lista
   *  vazia = toda customização sobreviveu ao upgrade (ST-02). */
  conflicts: { overlayName: string; targetKey: string; note: string }[];
};

/**
 * Publica uma versão nova do método.
 *
 * Cria linha; NUNCA atualiza (ST-01). Não toca em trilha em curso (ST-03) — os
 * passos delas foram copiados na criação, e nenhuma escrita daqui alcança
 * `ScaffoldStepInstance`.
 *
 * Depois de publicar, reaplica todo overlay ativo contra a base nova e grava os
 * conflitos que sobrarem. Publicar não FALHA por causa de conflito: o método
 * novo é decisão da Nebuloz e não pode ficar refém da customização de um
 * cliente. O que trava é a criação de trilha nova com aquele overlay, até
 * alguém resolver.
 */
export async function publishVersion(
  raw: z.input<typeof PublishVersionSchema>
): Promise<ScaffoldResult<PublishResult>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("template.publish");
    const input = PublishVersionSchema.parse(raw);

    const out = await withTenantDb(ctx.tenantId, async (db) => {
      const template = await db.scaffoldTemplate.findUnique({
        where: { id: input.templateId },
        include: { versions: { orderBy: { publishedAt: "desc" }, take: 1 } },
      });
      if (!template) {
        throw new ScaffoldRuleError("TEMPLATE_HAS_NO_PUBLISHED_VERSION");
      }
      const duplicate = await db.scaffoldTemplateVersion.findUnique({
        where: {
          templateId_label: { templateId: template.id, label: input.label },
        },
        select: { id: true },
      });
      if (duplicate) {
        // Republicar o mesmo rótulo com conteúdo diferente reescreveria o
        // método sob o qual trilhas já rodam — é a violação de ST-01 mais
        // fácil de cometer sem perceber.
        throw new ScaffoldRuleError("VERSION_IMMUTABLE");
      }

      const created = await db.scaffoldTemplateVersion.create({
        data: {
          templateId: template.id,
          label: input.label,
          authorLabel: ctx.user.name ?? ctx.user.email ?? "método Nebuloz",
          note: input.note,
          publishedBy: ctx.userId,
          steps: {
            create: input.steps.map((s, i) => ({
              phase: s.phase,
              seq: i + 1,
              key: s.key,
              statement: s.statement,
              expectedArtefact: s.expectedArtefact,
              required: s.required,
              estimateMinutes: s.estimateMinutes ?? null,
            })),
          },
          criteria: {
            create: input.criteria.map((c, i) => ({
              phase: c.phase,
              seq: i + 1,
              key: c.key,
              statement: c.statement,
              evaluationType: c.evaluationType,
            })),
          },
        },
        select: { id: true, label: true },
      });

      const next = await loadShape(db, created.id);
      const overlays = await db.scaffoldTemplateOverlay.findMany({
        where: { tenantId: ctx.tenantId, templateId: template.id },
        include: { baseVersion: { select: { id: true, label: true } } },
      });

      const conflicts: PublishResult["conflicts"] = [];
      for (const overlay of overlays) {
        const base = await loadShape(db, overlay.baseVersionId);
        if (!(base && next)) {
          continue;
        }
        const found = detectConflicts(
          base.shape,
          next.shape,
          overlay.ops as unknown as OverlayOp[]
        );
        for (const c of found) {
          await db.scaffoldOverlayConflict.create({
            data: {
              tenantId: ctx.tenantId,
              overlayId: overlay.id,
              againstVersionId: created.id,
              targetType: c.target,
              targetKey: c.targetKey,
              field: c.field,
              reason: c.reason,
              note: c.note,
            },
          });
          conflicts.push({
            overlayName: overlay.name,
            targetKey: c.targetKey,
            note: c.note,
          });
        }
      }

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.template.publish",
        entityType: "scaffold.template",
        entityId: created.id,
        target: `${template.name} · ${created.label}`,
        note:
          conflicts.length > 0
            ? `${conflicts.length} conflito(s) de overlay para resolver.`
            : "Nenhum conflito de overlay.",
      });

      return { versionId: created.id, label: created.label, conflicts };
    });

    revalidatePath("/scaffold");
    return out;
  });
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export type SaveOverlayResult = {
  overlayId: string;
  conflicts: { targetKey: string; note: string }[];
};

/**
 * Cria ou atualiza o overlay do tenant sobre uma versão base.
 *
 * Ao salvar, já checa contra a versão MAIS RECENTE do template: se o cliente
 * escreve a customização sobre a v3 quando a v4 já existe, o conflito aparece
 * agora e não na próxima publicação.
 */
export async function saveOverlay(
  raw: z.input<typeof SaveOverlaySchema>
): Promise<ScaffoldResult<SaveOverlayResult>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("template.publish");
    const input = SaveOverlaySchema.parse(raw);

    const out = await withTenantDb(ctx.tenantId, async (db) => {
      const base = await loadShape(db, input.baseVersionId);
      if (!base || base.version.templateId !== input.templateId) {
        throw new ScaffoldRuleError("TEMPLATE_HAS_NO_PUBLISHED_VERSION");
      }

      const overlay = await db.scaffoldTemplateOverlay.upsert({
        where: {
          tenantId_templateId_name: {
            tenantId: ctx.tenantId,
            templateId: input.templateId,
            name: input.name,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          templateId: input.templateId,
          baseVersionId: input.baseVersionId,
          name: input.name,
          ops: input.ops as unknown as Prisma.InputJsonValue,
        },
        update: {
          baseVersionId: input.baseVersionId,
          ops: input.ops as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      // Conflitos anteriores deste overlay são descartados: as operações
      // mudaram, então a discordância antiga pode nem existir mais. Manter
      // deixaria o cliente resolvendo conflito de uma versão do overlay que
      // ele mesmo já reescreveu.
      await db.scaffoldOverlayConflict.deleteMany({
        where: { overlayId: overlay.id, resolvedAt: null },
      });

      const latest = await db.scaffoldTemplateVersion.findFirst({
        where: { templateId: input.templateId },
        orderBy: { publishedAt: "desc" },
        select: { id: true },
      });
      const conflicts: SaveOverlayResult["conflicts"] = [];

      if (latest && latest.id !== input.baseVersionId) {
        const next = await loadShape(db, latest.id);
        if (next) {
          for (const c of detectConflicts(
            base.shape,
            next.shape,
            input.ops as OverlayOp[]
          )) {
            await db.scaffoldOverlayConflict.create({
              data: {
                tenantId: ctx.tenantId,
                overlayId: overlay.id,
                againstVersionId: latest.id,
                targetType: c.target,
                targetKey: c.targetKey,
                field: c.field,
                reason: c.reason,
                note: c.note,
              },
            });
            conflicts.push({ targetKey: c.targetKey, note: c.note });
          }
        }
      }

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.overlay.save",
        entityType: "scaffold.overlay",
        entityId: overlay.id,
        target: `${input.name} · base ${base.version.label}`,
        note: `${input.ops.length} operação(ões).`,
      });

      return { overlayId: overlay.id, conflicts };
    });

    revalidatePath("/scaffold");
    return out;
  });
}

/**
 * Resolve um conflito.
 *
 * `keep_overlay` mantém a customização como está; `take_upstream` rebaseia o
 * overlay na versão nova e descarta a operação em disputa; `drop_operation`
 * remove a operação sem adotar nada.
 *
 * Os três marcam o conflito como resolvido — e é a resolução, não o tempo, que
 * destrava a criação de trilhas com este overlay.
 */
export async function resolveConflict(
  raw: z.input<typeof ResolveConflictSchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("template.publish");
    const input = ResolveConflictSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const conflict = await db.scaffoldOverlayConflict.findFirst({
        where: { id: input.conflictId, tenantId: ctx.tenantId },
        include: {
          overlay: { select: { id: true, name: true, ops: true } },
        },
      });
      if (!conflict) {
        throw new ScaffoldRuleError("OVERLAY_HAS_UNRESOLVED_CONFLICT");
      }

      if (input.resolution !== "keep_overlay") {
        const ops = (conflict.overlay.ops as unknown as OverlayOp[]).filter(
          (o) =>
            !(o.key === conflict.targetKey && o.target === conflict.targetType)
        );
        await db.scaffoldTemplateOverlay.update({
          where: { id: conflict.overlayId },
          data: {
            ops: ops as unknown as Prisma.InputJsonValue,
            // `take_upstream` rebaseia: a customização passa a ser escrita
            // contra o método novo. `drop_operation` só remove a operação e
            // deixa a base como estava.
            ...(input.resolution === "take_upstream"
              ? { baseVersionId: conflict.againstVersionId }
              : {}),
          },
        });
      }

      await db.scaffoldOverlayConflict.update({
        where: { id: conflict.id },
        data: {
          resolvedAt: new Date(),
          resolvedById: ctx.userId,
          resolution: input.resolution,
        },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.overlay.resolve-conflict",
        entityType: "scaffold.overlay",
        entityId: conflict.overlayId,
        target: `${conflict.overlay.name} · ${conflict.targetKey}`,
        note: `Resolvido como ${input.resolution}.`,
      });
    });

    revalidatePath("/scaffold");
  });
}

/** ST-04 — qual versão e qual overlay produziram os passos desta trilha.
 *  Duas colunas, sem reconstrução. */
export async function getTemplate(
  raw: z.input<typeof TemplateIdSchema>
): Promise<ScaffoldResult<TemplateRow | null>> {
  return scaffoldAction(async () => {
    await requireScaffoldPermissionContext("portfolio.read");
    const input = TemplateIdSchema.parse(raw);
    const all = await listTemplates();
    if (!all.ok) {
      throw new ScaffoldRuleError("TEMPLATE_HAS_NO_PUBLISHED_VERSION");
    }
    return all.data.find((t) => t.id === input.templateId) ?? null;
  });
}
