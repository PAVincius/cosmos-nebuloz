"use server";

import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { streamText } from "ai";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

const DraftHypothesisSchema = z.object({
  epicId: z.string().min(1),
});

export async function draftHypothesisAction(
  raw: unknown
): Promise<Result<{ text: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { epicId } = DraftHypothesisSchema.parse(raw);

    const epic = await database.epic.findFirstOrThrow({
      where: { id: epicId, tenantId: ctx.tenantId },
      select: {
        title: true,
        descriptionMd: true,
        lifecycleStatus: true,
        hypothesis: true,
      },
    });

    const TERMINAL = new Set(["DONE", "REJECTED"]);
    if (TERMINAL.has(epic.lifecycleStatus)) {
      throw new Error("TERMINAL_STATE");
    }

    if (!epic.descriptionMd || epic.descriptionMd.trim().length < 100) {
      throw new Error("DESCRIPTION_TOO_SHORT");
    }

    const provider = getActiveProvider();
    if (provider === "none") {
      throw new Error("AI_NOT_CONFIGURED");
    }
    const model = getAIModel(provider);

    const systemPrompt = `You are a SAFe 6.0 expert helping Product Managers write Lean Business Case hypotheses.
A strong hypothesis follows this structure: "We believe [capability/feature] will [achieve outcome] for [customer segment], measured by [leading indicator]."
Respond in the same language as the epic description (Portuguese BR or Spanish).
Return ONLY the hypothesis text — no explanation, no prefix.`;

    const userPrompt = `Epic title: "${epic.title}"

Description:
${epic.descriptionMd}

${epic.hypothesis ? `Current hypothesis (improve on this): ${epic.hypothesis}` : "Write a new hypothesis for this epic."}

Write a concise, testable hypothesis (50–250 characters).`;

    const result = await streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 300,
    });

    let text = "";
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    return { text: text.trim() };
  });
}
