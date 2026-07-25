"use server";

import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { generateText } from "ai";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";

export async function suggestTitle(input: {
  partial: string;
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
      prompt: `Você é um especialista SAFe. Sugira um título curto e claro para um épico com base neste início: "${input.partial}". Retorne apenas o título, sem explicações, máximo 80 caracteres.`,
      maxOutputTokens: 60,
    });

    return text.trim();
  });
}
