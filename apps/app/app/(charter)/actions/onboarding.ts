"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  GovernanceError,
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
import { type Result, safeAction } from "../../actions/_base";
import { logCharterAudit, nextCode } from "./_shared";

// Onboarding — FR-10. Traduz política em comportamento e prova que a
// comunicação aconteceu.

export type TrackRow = {
  id: string;
  code: string;
  name: string;
  audience: string;
  modules: number;
  minutes: number;
  recert: string;
  policyVersion: string | null;
  needsReassignment: boolean;
  assigned: number;
  done: number;
  overdue: number;
  coverage: number;
};

export type AckPendingRow = {
  id: string;
  personName: string;
  department: string | null;
  trackCode: string;
  trackName: string;
  assignedAt: string;
  daysLate: number;
};

export type OnboardingBoard = {
  tracks: TrackRow[];
  pending: AckPendingRow[];
  coverage: { assigned: number; done: number; pct: number };
};

export async function getOnboarding(): Promise<Result<OnboardingBoard>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const tracks = await db.charterTrack.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          policyVersion: { select: { version: true } },
          acknowledgments: {
            select: { status: true, dueAt: true },
          },
        },
        orderBy: { code: "asc" },
      });

      const now = Date.now();
      // done/overdue são agregados dos aceites, não colunas — persistir exigiria
      // recontar a cada aceite e abriria espaço para drift.
      const rows: TrackRow[] = tracks.map((t) => {
        const assigned = t.acknowledgments.length;
        const done = t.acknowledgments.filter(
          (a) => a.status === "ACKNOWLEDGED"
        ).length;
        const overdue = t.acknowledgments.filter(
          (a) =>
            a.status === "PENDING" &&
            a.dueAt !== null &&
            a.dueAt.getTime() < now
        ).length;
        return {
          id: t.id,
          code: t.code,
          name: t.name,
          audience: t.audience,
          modules: t.modules,
          minutes: t.minutes,
          recert: t.recert,
          policyVersion: t.policyVersion?.version ?? null,
          needsReassignment: t.needsReassignment,
          assigned,
          done,
          overdue,
          coverage: assigned === 0 ? 0 : Math.round((done / assigned) * 100),
        };
      });

      const pendingRows = await db.charterAcknowledgment.findMany({
        where: { tenantId: ctx.tenantId, status: "PENDING" },
        include: { track: { select: { code: true, name: true } } },
      });

      const pending: AckPendingRow[] = pendingRows
        .map((a) => ({
          id: a.id,
          personName: a.personName,
          department: a.department,
          trackCode: a.track.code,
          trackName: a.track.name,
          assignedAt: a.assignedAt.toISOString(),
          daysLate: Math.max(
            0,
            Math.floor((now - a.assignedAt.getTime()) / 86_400_000)
          ),
        }))
        // Ordenado por atraso: a lista existe para cobrar quem está mais atrasado.
        .sort((a, b) => b.daysLate - a.daysLate);

      const assigned = rows.reduce((s, t) => s + t.assigned, 0);
      const done = rows.reduce((s, t) => s + t.done, 0);

      return {
        tracks: rows,
        pending,
        coverage: {
          assigned,
          done,
          pct: assigned === 0 ? 0 : Math.round((done / assigned) * 100),
        },
      };
    });
  });
}

// ── Publicar trilha (FR-10.4) ─────────────────────────────────────────────────

const PublishTrackSchema = z.object({
  name: z.string().trim().min(1, "Nome da trilha é obrigatório").max(120),
  audience: z.string().trim().min(1, "Defina o público").max(120),
  modules: z.number().int().min(1).max(30).default(3),
  minutes: z.number().int().min(1).max(600).default(20),
  recert: z.enum(["ANNUAL", "SEMIANNUAL"]).default("ANNUAL"),
  /** Pessoas atribuídas. Sem público a trilha não prova nada. */
  people: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        department: z.string().trim().max(80).optional(),
      })
    )
    .default([]),
  dueInDays: z.number().int().min(1).max(365).default(30),
});

export async function publishTrack(
  input: z.input<typeof PublishTrackSchema>
): Promise<Result<{ code: string; assigned: number }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("onboarding.publish");
    const data = PublishTrackSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const policy = await db.charterPolicy.findFirst({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: "asc" },
        select: { id: true, version: true },
      });
      if (!policy) {
        throw new GovernanceError(
          "policy.missing",
          "Publique uma política antes de criar trilhas — a trilha é sempre vinculada a uma versão."
        );
      }

      const version = await db.charterPolicyVersion.findFirst({
        where: { policyId: policy.id, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: { id: true, version: true },
      });
      if (!version) {
        throw new GovernanceError(
          "policy.notPublished",
          "Não há versão de política publicada para vincular à trilha."
        );
      }

      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "track",
        prefix: "TR",
        pad: 2,
      });
      const dueAt = new Date(Date.now() + data.dueInDays * 86_400_000);

      const track = await db.charterTrack.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          name: data.name,
          audience: data.audience,
          modules: data.modules,
          minutes: data.minutes,
          recert: data.recert,
          policyId: policy.id,
          policyVersionId: version.id,
          publishedAt: new Date(),
          needsReassignment: false,
        },
      });

      if (data.people.length > 0) {
        await db.charterAcknowledgment.createMany({
          data: data.people.map((p) => ({
            tenantId: ctx.tenantId,
            trackId: track.id,
            personName: p.name,
            department: p.department ?? null,
            dueAt,
            policyVersionId: version.id,
          })),
        });
      }

      await logCharterAudit(db, ctx, {
        action: "Publicou trilha",
        entityType: "charter.track",
        entityId: track.id,
        target: `${code} · ${data.name}`,
        note: `Vinculada à política ${version.version}; ${data.people.length} pessoas atribuídas.`,
        diff: [
          ["Versão", "—", version.version],
          ["Atribuídos", "0", String(data.people.length)],
        ],
      });

      revalidatePath("/charter", "layout");
      return { code, assigned: data.people.length };
    });
  });
}

const AckSchema = z.object({ id: z.string().cuid() });

/** Registra o aceite. Guarda a versão aceita — quem aceitou a v3.2 não aceitou
 *  a v3.3, e é isso que a auditoria precisa saber. */
export async function acknowledge(
  input: z.infer<typeof AckSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    const data = AckSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const ack = await db.charterAcknowledgment.findFirst({
        where: { id: data.id, tenantId: ctx.tenantId },
        include: { track: { select: { code: true, name: true } } },
      });
      if (!ack) {
        throw new GovernanceError("ack.unknown", "Atribuição não encontrada.");
      }

      await db.charterAcknowledgment.update({
        where: { id: ack.id },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date(),
          userId: ctx.userId,
        },
      });

      await logCharterAudit(db, ctx, {
        action: "Registrou aceite",
        entityType: "charter.track",
        entityId: ack.trackId,
        target: `${ack.track.code} · ${ack.personName}`,
        diff: [["Status", "PENDING", "ACKNOWLEDGED"]],
      });

      revalidatePath("/charter", "layout");
      return null;
    });
  });
}
