"use server";

import { type CharterSectionStatus, withTenantDb } from "@repo/database";
import { hasCharterPermission } from "@repo/rbac";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  GovernanceError,
  requireCharterContext,
  requireCharterPermissionContext,
  StateConflictError,
} from "@/lib/charter/guards";
import { policyPublishBlockers } from "@/lib/charter/rules";
import { type Result, safeAction } from "../../actions/_base";
import { buildDiff, FIELD_LABELS, logCharterAudit } from "./_shared";

// Política — FR-2. As três abas (Seções, Versões, Escopo) leem de getPolicy().

export type SectionView = {
  id: string;
  ordinal: number;
  name: string;
  status: CharterSectionStatus;
  owner: string | null;
  updatedAt: string;
  words: number;
  body: string;
  generated: boolean;
};

export type VersionView = {
  id: string;
  version: string;
  status: string;
  summary: string;
  publishedAt: string;
  publishedBy: string | null;
  changeCount: number;
};

export type PolicyView = {
  id: string;
  name: string;
  version: string | null;
  publishedAt: string | null;
  nextReview: string | null;
  daysToReview: number | null;
  scope: string | null;
  sections: SectionView[];
  versions: VersionView[];
  blockers: { id: string; name: string; status: CharterSectionStatus }[];
  canPublish: boolean;
  /** Permissões do papel da sessão. O cliente não pode importar @repo/rbac
   *  (server-only), então a matriz é resolvida aqui. */
  can: { edit: boolean; publish: boolean };
};

const WORD_SPLIT = /\s+/;

/** Contagem de palavras — derivada, não persistida: o corpo é a verdade. */
function wordCount(body: string): number {
  return body.trim() ? body.trim().split(WORD_SPLIT).length : 0;
}

export async function getPolicy(): Promise<Result<PolicyView | null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const policy = await db.charterPolicy.findFirst({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: "asc" },
        include: {
          sections: { orderBy: { ordinal: "asc" } },
          versions: { orderBy: { publishedAt: "desc" } },
        },
      });
      if (!policy) {
        return null;
      }

      const sections: SectionView[] = policy.sections.map((s) => ({
        id: s.id,
        ordinal: s.ordinal,
        name: s.name,
        status: s.status,
        owner: s.ownerId,
        updatedAt: s.updatedAt.toISOString(),
        words: wordCount(s.body),
        body: s.body,
        generated: s.generated,
      }));

      const blockers = policyPublishBlockers(
        sections.map((s) => ({ id: s.id, name: s.name, status: s.status }))
      );

      return {
        id: policy.id,
        name: policy.name,
        version: policy.version,
        publishedAt: policy.publishedAt?.toISOString() ?? null,
        nextReview: policy.nextReview?.toISOString() ?? null,
        daysToReview: policy.nextReview
          ? Math.ceil((policy.nextReview.getTime() - Date.now()) / 86_400_000)
          : null,
        scope: policy.scope,
        sections,
        versions: policy.versions.map((v) => ({
          id: v.id,
          version: v.version,
          status: v.status,
          summary: v.summary,
          publishedAt: v.publishedAt.toISOString(),
          publishedBy: v.publishedById,
          changeCount: v.changeCount,
        })),
        blockers,
        canPublish: blockers.length === 0,
        can: {
          edit: hasCharterPermission(ctx.charterRole, "policy.edit"),
          publish: hasCharterPermission(ctx.charterRole, "policy.publish"),
        },
      };
    });
  });
}

// ── Editar seção (FR-2.2) ─────────────────────────────────────────────────────

const EditSchema = z.object({
  sectionId: z.string().cuid(),
  body: z
    .string()
    .trim()
    .min(1, "Corpo da seção não pode ficar vazio")
    .max(40_000),
});

export async function editSection(
  input: z.infer<typeof EditSchema>
): Promise<Result<{ status: CharterSectionStatus }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("policy.edit");
    const data = EditSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const section = await db.charterPolicySection.findFirst({
        where: { id: data.sectionId, tenantId: ctx.tenantId },
      });
      if (!section) {
        throw new GovernanceError("section.unknown", "Seção não encontrada.");
      }

      // Editar seção publicada a rebaixa para revisão automaticamente: texto
      // alterado não é mais o texto que foi aprovado.
      const nextStatus: CharterSectionStatus =
        section.status === "PUBLISHED" ? "REVIEW" : section.status;

      await db.charterPolicySection.update({
        where: { id: section.id },
        data: { body: data.body, status: nextStatus, ownerId: ctx.userId },
      });

      await logCharterAudit(db, ctx, {
        action: "Editou seção",
        entityType: "charter.section",
        entityId: section.id,
        target: `S${String(section.ordinal).padStart(2, "0")} · ${section.name}`,
        diff: buildDiff(
          { status: section.status, words: wordCount(section.body) },
          { status: nextStatus, words: wordCount(data.body) },
          { status: FIELD_LABELS.status, words: "Palavras" }
        ),
      });

      revalidatePath("/charter", "layout");
      return { status: nextStatus };
    });
  });
}

