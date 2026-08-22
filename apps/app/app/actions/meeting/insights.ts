"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { err, ok, type Result } from "../_base";
import { logDecision } from "../governance/decision-log";
import { indexEntity } from "../safe-copilot/index-entity";

const SearchMeetingsSchema = z.object({
  query: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  insightType: z.enum(["ACTION", "RISK", "DECISION"]).optional(),
});

type MeetingSearchFilters = z.infer<typeof SearchMeetingsSchema>;

const ApplyInsightSchema = z.object({
  insightId: z.string().min(1),
  text: z.string().min(1).max(1000).optional(),
});

const DismissInsightSchema = z.object({
  insightId: z.string().min(1),
});

export type InsightRow = {
  id: string;
  type: string;
  text: string;
  proposedTarget: string | null;
  status: string;
  appliedEntityId: string | null;
  createdAt: Date;
};

type TranscriptSummary = {
  id: string;
  meetingId: string;
  title: string | null;
  piPlanId: string | null;
  status: string;
  createdAt: Date;
  counts: { pending: number; applied: number; dismissed: number };
};

export async function listMeetingInsights(
  transcriptId: string
): Promise<Result<InsightRow[]>> {
  try {
    const ctx = await requireTenantSession(await headers());
    const transcript = await database.meetingTranscript.findFirst({
      where: { id: transcriptId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!transcript) {
      return err("Transcrição não encontrada");
    }

    const rows = await database.meetingInsight.findMany({
      where: { transcriptId, tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        text: true,
        proposedTarget: true,
        status: true,
        appliedEntityId: true,
        createdAt: true,
      },
    });
    return ok(rows);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao listar insights");
  }
}

export async function applyInsight(
  raw: unknown
): Promise<Result<{ entityId: string; entityType: string }>> {
  try {
    const ctx = await requireTenantSession(await headers());
    const { insightId, text: editedText } = ApplyInsightSchema.parse(raw);

    const insight = await database.meetingInsight.findFirst({
      where: { id: insightId, tenantId: ctx.tenantId },
      include: { transcript: { select: { id: true, piPlanId: true } } },
    });
    if (!insight) {
      return err("Insight não encontrado");
    }
    if (insight.status === "APPLIED") {
      return err("Insight já aplicado");
    }

    const text = editedText ?? insight.text;
    let entityId: string;
    let entityType: string;

    if (insight.type === "DECISION") {
      const entry = await logDecision(ctx, {
        tipo: "meeting-insight",
        targetType: insight.transcript.piPlanId ? "PI" : "MEETING",
        targetId: insight.transcript.piPlanId ?? insight.transcript.id,
        decisao: text,
        justificativa: "Extraído de transcrição de meeting via IA",
      });
      entityId = entry.id;
      entityType = "DecisionLog";
    } else if (insight.type === "ACTION") {
      // ACTION → Impediment (not Risk): action items need ownership, not risk tracking
      let artId: string | undefined;
      if (insight.transcript.piPlanId) {
        const pi = await database.pIPlan.findFirst({
          where: { id: insight.transcript.piPlanId, tenantId: ctx.tenantId },
          select: { artId: true },
        });
        artId = pi?.artId ?? undefined;
      }
      let teamId: string | undefined;
      if (artId) {
        const activeSprint = await database.sprint.findFirst({
          where: {
            tenantId: ctx.tenantId,
            status: "ACTIVE",
            team: { artId },
          },
          select: { teamId: true },
        });
        teamId = activeSprint?.teamId ?? undefined;
      }
      const impediment = await database.impediment.create({
        data: {
          tenantId: ctx.tenantId,
          title: text,
          status: "OPEN",
          artId,
          teamId,
        },
        select: { id: true },
      });
      entityId = impediment.id;
      entityType = "Impediment";
    } else {
      // RISK → Risk with technical category
      const risk = await database.risk.create({
        data: {
          tenantId: ctx.tenantId,
          title: text,
          status: "IDENTIFIED",
          impact: "medium",
          probability: "medium",
          category: "technical",
          piPlanId: insight.transcript.piPlanId ?? undefined,
        },
        select: { id: true },
      });
      entityId = risk.id;
      entityType = "Risk";
    }

    await database.meetingInsight.update({
      where: { id: insightId },
      data: { status: "APPLIED", appliedEntityId: entityId },
    });

    queueMicrotask(() =>
      indexEntity("meeting_insight", insightId, ctx.tenantId)
    );

    return ok({ entityId, entityType });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao aplicar insight");
  }
}

export async function dismissInsight(
  raw: unknown
): Promise<Result<{ id: string }>> {
  try {
    const ctx = await requireTenantSession(await headers());
    const { insightId } = DismissInsightSchema.parse(raw);

    const insight = await database.meetingInsight.findFirst({
      where: { id: insightId, tenantId: ctx.tenantId },
      select: { id: true, status: true },
    });
    if (!insight) {
      return err("Insight não encontrado");
    }
    if (insight.status !== "PENDING") {
      return err("Insight não está pendente");
    }

    await database.meetingInsight.update({
      where: { id: insightId },
      data: { status: "DISMISSED" },
    });

    return ok({ id: insightId });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao descartar insight");
  }
}

async function listMeetingTimeline(): Promise<Result<TranscriptSummary[]>> {
  try {
    const ctx = await requireTenantSession(await headers());
    const transcripts = await database.meetingTranscript.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        meetingId: true,
        title: true,
        piPlanId: true,
        status: true,
        createdAt: true,
        insights: { select: { status: true } },
      },
    });

    return ok(
      transcripts.map((t) => ({
        id: t.id,
        meetingId: t.meetingId,
        title: t.title,
        piPlanId: t.piPlanId,
        status: t.status,
        createdAt: t.createdAt,
        counts: {
          pending: t.insights.filter((i) => i.status === "PENDING").length,
          applied: t.insights.filter((i) => i.status === "APPLIED").length,
          dismissed: t.insights.filter((i) => i.status === "DISMISSED").length,
        },
      }))
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao listar timeline");
  }
}

async function searchMeetings(
  raw: unknown
): Promise<Result<TranscriptSummary[]>> {
  try {
    const ctx = await requireTenantSession(await headers());
    const filters = SearchMeetingsSchema.parse(raw);

    const transcripts = await database.meetingTranscript.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(filters.query
          ? { title: { contains: filters.query, mode: "insensitive" } }
          : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
        ...(filters.insightType
          ? { insights: { some: { type: filters.insightType } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        meetingId: true,
        title: true,
        piPlanId: true,
        status: true,
        createdAt: true,
        insights: { select: { status: true } },
      },
    });

    return ok(
      transcripts.map((t) => ({
        id: t.id,
        meetingId: t.meetingId,
        title: t.title,
        piPlanId: t.piPlanId,
        status: t.status,
        createdAt: t.createdAt,
        counts: {
          pending: t.insights.filter((i) => i.status === "PENDING").length,
          applied: t.insights.filter((i) => i.status === "APPLIED").length,
          dismissed: t.insights.filter((i) => i.status === "DISMISSED").length,
        },
      }))
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao buscar meetings");
  }
}
