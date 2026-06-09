"use server";

import { createHash } from "node:crypto";
import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { generateObject } from "ai";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";

// ─── Schema ───────────────────────────────────────────────────────────────────

const InvestBreakdownSchema = z.object({
  breakdown: z.object({
    I: z.number().min(0).max(100),
    N: z.number().min(0).max(100),
    V: z.number().min(0).max(100),
    E: z.number().min(0).max(100),
    S: z.number().min(0).max(100),
    T: z.number().min(0).max(100),
  }),
  rationale: z.object({
    I: z.string(),
    N: z.string(),
    V: z.string(),
    E: z.string(),
    S: z.string(),
    T: z.string(),
  }),
  compositeScore: z.number().min(0).max(100),
  isSmall: z.boolean(),
});

export type InvestResult = z.infer<typeof InvestBreakdownSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHash(title: string, description: string | null): string {
  return createHash("sha256")
    .update(`${title}||${description ?? ""}`)
    .digest("hex");
}

// ─── Server Action ────────────────────────────────────────────────────────────

export async function analyzeInvest(input: {
  epicId: string;
}): Promise<Result<InvestResult>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.epic.findFirst({
      where: { id: input.epicId, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        descriptionMd: true,
        investScore: true,
        investHash: true,
        investBreakdown: true,
      },
    });
    if (!epic) {
      throw new Error("Épico não encontrado");
    }

    const currentHash = computeHash(epic.title, epic.descriptionMd);

    // Cache hit — return persisted score without calling AI
    if (
      epic.investHash === currentHash &&
      epic.investScore !== null &&
      epic.investBreakdown !== null
    ) {
      return epic.investBreakdown as InvestResult;
    }

    // Cache miss — call AI
    const provider = getActiveProvider();
    if (provider === "none") {
      throw new Error(
        "Nenhuma chave de IA configurada. Configure ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou OPENAI_API_KEY no servidor."
      );
    }

    const model = getAIModel(provider);

    const { object } = await generateObject({
      model,
      schema: InvestBreakdownSchema,
      system: `Você é um especialista SAFe que avalia épicos usando o critério INVEST.
Retorne scores de 0-100 para cada dimensão (I=Independent, N=Negotiable, V=Valuable, E=Estimable, S=Small, T=Testable).
compositeScore = média ponderada (V e T pesam mais).
isSmall = true se S >= 60.`,
      prompt: `Épico: "${epic.title}"
Descrição: ${epic.descriptionMd ?? "(sem descrição)"}

Avalie este épico SAFe usando INVEST e retorne o JSON de score.`,
    });

    // Persist result
    await database.epic.update({
      where: { id: epic.id, tenantId: ctx.tenantId },
      data: {
        investScore: object.compositeScore,
        investBreakdown: object,
        investHash: currentHash,
      },
    });

    return object;
  });
}
