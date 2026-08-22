// linear-webhook-consumer.test.ts — COS-90: consumidor do evento
// `integration/linear.webhook`, que até aqui só era enfileirado e nunca
// consumido (app/api/webhooks/linear/route.ts enfileira; nenhuma function
// ouvia o evento).
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  integrationFindFirstOrThrow: vi.fn(),
  handleLinearWebhook: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: mocks.createFunction },
}));

vi.mock("@repo/database", () => ({
  database: {
    integration: { findFirstOrThrow: mocks.integrationFindFirstOrThrow },
  },
}));

vi.mock("@/app/actions/integrations/sync/linear-pull", () => ({
  handleLinearWebhook: mocks.handleLinearWebhook,
}));

import "@/lib/inngest/linear-webhook-consumer";

type StepCtx = {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
};

type HandlerFn = (ctx: { event: unknown; step: StepCtx }) => Promise<unknown>;

type CapturedConfig = {
  id: string;
  triggers: { event: string }[];
  concurrency: { key: string; limit: number }[];
  retries: number;
};

let capturedConfig: CapturedConfig;
let capturedHandler: HandlerFn;

beforeAll(() => {
  const [[config, handler]] = mocks.createFunction.mock.calls as [
    [CapturedConfig, HandlerFn],
  ];
  capturedConfig = config;
  capturedHandler = handler;
});

function makeStep(): StepCtx {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
  };
}

const baseEvent = {
  data: {
    tenantId: "t1",
    integrationId: "integ-1",
    action: "update",
    type: "Issue",
    webhookId: "wh-1",
    data: { id: "iss-1", title: "Issue 1" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationFindFirstOrThrow.mockResolvedValue({ mapping: null });
  mocks.handleLinearWebhook.mockResolvedValue(undefined);
});

describe("consumeLinearWebhook registration", () => {
  it("registra com id linear-webhook-consumer", () => {
    expect(capturedConfig.id).toBe("linear-webhook-consumer");
  });

  it("escuta integration/linear.webhook", () => {
    expect(capturedConfig.triggers[0]?.event).toBe(
      "integration/linear.webhook"
    );
  });

  it("serializa por integrationId para evitar corrida de criação duplicada", () => {
    expect(capturedConfig.concurrency).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "event.data.integrationId",
          limit: 1,
        }),
      ])
    );
  });
});

describe("handler — caminho feliz", () => {
  it("carrega a integration ACTIVE do tenant e integrationId do evento", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    expect(mocks.integrationFindFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "integ-1",
          tenantId: "t1",
          source: "linear",
          status: "ACTIVE",
        },
      })
    );
  });

  it("chama handleLinearWebhook com tenantId, integrationId e o payload do evento", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    expect(mocks.handleLinearWebhook).toHaveBeenCalledWith(
      "t1",
      "integ-1",
      expect.objectContaining({
        action: "update",
        type: "Issue",
        webhookId: "wh-1",
        data: { id: "iss-1", title: "Issue 1" },
      }),
      undefined
    );
  });

  it("monta opts com linearProjectId quando o mapping da integration configura o filtro (COS-85)", async () => {
    mocks.integrationFindFirstOrThrow.mockResolvedValue({
      mapping: { linearProjectId: "proj-x" },
    });

    await capturedHandler({ event: baseEvent, step: makeStep() });

    expect(mocks.handleLinearWebhook).toHaveBeenCalledWith(
      "t1",
      "integ-1",
      expect.anything(),
      { linearProjectId: "proj-x" }
    );
  });

  it("não monta opts quando o mapping não tem linearProjectId", async () => {
    mocks.integrationFindFirstOrThrow.mockResolvedValue({
      mapping: { someOtherKey: true },
    });

    await capturedHandler({ event: baseEvent, step: makeStep() });

    const call = mocks.handleLinearWebhook.mock.calls[0];
    expect(call[3]).toBeUndefined();
  });
});

describe("handler — erro propaga para o retry do Inngest", () => {
  it("propaga quando a integration não é encontrada (findFirstOrThrow rejeita)", async () => {
    mocks.integrationFindFirstOrThrow.mockRejectedValue(
      new Error("integration não encontrada")
    );

    await expect(
      capturedHandler({ event: baseEvent, step: makeStep() })
    ).rejects.toThrow("integration não encontrada");
  });

  it("propaga quando handleLinearWebhook falha, sem engolir o erro", async () => {
    mocks.handleLinearWebhook.mockRejectedValue(new Error("boom"));

    await expect(
      capturedHandler({ event: baseEvent, step: makeStep() })
    ).rejects.toThrow("boom");
  });
});
