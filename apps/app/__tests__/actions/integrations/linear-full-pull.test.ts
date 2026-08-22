// linear-full-pull.test.ts — cursor-resumable full pull (Story-024 AC-006).
//
// COS-84: o cursor do full pull é gravado com
// `linearSync.updateMany({ where: { tenantId } })`, substituindo `metadata`
// inteiro. Isso escreve em TODA linha LinearSync do tenant — não só a do
// time puxado — e apaga qualquer outra chave que já morasse em `metadata`
// (ex.: `linearTeamId` que `linear-push.ts` usa para resolver o team ao
// empurrar labels). O cursor é por (integração, time); o teste abaixo prova
// isolamento entre dois times do mesmo tenant e preservação do resto do
// metadata.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  linearSyncFindFirst: vi.fn(),
  linearSyncUpdateMany: vi.fn(),
  handleLinearWebhook: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    linearSync: {
      findFirst: mocks.linearSyncFindFirst,
      updateMany: mocks.linearSyncUpdateMany,
    },
  },
}));

vi.mock("../../../app/actions/integrations/sync/linear-pull", () => ({
  handleLinearWebhook: mocks.handleLinearWebhook,
}));

global.fetch = vi.fn() as unknown as typeof fetch;

import { triggerLinearFullPull } from "../../../app/actions/integrations/sync/linear-full-pull";

const TENANT = "tenant-1";
const INTEGRATION = "int-1";

function mockLinearPage(
  nodes: unknown[],
  hasNextPage = false,
  endCursor: string | null = null
) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: {
        team: { issues: { nodes, pageInfo: { hasNextPage, endCursor } } },
      },
    }),
  });
}

describe("triggerLinearFullPull — escopo da escrita do cursor (COS-84)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleLinearWebhook.mockResolvedValue(undefined);
    mocks.linearSyncUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("escopa a leitura e a escrita do cursor por tenant+time, não só por tenant", async () => {
    mocks.linearSyncFindFirst.mockResolvedValue({ metadata: null });
    mockLinearPage([{ id: "iss-1", title: "Issue 1" }], false, "cursor-a");

    await triggerLinearFullPull({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      teamId: "team-a",
      apiKey: "key",
    });

    expect(mocks.linearSyncFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT, linearId: "team-a", linearType: "team" },
      })
    );
    expect(mocks.linearSyncUpdateMany).toHaveBeenCalledTimes(1);
    const call = mocks.linearSyncUpdateMany.mock.calls[0][0];
    expect(call.where).toEqual({
      tenantId: TENANT,
      linearId: "team-a",
      linearType: "team",
    });
    // a asserção que capturava o bug: nunca `{ tenantId }` sozinho
    expect(call.where).not.toEqual({ tenantId: TENANT });
  });

  it("preserva as outras chaves do metadata em vez de substituir o objeto inteiro", async () => {
    mocks.linearSyncFindFirst.mockResolvedValue({
      metadata: { linearTeamId: "team-a", someOtherFlag: true },
    });
    mockLinearPage([{ id: "iss-1", title: "Issue 1" }], false, "cursor-b");

    await triggerLinearFullPull({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      teamId: "team-a",
      apiKey: "key",
    });

    const call = mocks.linearSyncUpdateMany.mock.calls[0][0];
    expect(call.data.metadata).toEqual({
      linearTeamId: "team-a",
      someOtherFlag: true,
      fullPullCursor: "cursor-b",
      fullPullAt: expect.any(String),
    });
  });

  it("full pull do time A não apaga o cursor (nem o resto do metadata) do time B — dois registros no mock", async () => {
    const store = [
      {
        id: "ls-a",
        tenantId: TENANT,
        linearId: "team-a",
        linearType: "team",
        metadata: { fullPullCursor: "old-a" } as Record<string, unknown>,
      },
      {
        id: "ls-b",
        tenantId: TENANT,
        linearId: "team-b",
        linearType: "team",
        metadata: {
          fullPullCursor: "old-b",
          untouchable: true,
        } as Record<string, unknown>,
      },
    ];

    mocks.linearSyncFindFirst.mockImplementation(
      ({
        where,
      }: {
        where: { tenantId: string; linearId: string; linearType: string };
      }) =>
        Promise.resolve(
          store.find(
            (row) =>
              row.tenantId === where.tenantId &&
              row.linearId === where.linearId &&
              row.linearType === where.linearType
          ) ?? null
        )
    );
    mocks.linearSyncUpdateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { tenantId: string; linearId: string; linearType: string };
        data: { metadata: Record<string, unknown> };
      }) => {
        let count = 0;
        for (const row of store) {
          if (
            row.tenantId === where.tenantId &&
            row.linearId === where.linearId &&
            row.linearType === where.linearType
          ) {
            row.metadata = data.metadata;
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }
    );

    mockLinearPage([{ id: "iss-1", title: "Issue 1" }], false, "new-cursor-a");

    await triggerLinearFullPull({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      teamId: "team-a",
      apiKey: "key",
    });

    const rowA = store.find((row) => row.id === "ls-a");
    const rowB = store.find((row) => row.id === "ls-b");
    expect(rowA?.metadata).toEqual({
      fullPullCursor: "new-cursor-a",
      fullPullAt: expect.any(String),
    });
    // time B fica intocado — nem o cursor, nem a chave que só ele tinha
    expect(rowB?.metadata).toEqual({
      fullPullCursor: "old-b",
      untouchable: true,
    });
  });
});

// ─── COS-85: filtro por project do Linear ──────────────────────────────────
//
// O full pull hoje é o único chamador real de handleLinearWebhook (não há
// consumidor de webhook ao vivo — app/api/webhooks/linear/route.ts só
// enfileira no Inngest, e nenhuma function consome esse evento ainda). Por
// isso o filtro por project entra em dois pontos: a query já pede
// `project { id }` — de graça, é o mesmo request paginado — e o resultado
// segue para handleLinearWebhook, que decide se aceita ou descarta.
describe("triggerLinearFullPull — repasse do filtro de project (COS-85)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.linearSyncFindFirst.mockResolvedValue({ metadata: null });
    mocks.linearSyncUpdateMany.mockResolvedValue({ count: 1 });
    mocks.handleLinearWebhook.mockResolvedValue(undefined);
  });

  it("inclui o project da issue no payload e repassa o filtro configurado para handleLinearWebhook", async () => {
    mockLinearPage(
      [{ id: "iss-1", title: "Issue 1", project: { id: "proj-x" } }],
      false,
      "cursor-x"
    );

    await triggerLinearFullPull({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      teamId: "team-a",
      apiKey: "key",
      linearProjectId: "proj-x",
    });

    expect(mocks.handleLinearWebhook).toHaveBeenCalledWith(
      TENANT,
      INTEGRATION,
      expect.objectContaining({
        data: expect.objectContaining({ project: { id: "proj-x" } }),
      }),
      { linearProjectId: "proj-x" }
    );
  });

  it("não manda opts de filtro quando nenhum linearProjectId é configurado (comportamento atual intacto)", async () => {
    mockLinearPage([{ id: "iss-1", title: "Issue 1" }], false, "cursor-y");

    await triggerLinearFullPull({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      teamId: "team-a",
      apiKey: "key",
    });

    const call = mocks.handleLinearWebhook.mock.calls[0];
    expect(call[3]).toBeUndefined();
  });
});
