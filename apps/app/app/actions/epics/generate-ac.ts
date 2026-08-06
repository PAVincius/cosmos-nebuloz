"use server";

import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { generateText } from "ai";
import { headers } from "next/headers";
import { fenceUntrusted } from "@/lib/prompt-fence";
import { type Result, safeAction } from "../_base";

export async function generateAC(input: {
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
        "Você é especialista SAFe. Gere critérios de aceite em formato markdown (lista de checkboxes) para o épico fornecido. Responda em português. Retorne apenas os critérios, sem explicação.",
      prompt: `${fenceUntrusted("título do épico", input.title)}\n\n${fenceUntrusted("descrição do épico", input.descriptionMd)}`,
      maxOutputTokens: 600,
    });

    return text.trim();
  });
}
