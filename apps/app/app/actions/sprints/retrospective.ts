"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const MIN_RETROS_FOR_ANALYSIS = 3;

// ─── createRetro ─────────────────────────────────────────────────────────────

const createRetroSchema = z.object({
  sprintId: z.string().min(1),
  teamId: z.string().min(1),
  anonymousInput: z.boolean().optional(),
  votesPerMember: z.number().int().min(1).max(10).optional(),
});

export async function createRetro(
  raw: unknown
): Promise<Result<{ id: string; carriedForwardCount: number }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = createRetroSchema.parse(raw);

    // Cross-tenant IDOR guard — sprint and team come from the client.
    const [sprint, team] = await Promise.all([
      database.sprint.findFirst({
        where: { id: input.sprintId, tenantId },
        select: { id: true },
      }),
      database.team.findFirst({
        where: { id: input.teamId, tenantId },
        select: { id: true },
      }),
    ]);
    if (!sprint) {
      throw new Error("SPRINT_NOT_FOUND");
    }
    if (!team) {
      throw new Error("TEAM_NOT_FOUND");
    }

    return database.$transaction(async (tx) => {
      const retro = await tx.retrospective.create({
        data: {
          tenantId,
          sprintId: input.sprintId,
          teamId: input.teamId,
          anonymousInput: input.anonymousInput ?? true,
          votesPerMember: input.votesPerMember ?? 3,
          phase: "INPUT",
          status: "ACTIVE",
        },
        select: { id: true },
      });

      // AC-006: Carry forward incomplete actions from prior closed retro
      const priorRetro = await tx.retrospective.findFirst({
        where: { teamId: input.teamId, tenantId, status: "CLOSED" },
        orderBy: { closedAt: "desc" },
        select: { id: true },
      });

      let carriedForwardCount = 0;
      if (priorRetro) {
        const openActions = await tx.retroActionItem.findMany({
          where: {
            retroId: priorRetro.id,
            tenantId,
            status: "OPEN",
          },
          select: {
            title: true,
            ownerId: true,
            dueDate: true,
            carriedFromRetroId: true,
          },
        });

        for (const action of openActions) {
          await tx.retroActionItem.create({
            data: {
              tenantId,
              retroId: retro.id,
              title: action.title,
              ownerId: action.ownerId,
              dueDate: action.dueDate,
              carriedFromRetroId: action.carriedFromRetroId ?? priorRetro.id,
            },
          });
          carriedForwardCount += 1;
        }
      }

      revalidatePath("/");
      return { id: retro.id, carriedForwardCount };
    });
  });
}

// ─── addRetroItem ─────────────────────────────────────────────────────────────

const addRetroItemSchema = z.object({
  retroId: z.string().min(1),
  category: z.enum(["WENT_WELL", "TO_IMPROVE"]),
  text: z.string().min(1).max(1000),
});

export async function addRetroItem(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = addRetroItemSchema.parse(raw);

    const retro = await database.retrospective.findFirstOrThrow({
      where: { id: input.retroId, tenantId },
      select: { phase: true },
    });

    if (retro.phase !== "INPUT") {
      throw new Error(
        `WRONG_PHASE: items can only be added in INPUT phase, current=${retro.phase}`
      );
    }

    const item = await database.retroItem.create({
      data: {
        tenantId,
        retroId: input.retroId,
        category: input.category,
        text: input.text,
        authorId: userId,
      },
      select: { id: true },
    });

    revalidatePath("/");
    return { id: item.id };
  });
}

// ─── getRetroItems ────────────────────────────────────────────────────────────

const getRetroItemsSchema = z.object({
  retroId: z.string().min(1),
});

type RetroItemPublic = {
  id: string;
  category: string;
  text: string;
  authorId: string | null;
  voteCount: number;
};

export async function getRetroItems(
  raw: unknown
): Promise<Result<{ items: RetroItemPublic[] }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = getRetroItemsSchema.parse(raw);

    const retro = await database.retrospective.findFirstOrThrow({
      where: { id: input.retroId, tenantId },
      select: { phase: true, anonymousInput: true },
    });

    const items = await database.retroItem.findMany({
      where: { retroId: input.retroId, tenantId },
      select: {
        id: true,
        category: true,
        text: true,
        authorId: true,
        voteCount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // AC-003: Hide author during INPUT phase when anonymousInput=true
    const publicItems: RetroItemPublic[] = items.map((item) => ({
      ...item,
      authorId:
        retro.phase === "INPUT" && retro.anonymousInput ? null : item.authorId,
    }));

    return { items: publicItems };
  });
}

// ─── castRetroVote ────────────────────────────────────────────────────────────

