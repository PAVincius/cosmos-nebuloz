import { database } from "@repo/database";
import { fetchBrazilAiLaws } from "@/lib/ai-law-tracker/client";
import { inngest } from "./client";

// Dado interno da Nebuloz, não feature de tenant cliente — mesmo id literal
// usado em lib/inngest/isolation-audit.ts e scripts/seed-empresa-nebuloz.ts.
const SYSTEM_TENANT_ID = "system";
const SOURCE = "ai-law-tracker";
const JURISDICTION = "brazil";

// ─── Monitoramento diário de leis/PLs de IA no Brasil ────────────────────────
//
// Consulta a API AI Law Tracker, guarda o que já viu em AiLawWatchRecord e
// reporta o que é novo desde a última rodada. "Novo" é decidido por
// findUnique-then-branch (não pelo retorno do upsert, que não diferencia
// create de update) — é o único jeito de não recontar um registro já visto
// como novo numa segunda execução no mesmo dia.
export const aiLawWatchFunction = inngest.createFunction(
  {
    id: "ai-law-watch",
    triggers: [{ event: "ai-law/watch.requested" }],
    retries: 3,
  },
  async ({ step }) => {
    const records = await step.run("fetch-records", async () => {
      const apiKey = process.env.AI_LAW_TRACKER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "[ai-law-watch] variável AI_LAW_TRACKER_API_KEY ausente"
        );
      }
      return fetchBrazilAiLaws(apiKey);
    });

    const summary = await step.run("upsert-and-diff", async () => {
      const novos: string[] = [];

      for (const record of records) {
        const existing = await database.aiLawWatchRecord.findUnique({
          where: {
            tenantId_source_jurisdiction_identifier: {
              tenantId: SYSTEM_TENANT_ID,
              source: SOURCE,
              jurisdiction: JURISDICTION,
              identifier: record.identifier,
            },
          },
        });

        if (existing) {
          await database.aiLawWatchRecord.update({
            where: { id: existing.id },
            data: {
              title: record.title,
              recordType: record.recordType,
              inForce: record.inForce,
              officialUrl: record.officialUrl,
            },
          });
          continue;
        }

        await database.aiLawWatchRecord.create({
          data: {
            tenantId: SYSTEM_TENANT_ID,
            source: SOURCE,
            jurisdiction: JURISDICTION,
            identifier: record.identifier,
            title: record.title,
            recordType: record.recordType,
            inForce: record.inForce,
            officialUrl: record.officialUrl,
          },
        });
        novos.push(record.identifier);
      }

      return { total: records.length, novos, novos_count: novos.length };
    });

    return summary;
  }
);
