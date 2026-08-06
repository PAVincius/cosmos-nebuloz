"use server";

import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { generateText } from "ai";
import { headers } from "next/headers";
import { fenceUntrusted } from "@/lib/prompt-fence";
import { type Result, safeAction } from "../_base";

export async function extractTranscription(input: {
  transcription: string;
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
        "Você é especialista SAFe. A partir de notas de reunião, extraia a estrutura de um épico em markdown com seções: ## Hipótese de Negócio, ## Resultados Esperados, ## MVPs, ## Métricas de Sucesso, ## Riscos. Responda em português.",
      prompt: fenceUntrusted("transcrição de reunião", input.transcription),
      maxOutputTokens: 1000,
    });

    return text.trim();
  });
}
