import { generateObject } from "ai";
import { z } from "zod";
import { getActiveProvider, getAIModel } from "../router";

const RewriteSchema = z.object({
  queries: z.array(z.string()).min(1).max(5),
});

/**
 * Rewrite a user query into multiple semantic variants to improve retrieval recall.
 * Uses the active LLM (Haiku / Flash / gpt-4o-mini).
 * Falls back to [original] on error — never throws.
 */
export async function rewriteQuery(original: string): Promise<string[]> {
  try {
    const safeQuery = original.slice(0, 500).replace(/[<>]/g, "");
    const { object } = await generateObject({
      model: getAIModel(getActiveProvider()),
      schema: RewriteSchema,
      prompt: `Você é especialista em recuperação de informações SAFe 6.0.
Reescreva a pergunta abaixo em até 3 variantes que maximizem a cobertura semântica na busca vetorial.
Varie: terminologia (PT/EN), nível de abstração, perspectiva (RTE, LPM, equipe ágil).
Inclua sempre a pergunta original como primeira variante.
Retorne APENAS o JSON, sem explicações.

Pergunta: "${safeQuery}"`,
    });
    return object.queries;
  } catch {
    return [original];
  }
}
