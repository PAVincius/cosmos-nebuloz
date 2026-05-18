import { models } from "@repo/ai/lib/models";
import { database } from "@repo/database";
import { findSimilarRisks } from "@repo/database/vector-search";
import { embed, tool } from "ai";
import { z } from "zod";

export function buildCopilotTools(tenantId: string) {
  return {
    queryFlowMetrics: tool({
      description:
        "Query flow metrics (velocity, load, efficiency, predictability, lead time) for a specific scope and scope ID",
      inputSchema: z.object({
        scope: z
          .enum(["team", "art", "value_stream"])
          .describe("Scope level to query"),
        scopeId: z.string().describe("ID of the team, ART, or value stream"),
        periods: z
          .number()
          .int()
          .min(1)
          .max(6)
          .default(3)
          .describe("Number of recent periods to retrieve"),
      }),
      execute: async ({ scope, scopeId, periods }) => {
        const snapshots = await database.flowMetricSnapshot.findMany({
          where: { tenantId, scope, scopeId },
          orderBy: { periodRef: "desc" },
          take: periods,
        });
        return { scope, scopeId, snapshots };
      },
    }),

    queryLeanBudget: tool({
      description:
        "Query lean budget allocation and spend for portfolio, ART, or value stream",
      inputSchema: z.object({
        entityId: z.string().describe("ID of the entity to query budget for"),
        entityType: z.enum(["art", "portfolio"]).describe("Type of entity"),
      }),
      execute: async ({ entityId, entityType }) => {
        if (entityType === "portfolio") {
          const [portfolioBudgets, themes] = await Promise.all([
            database.leanBudget.findMany({
              where: { tenantId },
              select: {
                id: true,
                name: true,
                amount: true,
                spent: true,
                period: true,
                artId: true,
              },
              take: 20,
            }),
            database.strategicTheme.findMany({
              where: { tenantId },
              select: {
                id: true,
                code: true,
                title: true,
                status: true,
                budgetTotal: true,
              },
              take: 15,
            }),
          ]);
          return { entityType, budgets: portfolioBudgets, themes };
        }
        // ART: get lean budgets for this ART
        const budgets = await database.leanBudget.findMany({
          where: { tenantId, ...(entityId ? { artId: entityId } : {}) },
          select: {
            id: true,
            name: true,
            amount: true,
            spent: true,
            period: true,
            artId: true,
          },
          take: 10,
        });
        return { entityType, entityId, budgets };
      },
    }),

    queryProgramBoard: tool({
      description:
        "Query program board data: features, dependencies (blocks/blocked-by), and risks for a PI",
      inputSchema: z.object({
        artId: z.string().describe("ART ID"),
        piId: z.string().describe("PI Plan ID"),
      }),
      execute: async ({ artId, piId }) => {
        const [features, risks, objectives] = await Promise.all([
          database.feature.findMany({
            where: { tenantId, piPlanId: piId },
            select: {
              id: true,
              title: true,
              statusId: true,
              wsjfScore: true,
              storyPoints: true,
              blocks: {
                select: {
                  blockedFeature: { select: { id: true, title: true } },
                },
              },
              blockedBy: {
                select: {
                  blockingFeature: { select: { id: true, title: true } },
                },
              },
            },
            take: 50,
          }),
          database.risk.findMany({
            where: { tenantId, piPlanId: piId },
            select: {
              id: true,
              title: true,
              status: true,
              category: true,
              impact: true,
            },
            take: 20,
          }),
          database.pIObjective.findMany({
            where: { tenantId, piPlanId: piId },
            select: {
              id: true,
              title: true,
              businessValue: true,
              status: true,
              isStretch: true,
            },
          }),
        ]);
        return { artId, piId, features, risks, objectives };
      },
    }),

    queryRiskVectors: tool({
      description:
        "Semantic search for similar risks or PI knowledge using vector embeddings",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Natural language query to search for similar risks or PI knowledge"
          ),
      }),
      execute: async ({ query }) => {
        try {
          const { embedding } = await embed({
            model: models.embeddings,
            value: query,
          });
          const results = await findSimilarRisks(tenantId, embedding, 5, 0.7);
          return { query, results };
        } catch {
          return { query, results: [], error: "Vector search unavailable" };
        }
      },
    }),
  };
}
