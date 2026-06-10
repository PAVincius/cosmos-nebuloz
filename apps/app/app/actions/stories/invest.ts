"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";

export type InvestLevel = "ERROR" | "WARN" | "INFO";
export type InvestBadge = "GREEN" | "AMBER" | "RED";

export type InvestCriterion = {
  key: string;
  label: string;
  pass: boolean;
  level: InvestLevel;
  hint: string;
};

export type InvestResult = {
  badge: InvestBadge;
  criteria: InvestCriterion[];
};

type StoryFields = {
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  storyPoints: number;
  status: string;
};

export function evaluateStoryInvest(story: StoryFields): InvestResult {
  const criteria: InvestCriterion[] = [
    {
      key: "estimable",
      label: "Estimable",
      pass: story.storyPoints > 0,
      level: "ERROR",
      hint: "Adicione uma estimativa em story points",
    },
    {
      key: "testable",
      label: "Testable",
      pass: (story.acceptanceCriteria ?? "").trim().length > 0,
      level: "ERROR",
      hint: "Adicione critérios de aceitação",
    },
    {
      key: "small",
      label: "Small",
      pass: story.storyPoints <= 13,
      level: "WARN",
      hint: "Considere quebrar esta story (> 13 pontos)",
    },
    {
      key: "negotiable",
      label: "Negotiable",
      pass: (story.description ?? "").trim().length > 0,
      level: "WARN",
      hint: "Adicione uma descrição",
    },
    {
      key: "valuable",
      label: "Valuable",
      pass: /i want|quero|so that|para que|para /i.test(
        story.description ?? ""
      ),
      level: "WARN",
      hint: 'Use o formato "Como... quero... para que..."',
    },
    {
      key: "independent",
      label: "Independent",
      pass: story.status !== "SPLIT_INTO",
      level: "INFO",
      hint: "Story foi dividida — use as stories derivadas",
    },
  ];

  const hasError = criteria.some((c) => !c.pass && c.level === "ERROR");
  const hasWarn = criteria.some((c) => !c.pass && c.level === "WARN");

  const badge: InvestBadge = hasError ? "RED" : hasWarn ? "AMBER" : "GREEN";

  return { badge, criteria };
}

export async function checkStoryInvest(
  storyId: string
): Promise<Result<InvestResult>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const story = await database.story.findFirst({
      where: { id: storyId, tenantId: ctx.tenantId },
      select: {
        title: true,
        description: true,
        acceptanceCriteria: true,
        storyPoints: true,
        status: true,
      },
    });
    if (!story) {
      throw new Error("Story não encontrada");
    }
    return evaluateStoryInvest(story);
  });
}
