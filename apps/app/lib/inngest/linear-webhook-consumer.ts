import { database } from "@repo/database";
import {
  lerScopes,
  projectsAceitos,
} from "@/app/actions/integrations/linear-scopes";
import {
  handleLinearWebhook,
  type LinearWebhookPayload,
} from "@/app/actions/integrations/sync/linear-pull";
import { inngest } from "./client";

type LinearWebhookEventData = {
  tenantId: string;
  integrationId: string;
} & LinearWebhookPayload;

/**
 * COS-90: fecha o loop do webhook — app/api/webhooks/linear/route.ts valida
 * assinatura e só enfileira `integration/linear.webhook` no Inngest; até
 * aqui nenhuma function consumia o evento e ele morria na fila.
 */
export const consumeLinearWebhook = inngest.createFunction(
  {
    id: "linear-webhook-consumer",
    triggers: [{ event: "integration/linear.webhook" }],
    // handleLinearWebhook decide entre criar ou atualizar a Story
    // consultando o mapping antes de escrever (linear-pull.ts). Dois
    // webhooks da mesma issue nova em paralelo correriam essa checagem ao
    // mesmo tempo e criariam duas Stories — serializar por integração
    // evita a corrida.
    concurrency: [{ key: "event.data.integrationId", limit: 1 }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { tenantId, integrationId, ...payload } =
      event.data as LinearWebhookEventData;

    // COS-85: o filtro por project do Linear mora em Integration.mapping,
    // não no evento em si — sem carregar a integration, um tenant
    // multi-produto no plano free do Linear importaria issues dos outros
    // produtos do mesmo time.
    const linearProjectIds = await step.run("load-integration", async () => {
      const integration = await database.integration.findFirstOrThrow({
        where: {
          id: integrationId,
          tenantId,
          source: "linear",
          status: "ACTIVE",
        },
        select: { mapping: true },
      });

      // Uma integração acompanha vários projects (a credencial é da conta),
      // então o filtro é uma lista. `null`, não `undefined`: o retorno de
      // step.run passa por serialização no Inngest real (mesmo cuidado
      // documentado em scheduled-report-dispatch.ts para lastRunAt).
      return projectsAceitos(lerScopes(integration.mapping));
    });

    const opts = linearProjectIds ? { linearProjectIds } : undefined;

    // Sem try/catch de propósito: erro aqui (integration sumiu, Linear
    // trouxe dado inesperado, banco fora) precisa propagar para o retry do
    // Inngest, não sumir silenciosamente.
    await step.run("handle-webhook", () =>
      handleLinearWebhook(tenantId, integrationId, payload, opts)
    );

    return { ok: true };
  }
);
