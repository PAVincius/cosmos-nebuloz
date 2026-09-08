// @vitest-environment node
//
// Corrida cron full pull × webhook ao vivo (limitação registrada no PR #91 /
// COS-90): consumer e cron são functions Inngest independentes — a concurrency
// key por integrationId só serializa execuções da MESMA function. Duas
// chamadas concorrentes de handleLinearWebhook para a mesma issue nova podem
// ambas passar pelo find-then-create sem enxergar uma à outra e criar duas
// Stories para a mesma issue do Linear.
//
// O fake de banco abaixo impõe o unique (tenantId, externalId, externalSource)
// que a migration correspondente cria no Postgres, e segura os dois lookups
// pré-create numa barreira para forçar o entrelaçamento exato da corrida: os
// dois SELECTs acontecem antes de qualquer INSERT.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeStory = {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  externalId: string;
  externalSource: string;
  status: string;
  updatedAt: Date;
};

const mocks = vi.hoisted(() => ({
  linearSyncFindFirst: vi.fn(),
  storyFindFirst: vi.fn(),
  storyCreate: vi.fn(),
  storyUpdateMany: vi.fn(),
  stateTransitionCreate: vi.fn(),
  linearSyncEventCreate: vi.fn(),
  linearSyncUpsert: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    linearSync: {
      findFirst: mocks.linearSyncFindFirst,
      upsert: mocks.linearSyncUpsert,
    },
    story: {
      findFirst: mocks.storyFindFirst,
      create: mocks.storyCreate,
      updateMany: mocks.storyUpdateMany,
    },
    stateTransitionHistory: { create: mocks.stateTransitionCreate },
    linearSyncEvent: { create: mocks.linearSyncEventCreate },
  },
}));

import {
  handleLinearWebhook,
  type LinearWebhookPayload,
} from "../../../app/actions/integrations/sync/linear-pull";

const TENANT = "tenant-1";
const INT_ID = "int-1";
const ISSUE_ID = "lin-race-1";

function payload(): LinearWebhookPayload {
  return {
    action: "create",
    type: "Issue",
    data: {
      id: ISSUE_ID,
      title: "Issue nova vista por cron e webhook ao mesmo tempo",
      state: { name: "Todo" },
      updatedAt: "2026-08-22T00:00:00Z",
    },
  };
}

describe("handleLinearWebhook — corrida create-vs-create (mesma issue nova)", () => {
  let stories: FakeStory[];

  beforeEach(() => {
    vi.clearAllMocks();
    stories = [];

    mocks.linearSyncFindFirst.mockResolvedValue(null);
    mocks.linearSyncUpsert.mockResolvedValue({});
    mocks.linearSyncEventCreate.mockResolvedValue({ id: "evt" });
    mocks.stateTransitionCreate.mockResolvedValue({ id: "sth" });
    mocks.storyUpdateMany.mockResolvedValue({ count: 1 });

    // Barreira: os dois primeiros lookups por externalId (um de cada executor)
    // só resolvem depois que AMBOS chegaram — nenhum executor enxerga o INSERT
    // do outro, como na janela real da corrida.
    let lookupsByExternalId = 0;
    let releaseBarrier: (() => void) | undefined;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    mocks.storyFindFirst.mockImplementation(
      async (query: {
        where: { id?: string; tenantId: string; externalId?: string };
      }) => {
        if (query.where.id) {
          return stories.find((s) => s.id === query.where.id) ?? null;
        }
        lookupsByExternalId += 1;
        if (lookupsByExternalId <= 2) {
          if (lookupsByExternalId === 2) {
            releaseBarrier?.();
          }
          await barrier;
          return null;
        }
        return (
          stories.find(
            (s) =>
              s.tenantId === query.where.tenantId &&
              s.externalId === query.where.externalId
          ) ?? null
        );
      }
    );

    // Fake do Postgres pós-migration: unique em (tenantId, externalId,
    // externalSource) — o segundo INSERT da corrida falha com P2002.
    mocks.storyCreate.mockImplementation(
      async (query: { data: Omit<FakeStory, "id" | "updatedAt"> }) => {
        const duplicate = stories.some(
          (s) =>
            s.tenantId === query.data.tenantId &&
            s.externalId === query.data.externalId &&
            s.externalSource === query.data.externalSource
        );
        if (duplicate) {
          throw Object.assign(
            new Error(
              "Unique constraint failed on the fields: (`tenantId`,`externalId`,`externalSource`)"
            ),
            { code: "P2002" }
          );
        }
        const story: FakeStory = {
          ...query.data,
          id: `story-${stories.length + 1}`,
          updatedAt: new Date("2026-08-22T00:00:00Z"),
        };
        stories.push(story);
        return { id: story.id };
      }
    );
  });

  it("cria uma única Story e converge o perdedor para o caminho de update", async () => {
    await Promise.all([
      handleLinearWebhook(TENANT, INT_ID, payload()),
      handleLinearWebhook(TENANT, INT_ID, payload()),
    ]);

    // uma Story só — a segunda seria duplicata da mesma issue do Linear
    expect(stories).toHaveLength(1);

    // os dois executores terminam com o mapping apontando para a sobrevivente
    expect(mocks.linearSyncUpsert).toHaveBeenCalledTimes(2);
    for (const call of mocks.linearSyncUpsert.mock.calls) {
      expect(call[0].create.cosmosId).toBe(stories[0].id);
    }

    // CREATED é do vencedor; o perdedor não registra segunda criação
    const createdEvents = mocks.linearSyncEventCreate.mock.calls.filter(
      (call) => call[0].data.action === "CREATED"
    );
    expect(createdEvents).toHaveLength(1);
  });

  it("relança erro de create que não é violação de unique", async () => {
    mocks.storyFindFirst.mockResolvedValue(null);
    mocks.storyCreate.mockRejectedValue(
      Object.assign(new Error("connection reset"), { code: "P1001" })
    );

    await expect(
      handleLinearWebhook(TENANT, INT_ID, payload())
    ).rejects.toThrow("connection reset");
  });

  it("schema do Prisma declara o unique que sustenta a recuperação da corrida", () => {
    const schemaPath = fileURLToPath(
      new URL(
        "../../../../../packages/database/prisma/schema/team-delivery.prisma",
        import.meta.url
      )
    );
    const schema = readFileSync(schemaPath, "utf8");
    const start = schema.indexOf("model Story {");
    const end = schema.indexOf("\n}", start);
    const storyBlock = schema.slice(start, end);
    expect(storyBlock).toContain(
      "@@unique([tenantId, externalId, externalSource])"
    );
  });
});
