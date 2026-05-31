"use server";

import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { generateText } from "ai";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";

export async function improveDescription(input: {
  title: string;
  descriptionMd: string;
}): Promise<Result<string>> {
  return safeAction(async () => {
    await requireTenantSession(await headers());
    const provider = getActiveProvider();
    if (provider === "none") {
      throw new Error("Nenhuma chave de IA configurada.");
    }
    const model = getAIModel(provider);

    const { text } = await generateText({
      model,
      system:
        "Você é especialista SAFe. Melhore a descrição de um épico mantendo estrutura markdown. Responda em português. Retorne apenas o markdown melhorado.",
      prompt: `Épico: "${input.title}"\n\nDescrição atual:\n${input.descriptionMd}`,
      maxOutputTokens: 800,
    });

    return text.trim();
  });
}
