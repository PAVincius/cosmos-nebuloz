"use server";

import { database } from "@repo/database";
import { generateObject } from "ai";
import { getAIModel, getActiveProvider } from "@repo/ai/lib/models";
import { z } from "zod";
import { TASK_TYPES } from "./capability-schema";

const DemandSchema = z.object({
  demand: z.record(z.enum(TASK_TYPES), z.number().min(0).max(1)),
});

export async function estimateInitiativeDemand(args: {
  tenantId: string;
  initiativeId: string;
  initiativeType: "epic" | "feature";
}) {
  const item =
    args.initiativeType === "epic"
      ? await database.epic.findFirst({
          where: { id: args.initiativeId, tenantId: args.tenantId },
          select: { title: true, descriptionMd: true },
        })
      : await database.feature.findFirst({
          where: { id: args.initiativeId, tenantId: args.tenantId },
          select: { title: true },
        });

  if (!item) throw new Error("Initiative not found");

  const content = [
    "title" in item ? item.title : "",
    "descriptionMd" in item ? (item.descriptionMd ?? "") : "",
  ]
    .filter(Boolean)
    .join("\n");

  const provider = getActiveProvider();
  if (provider === "none") throw new Error("No AI provider configured");

  const model = getAIModel(provider);
  const { object } = await generateObject({
    model,
    schema: DemandSchema,
    system: `Classify technical demand of a SAFe initiative across: ${TASK_TYPES.join(", ")}.
Return weights 0-1 per relevant category. Sum should be approximately 1.0. Omit irrelevant categories.`,
    prompt: content,
  });

  return {
    initiativeId: args.initiativeId,
    initiativeType: args.initiativeType,
    demand: object.demand,
  };
}
