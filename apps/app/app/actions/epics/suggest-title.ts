"use server";

import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { generateText } from "ai";
import { headers } from "next/headers";
import { fenceUntrusted } from "@/lib/prompt-fence";
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
      prompt: `Você é um especialista SAFe. Sugira um título curto e claro para um épico com base no início fornecido. Retorne apenas o título, sem explicações, máximo 80 caracteres.\n\n${fenceUntrusted("início do título", input.partial)}`,
      maxOutputTokens: 60,
    });

    return text.trim();
  });
}