// ── Rascunho assistido (FR-2.7) ───────────────────────────────────────────────

const DraftSchema = z.object({
  sectionId: z.string().cuid(),
  body: z.string().trim().min(1).max(40_000),
});

/** Persiste o rascunho gerado. Entra sempre como DRAFT — nunca PUBLISHED,
 *  nem REVIEW: texto que ninguém leu não pode estar em revisão. */
export async function saveGeneratedDraft(
  input: z.infer<typeof DraftSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("policy.edit");
    const data = DraftSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const section = await db.charterPolicySection.findFirst({
        where: { id: data.sectionId, tenantId: ctx.tenantId },
      });
      if (!section) {
        throw new GovernanceError("section.unknown", "Seção não encontrada.");
      }

      await db.charterPolicySection.update({
        where: { id: section.id },
        data: { body: data.body, status: "DRAFT", generated: true },
      });

      await logCharterAudit(db, ctx, {
        action: "Gerou rascunho de seção",
        entityType: "charter.section",
        entityId: section.id,
        target: `S${String(section.ordinal).padStart(2, "0")} · ${section.name}`,
        note: "Rascunho assistido — exige revisão humana antes de publicar.",
        diff: [["Status", section.status, "DRAFT"]],
      });

      revalidatePath("/charter", "layout");
      return null;
    });
  });
}

const SectionStatusSchema = z.object({
  sectionId: z.string().cuid(),
  status: z.enum(["PUBLISHED", "REVIEW", "DRAFT"]),
});

export async function setSectionStatus(
  input: z.infer<typeof SectionStatusSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("policy.edit");
    const data = SectionStatusSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const section = await db.charterPolicySection.findFirst({
        where: { id: data.sectionId, tenantId: ctx.tenantId },
      });
      if (!section) {
        throw new GovernanceError("section.unknown", "Seção não encontrada.");
      }
      await db.charterPolicySection.update({
        where: { id: section.id },
        data: { status: data.status },
      });
      await logCharterAudit(db, ctx, {
        action: "Alterou status de seção",
        entityType: "charter.section",
        entityId: section.id,
        target: `S${String(section.ordinal).padStart(2, "0")} · ${section.name}`,
        diff: [[FIELD_LABELS.status, section.status, data.status]],
      });
      revalidatePath("/charter", "layout");
      return null;
    });
  });
}

// ── Publicar versão (FR-2.3, FR-2.4, FR-2.5) ──────────────────────────────────

const PublishSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1, "Resumo de mudanças é obrigatório")
    .max(4000),
});

/** Incrementa o minor: v3.2 → v3.3. Major é decisão editorial, não automática. */
const VERSION_PATTERN = /^v?(\d+)\.(\d+)$/;

function bumpVersion(current: string | null): string {
  if (!current) {
    return "v1.0";
  }
  const m = current.match(VERSION_PATTERN);
  if (!m) {
    return "v1.0";
  }
  return `v${m[1]}.${Number(m[2]) + 1}`;
}