const castRetroVoteSchema = z.object({
  retroId: z.string().min(1),
  itemId: z.string().min(1),
});

export async function castRetroVote(
  raw: unknown
): Promise<Result<{ votesRemaining: number }>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = castRetroVoteSchema.parse(raw);

    return database.$transaction(async (tx) => {
      const retro = await tx.retrospective.findFirstOrThrow({
        where: { id: input.retroId, tenantId },
        select: { phase: true, votesPerMember: true },
      });

      if (retro.phase !== "VOTING") {
        throw new Error(
          `WRONG_PHASE: voting only allowed in VOTING phase, current=${retro.phase}`
        );
      }

      // Count existing votes from this user in this retro
      const usedVotes = await tx.retroVote.count({
        where: {
          userId,
          item: { retroId: input.retroId },
        },
      });

      if (usedVotes >= retro.votesPerMember) {
        throw new Error(
          `VOTES_EXHAUSTED: You've used all your votes (${retro.votesPerMember})`
        );
      }

      // Cross-tenant IDOR guard — the retro is tenant-checked above but the
      // item is not, and the increment below writes the row by id alone.
      const item = await tx.retroItem.findFirst({
        where: { id: input.itemId, retroId: input.retroId, tenantId },
        select: { id: true },
      });
      if (!item) {
        throw new Error("RETRO_ITEM_NOT_FOUND");
      }

      await tx.retroVote.create({
        data: { itemId: input.itemId, userId },
      });

      await tx.retroItem.update({
        where: { id: input.itemId },
        data: { voteCount: { increment: 1 } },
      });

      const votesRemaining = retro.votesPerMember - usedVotes - 1;
      revalidatePath("/");
      return { votesRemaining };
    });
  });
}

// ─── addRetroActionItem ───────────────────────────────────────────────────────

const addRetroActionItemSchema = z.object({
  retroId: z.string().min(1),
  title: z.string().min(1).max(500),
  ownerId: z.string().min(1),
  dueDate: z.string().datetime(),
});

export async function addRetroActionItem(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = addRetroActionItemSchema.parse(raw);

    const due = new Date(input.dueDate);
    const now = new Date();
    // AC-005: dueDate must be in the future
    if (due <= now) {
      throw new Error(
        "DUE_DATE_MUST_BE_FUTURE: Due date must be in the future"
      );
    }

    await database.retrospective.findFirstOrThrow({
      where: { id: input.retroId, tenantId },
      select: { id: true },
    });

    const item = await database.retroActionItem.create({
      data: {
        tenantId,
        retroId: input.retroId,
        title: input.title,
        ownerId: input.ownerId,
        dueDate: due,
      },
      select: { id: true },
    });

    revalidatePath("/");
    return { id: item.id };
  });
}

// ─── analyzeRetroPatterns ─────────────────────────────────────────────────────

const analyzeRetroPatternsSchema = z.object({
  teamId: z.string().min(1),
});

type RetroTheme = {
  text: string;
  count: number;
  rootCause: string;
};

export async function analyzeRetroPatterns(
  raw: unknown
): Promise<Result<{ themes: RetroTheme[]; insufficientData: boolean }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = analyzeRetroPatternsSchema.parse(raw);

    const closedRetros = await database.retrospective.findMany({
      where: { teamId: input.teamId, tenantId, status: "CLOSED" },
      select: { id: true },
      orderBy: { closedAt: "desc" },
    });

    // AC-007: gate — need at least 3 completed retros
    if (closedRetros.length < MIN_RETROS_FOR_ANALYSIS) {
      return {
        themes: [],
        insufficientData: true,
      };
    }

    // Collect TO_IMPROVE items across closed retros
    const items = await database.retroItem.findMany({
      where: {
        retroId: { in: closedRetros.map((r) => r.id) },
        tenantId,
        category: "TO_IMPROVE",
      },
      select: { text: true, retroId: true },
    });

    // Simple frequency analysis: group by normalized text
    const freq = new Map<string, Set<string>>();
    for (const item of items) {
      const key = item.text.toLowerCase().trim();
      if (!freq.has(key)) {
        freq.set(key, new Set());
      }
      freq.get(key)?.add(item.retroId);
    }

    const themes: RetroTheme[] = [];
    for (const [text, retroIds] of freq) {
      if (retroIds.size >= 2) {
        themes.push({
          text,
          count: retroIds.size,
          rootCause: `Recurring theme across ${retroIds.size} retros — investigate process gap`,
        });
      }
    }

    themes.sort((a, b) => b.count - a.count);
    return { themes, insufficientData: false };
  });
}
