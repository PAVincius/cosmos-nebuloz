"use server";

import { z } from "zod";
import { database } from "@repo/database";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import { canTransition, type GovernanceState } from "./state-machine";

const TransitionSchema = z.object({
  epicId: z.string().min(1),
  to: z.enum([
    "FUNNEL",
    "ANALYZING",
    "PORTFOLIO_BACKLOG",
    "IMPLEMENTING",
    "DONE",
    "CANCELLED",
  ]),
  justificativa: z
    .string()
    .min(10, "Justificativa deve ter ao menos 10 caracteres"),
  dadosSuporte: z.record(z.unknown()).optional(),
});

export type TransitionEpicInput = z.infer<typeof TransitionSchema>;

export async function transitionEpic(
  raw: unknown,
): Promise<Result<{ newState: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = TransitionSchema.parse(raw);

    const governed = await database.governedEpic.findFirst({
      where: { tenantId: ctx.tenantId, epicId: input.epicId },
      include: {
        epic: { select: { title: true, investScore: true } },
      },
    });
    if (!governed) {
      throw new Error("GovernedEpic não encontrado");
    }

    const from = governed.governanceStatus as GovernanceState;
    if (!canTransition(from, input.to)) {
      throw new Error(`Transição inválida: ${from} -> ${input.to}`);
    }

    await database.$transaction(async (tx) => {
      await tx.governedEpic.update({
        where: { id: governed.id },
        data: { governanceStatus: input.to },
      });

      await tx.decisionLogEntry.create({
        data: {
          tenantId: ctx.tenantId,
          tipo: "epic_decision",
          targetType: "epic",
          targetId: input.epicId,
          decisao: `${from} -> ${input.to}: ${governed.epic.title}`,
          justificativa: input.justificativa,
          dadosSuporte: {
            ...(input.dadosSuporte ?? {}),
            investScore: governed.epic.investScore,
            fromState: from,
            toState: input.to,
          } as object,
          decisorId: ctx.userId,
        },
      });
    });

    return { newState: input.to };
  });
}
