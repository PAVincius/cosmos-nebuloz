"use server";

import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { generateText } from "ai";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import { ragSearch } from "./rag-search";

export type PromptTarget =
  | "cursor"
  | "windsurf"
  | "vscode"
  | "claude-code"
  | "claude-ai"
  | "chatgpt"
  | "groq"
  | "gemini"
  | "perplexity";

function buildDeepLink(target: PromptTarget, prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  const b64 = Buffer.from(prompt).toString("base64");
  switch (target) {
    case "cursor":
      return `cursor://chat?prompt=${b64}`;
    case "windsurf":
      return `windsurf://chat?prompt=${b64}`;
    case "vscode":
      return `vscode://Cline/newTask?prompt=${b64}`;
    case "claude-code":
      return `claude-code://new?prompt=${b64}`;
    case "claude-ai":
      return `https://claude.ai/new?q=${encoded}`;
    case "chatgpt":
      return `https://chatgpt.com/?prompt=${encoded}`;
    case "groq":
      return "https://groq.com/";
    case "gemini":
      return "https://gemini.google.com/";
    case "perplexity":
      return `https://perplexity.ai/search?q=${encoded}`;
  }
}

function systemPromptForTarget(target: PromptTarget): string {
  const base = `Você é um especialista em desenvolvimento de software e SAFe.
Gere um prompt de implementação detalhado para o seguinte épico.
O prompt deve incluir: contexto do problema, requisitos funcionais, critérios de aceite, sugestões de arquitetura.`;
  if (target === "claude-code" || target === "claude-ai") {
    return `${base}\nUse System Prompt structure com contexto claro.`;
  }
  if (target === "cursor" || target === "windsurf") {
    return `${base}\nFoco em instruções de código direto, one-shot implementation.`;
  }
  return base;
}

export async function generateAndDeliverPrompt(input: {
  epicId: string;
  target: PromptTarget;
  ragDocIds: string[];
}): Promise<Result<{ prompt: string; deepLink: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.epic.findFirst({
      where: { id: input.epicId, tenantId: ctx.tenantId },
      select: { id: true, title: true, descriptionMd: true },
    });
    if (!epic) {
      throw new Error("Épico não encontrado");
    }

    const ragDocs = await ragSearch(ctx.tenantId, epic.title);
    const ragContext =
      ragDocs.length > 0
        ? `\n\nDOCUMENTOS RELEVANTES:\n${ragDocs.map((d) => `## ${d.title}\n${d.content}`).join("\n\n")}`
        : "";

    const provider = getActiveProvider();
    if (provider === "none") {
      throw new Error("Nenhuma chave de IA configurada.");
    }
    const model = getAIModel(provider);

    const { text } = await generateText({
      model,
      system: systemPromptForTarget(input.target),
      prompt: `Épico: "${epic.title}"
Descrição: ${epic.descriptionMd ?? "(sem descrição)"}${ragContext}

Gere o prompt de implementação para ${input.target}.`,
    });

    const deepLink = buildDeepLink(input.target, text);

    return { prompt: text, deepLink };
  });
}
