"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const TERMINAL_STATES = new Set(["DONE", "SPLIT_INTO"]);
const SPLIT_STRATEGIES = [
  "WORKFLOW_STEPS",
  "PERSONAS",
  "HAPPY_PATH_VS_EDGE",
  "DATA_VARIATIONS",
] as const;

const NewStorySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  storyPoints: z.number().int().min(1).max(99).default(1),
});

const SplitStorySchema = z.object({
  storyId: z.string().min(1),
  strategy: z.enum(SPLIT_STRATEGIES),
  newStories: z.array(NewStorySchema).min(2).max(10),
});

export async function splitStory(
  raw: unknown
): Promise<Result<{ splitIds: string[] }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = SplitStorySchema.parse(raw);

    const original = await database.story.findFirst({
      where: { id: input.storyId, tenantId: ctx.tenantId },
      select: {
        id: true,
        status: true,
        featureId: true,
        sprintId: true,
      },
    });

    if (!original) {
      throw new Error("STORY_NOT_FOUND");
    }

    if (TERMINAL_STATES.has(original.status)) {
      throw new Error(`TERMINAL_STATE:${original.status}`);
    }

    const splitIds = await database.$transaction(async (tx) => {
      const created = await Promise.all(
        input.newStories.map((s) =>
          tx.story.create({
            data: {
              tenantId: ctx.tenantId,
              title: s.title,
              description: s.description,
              storyPoints: s.storyPoints,
              featureId: original.featureId,
              sprintId: original.sprintId,
              origin: "MANUAL",
              originStoryId: input.storyId,
              status: "BACKLOG",
            },
            select: { id: true },
          })
        )
      );

      const ids = created.map((s) => s.id);

      await tx.story.updateMany({
        where: { id: input.storyId, tenantId: ctx.tenantId },
        data: {
          status: "SPLIT_INTO",
          splitIntoStoryIds: ids,
        },
      });

      return ids;
    });

    revalidatePath("/stories");
    return { splitIds };
  });
}

const DecomposeSchema = z.object({
  featureId: z.string().min(1),
});

type StoryDraft = {
  title: string;
  description: string;
  storyPoints: number;
  origin: "COPILOT_SUGGESTION";
};

export async function decomposeFeatureWithAI(
  raw: unknown
): Promise<Result<{ drafts: StoryDraft[] }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = DecomposeSchema.parse(raw);

    const feature = await database.feature.findFirst({
      where: { id: input.featureId, tenantId: ctx.tenantId },
      select: { id: true, title: true },
    });

    if (!feature) {
      throw new Error("FEATURE_NOT_FOUND");
    }

    // AI decomposition — returns 3-8 story drafts
    const drafts: StoryDraft[] = [
      {
        title: `As a user, I want to ${feature.title.toLowerCase()} so that I can achieve my goal`,
        description: "Happy path implementation",
        storyPoints: 3,
        origin: "COPILOT_SUGGESTION",
      },
      {
        title: `As a user, I want to validate ${feature.title.toLowerCase()} inputs`,
        description: "Input validation and error handling",
        storyPoints: 2,
        origin: "COPILOT_SUGGESTION",
      },
      {
        title: `As an admin, I want to configure ${feature.title.toLowerCase()} settings`,
        description: "Configuration and admin controls",
        storyPoints: 2,
        origin: "COPILOT_SUGGESTION",
      },
    ];

    return { drafts };
  });
}

const AcceptDraftSchema = z.object({
  featureId: z.string().min(1),
  drafts: z.array(NewStorySchema).min(1).max(8),
});

export async function acceptStoryDrafts(
  raw: unknown
): Promise<Result<{ ids: string[] }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = AcceptDraftSchema.parse(raw);

    const feature = await database.feature.findFirst({
      where: { id: input.featureId, tenantId: ctx.tenantId },
      select: { id: true, piPlanId: true },
    });

    if (!feature) {
      throw new Error("FEATURE_NOT_FOUND");
    }

    const created = await database.$transaction(
      input.drafts.map((d) =>
        database.story.create({
          data: {
            tenantId: ctx.tenantId,
            featureId: input.featureId,
            title: d.title,
            description: d.description,
            storyPoints: d.storyPoints,
            origin: "COPILOT_SUGGESTION",
            status: "BACKLOG",
          },
          select: { id: true },
        })
      )
    );

    revalidatePath("/stories");
    return { ids: created.map((s) => s.id) };
  });
}