export async function publishPolicyVersion(
  input: z.infer<typeof PublishSchema>
): Promise<Result<{ version: string; reassignedTracks: number }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("policy.publish");
    const data = PublishSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const policy = await db.charterPolicy.findFirst({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: "asc" },
        include: { sections: { orderBy: { ordinal: "asc" } } },
      });
      if (!policy) {
        throw new GovernanceError("policy.missing", "Nenhuma política criada.");
      }

      const blockers = policyPublishBlockers(
        policy.sections.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
        }))
      );
      if (blockers.length > 0) {
        // 409, não 422: é conflito de estado. O modal lista cada bloqueador
        // por nome — só desabilitar o botão não diz o que fazer.
        throw new StateConflictError(
          "policy.publishBlocked",
          `Existem ${blockers.length} seções fora de publicação.`,
          blockers.map((b) => `${b.name} (${b.status})`)
        );
      }

      const version = bumpVersion(policy.version);
      const nextReview = new Date();
      nextReview.setMonth(nextReview.getMonth() + 6);

      const created = await db.charterPolicyVersion.create({
        data: {
          tenantId: ctx.tenantId,
          policyId: policy.id,
          version,
          status: "PUBLISHED",
          summary: data.summary,
          publishedById: ctx.userId,
          changeCount: policy.sections.length,
          // Snapshot: o diff da auditoria não pode depender do estado atual das
          // seções, que continua mudando depois da publicação.
          snapshot: policy.sections.map((s) => ({
            ordinal: s.ordinal,
            name: s.name,
            body: s.body,
            status: s.status,
          })),
        },
      });

      await db.charterPolicyVersion.updateMany({
        where: {
          policyId: policy.id,
          id: { not: created.id },
          status: "PUBLISHED",
        },
        data: { status: "SUPERSEDED" },
      });

      await db.charterPolicy.update({
        where: { id: policy.id },
        data: {
          version,
          publishedAt: new Date(),
          approverId: ctx.userId,
          nextReview,
        },
      });

      // Efeito colateral obrigatório (DATA-MODEL §6): publicar invalida os
      // aceites das trilhas vinculadas. Aceite é sempre de uma versão concreta —
      // quem aceitou a v3.2 não aceitou a v3.3.
      const tracks = await db.charterTrack.findMany({
        where: { tenantId: ctx.tenantId, policyId: policy.id },
        select: { id: true },
      });
      const trackIds = tracks.map((t) => t.id);

      if (trackIds.length > 0) {
        await db.charterTrack.updateMany({
          where: { id: { in: trackIds } },
          data: { needsReassignment: true, policyVersionId: created.id },
        });
        await db.charterAcknowledgment.updateMany({
          where: { tenantId: ctx.tenantId, trackId: { in: trackIds } },
          data: { status: "PENDING", acknowledgedAt: null },
        });
      }

      await logCharterAudit(db, ctx, {
        action: "Publicou versão",
        entityType: "charter.policy",
        entityId: policy.id,
        target: `${policy.name} · ${version}`,
        note: data.summary,
        diff: [
          [FIELD_LABELS.version, policy.version ?? "—", version],
          ["Seções alteradas", "—", String(policy.sections.length)],
          ["Trilhas para reatribuir", "—", String(trackIds.length)],
        ],
      });

      revalidatePath("/charter", "layout");
      return { version, reassignedTracks: trackIds.length };
    });
  });
}

// ── Diff entre versões (FR-2.6) ───────────────────────────────────────────────

type SnapshotSection = {
  ordinal: number;
  name: string;
  body: string;
  status: string;
};

export type VersionDiff = {
  version: string;
  previous: string | null;
  rows: { field: string; before: string; after: string }[];
};

export async function getVersionDiff(
  versionId: string
): Promise<Result<VersionDiff | null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const version = await db.charterPolicyVersion.findFirst({
        where: { id: versionId, tenantId: ctx.tenantId },
      });
      if (!version) {
        return null;
      }
      const previous = await db.charterPolicyVersion.findFirst({
        where: {
          policyId: version.policyId,
          publishedAt: { lt: version.publishedAt },
        },
        orderBy: { publishedAt: "desc" },
      });

      const currentSections =
        (version.snapshot as unknown as SnapshotSection[]) ?? [];
      // Nome deliberado: uma variável chamada `before` faz o linter ler
      // `before.map(...)` como hook de teste com callback.
      const previousSections =
        (previous?.snapshot as unknown as SnapshotSection[] | undefined) ?? [];
      const previousByOrdinal = new Map(
        previousSections.map((s) => [s.ordinal, s])
      );

      const rows: VersionDiff["rows"] = [];
      for (const s of currentSections) {
        const b = previousByOrdinal.get(s.ordinal);
        if (!b) {
          rows.push({
            field: `S${String(s.ordinal).padStart(2, "0")} · ${s.name}`,
            before: "— (seção nova)",
            after: `${s.body.slice(0, 180)}…`,
          });
          continue;
        }
        if (b.body !== s.body) {
          rows.push({
            field: `S${String(s.ordinal).padStart(2, "0")} · ${s.name}`,
            before: `${b.body.slice(0, 180)}…`,
            after: `${s.body.slice(0, 180)}…`,
          });
        }
        if (b.name !== s.name) {
          rows.push({
            field: `Nome de S${String(s.ordinal).padStart(2, "0")}`,
            before: b.name,
            after: s.name,
          });
        }
      }

      return {
        version: version.version,
        previous: previous?.version ?? null,
        rows,
      };
    });
  });
}
