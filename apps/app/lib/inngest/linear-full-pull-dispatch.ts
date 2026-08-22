import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { decryptConfigSecrets } from "@repo/security/encrypt";
import { triggerLinearFullPull } from "@/app/actions/integrations/sync/linear-full-pull";
import { inngest } from "./client";

type StepLike = {
  run: <T>(id: string, fn: () => T | Promise<T>) => Promise<T>;
};

type ActiveLinearIntegration = {
  id: string;
  tenantId: string;
  config: unknown;
  mapping: unknown;
};

/**
 * COS-90: reconciliação periódica — o consumidor de webhook
 * (linear-webhook-consumer.ts) é o único caminho ao vivo, e um webhook
 * perdido (outage do Inngest, erro transitório do Linear) some do sync para
 * sempre sem isto. O full pull relê o estado atual do time inteiro;
 * handleLinearWebhook só escreve o que realmente difere do Cosmos
 * (linear-pull.ts), então reprocessar issues já sincronizadas é barato a
 * jusante — o custo desta rotina é só as chamadas de leitura à API do Linear.
 *
 * SEM resumeCursor DE PROPÓSITO: triggerLinearFullPull grava o cursor em
 * LinearSync.metadata.fullPullCursor como efeito colateral de cada página
 * (linear-full-pull.ts), mas não o relê sozinho no início da execução —
 * quem chama decide o ponto de partida. Esse cursor foi desenhado para
 * retomar uma execução INTERROMPIDA (AC-006), não para encadear rodadas
 * incrementais: reaproveitar o cursor da rodada anterior como ponto de
 * partida só reconciliaria corretamente se a ordenação por `updatedAt` da
 * API do Linear garantisse que uma issue com webhook perdido sempre
 * reaparece depois desse cursor — isso é comportamento da API do Linear, não
 * dá para confirmar lendo este repositório. Cada rodada varre o time do
 * zero para não depender dessa aposta.
 */
export async function dispatchLinearFullPull({
  step,
}: {
  step: StepLike;
}): Promise<{ examinadas: number; disparadas: number }> {
  const integrations = (await step.run("carregar-integracoes-ativas", () =>
    database.integration.findMany({
      where: { source: "linear", status: "ACTIVE" },
      select: { id: true, tenantId: true, config: true, mapping: true },
    })
  )) as ActiveLinearIntegration[];

  let disparadas = 0;

  for (const integration of integrations) {
    const mapping = integration.mapping as {
      projectId?: unknown;
      linearProjectId?: unknown;
    } | null;
    const teamId = mapping?.projectId;

    if (typeof teamId !== "string" || teamId.length === 0) {
      log.error("[linear-full-pull-dispatch] integração sem time mapeado", {
        integrationId: integration.id,
      });
      continue;
    }

    const config = decryptConfigSecrets(
      integration.config as Record<string, unknown>
    ) as Record<string, string>;

    if (!config.apiKey) {
      log.error("[linear-full-pull-dispatch] integração sem apiKey", {
        integrationId: integration.id,
      });
      continue;
    }

    try {
      await step.run(`full-pull-${integration.id}`, () =>
        triggerLinearFullPull({
          tenantId: integration.tenantId,
          integrationId: integration.id,
          teamId,
          apiKey: config.apiKey,
          ...(typeof mapping?.linearProjectId === "string"
            ? { linearProjectId: mapping.linearProjectId }
            : {}),
        })
      );
      disparadas += 1;
    } catch (e) {
      // Uma integração com falha (Linear fora do ar, apiKey revogada) não
      // pode travar a reconciliação das demais — mesmo trade-off de
      // scheduled-report-dispatch.ts: isolamento entre integrações
      // preferido a retry automático desta ocorrência, porque a próxima
      // rodada do cron (6h) já tenta de novo.
      log.error("[linear-full-pull-dispatch] full pull falhou", {
        integrationId: integration.id,
        error: String(e),
      });
    }
  }

  return { examinadas: integrations.length, disparadas };
}

export const linearFullPullDispatch = inngest.createFunction(
  {
    id: "linear-full-pull-dispatch",
    // Frequência conservadora: reconciliação é rede de segurança, não o
    // caminho principal — a cada 6h já limita bem o estrago de um webhook
    // perdido, sem competir por rate limit com o tráfego real do Linear.
    triggers: [{ cron: "0 */6 * * *" }],
    concurrency: { limit: 1 },
  },
  ({ step }) => dispatchLinearFullPull({ step: step as StepLike })
);
