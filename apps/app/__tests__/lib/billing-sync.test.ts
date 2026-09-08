import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  inngestSend: vi.fn(),
  integrationFindFirstOrThrow: vi.fn(),
  integrationUpdate: vi.fn(),
  billingSyncCursorFindUnique: vi.fn(),
  billingSyncCursorUpsert: vi.fn(),
  billingSyncRunCreate: vi.fn(),
  billingSyncRunUpdate: vi.fn(),
  billingEntryStagingCreateMany: vi.fn(),
  billingEntryStagingFindMany: vi.fn(),
  billingEntryStagingDeleteMany: vi.fn(),
  billingEntryCreateMany: vi.fn(),
  tagRuleFindMany: vi.fn(),
  dbExecuteRaw: vi.fn(),
  dbTransaction: vi.fn(),
  fetchAwsPage: vi.fn(),
  resolveMapping: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: mocks.createFunction,
    send: mocks.inngestSend,
  },
}));

vi.mock("@repo/database", () => ({
  database: {
    integration: {
      findFirstOrThrow: mocks.integrationFindFirstOrThrow,
      update: mocks.integrationUpdate,
    },
    billingSyncCursor: {
      findUnique: mocks.billingSyncCursorFindUnique,
      upsert: mocks.billingSyncCursorUpsert,
    },
    billingSyncRun: {
      create: mocks.billingSyncRunCreate,
      update: mocks.billingSyncRunUpdate,
    },
    billingEntryStaging: {
      createMany: mocks.billingEntryStagingCreateMany,
      findMany: mocks.billingEntryStagingFindMany,
      deleteMany: mocks.billingEntryStagingDeleteMany,
    },
    billingEntry: { createMany: mocks.billingEntryCreateMany },
    tagRule: { findMany: mocks.tagRuleFindMany },
    $executeRaw: mocks.dbExecuteRaw,
    $transaction: mocks.dbTransaction,
  },
}));

vi.mock("@/lib/billing-adapters/aws", () => ({
  fetchAwsPage: mocks.fetchAwsPage,
}));

vi.mock("@/lib/billing-adapters/tag-rule-engine", () => ({
  resolveMapping: mocks.resolveMapping,
}));

import "@/lib/inngest/billing-sync";

type StepCtx = {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
};

type HandlerFn = (ctx: { event: unknown; step: StepCtx }) => Promise<unknown>;

let capturedConfig: { id: string; triggers: { event: string }[] };
let capturedHandler: HandlerFn;

beforeAll(() => {
  const [[config, handler]] = mocks.createFunction.mock.calls as [
    [{ id: string; triggers: { event: string }[] }, HandlerFn],
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
  data: { tenantId: "t1", integrationId: "integ-1" },
};

function makeStagedRow(payload: Record<string, unknown>) {
  return { payload };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.integrationFindFirstOrThrow.mockResolvedValue({
    id: "integ-1",
    config: {
      roleArn: "arn:aws:iam::123:role/R",
      externalId: "ext-1",
      region: "us-east-1",
    },
  });
  mocks.billingSyncCursorFindUnique.mockResolvedValue(null);
  mocks.billingSyncRunCreate.mockResolvedValue({ id: "run-1" });
  mocks.fetchAwsPage.mockResolvedValue({
    entries: [],
    nextPageToken: undefined,
  });
  mocks.tagRuleFindMany.mockResolvedValue([]);
  mocks.billingEntryStagingFindMany.mockResolvedValue([]);
  mocks.billingEntryCreateMany.mockResolvedValue({});
  mocks.billingEntryStagingDeleteMany.mockResolvedValue({});
  mocks.dbExecuteRaw.mockResolvedValue(1);
  mocks.dbTransaction.mockResolvedValue([1, 1]);
  mocks.billingSyncCursorUpsert.mockResolvedValue({});
  mocks.billingSyncRunUpdate.mockResolvedValue({});
  mocks.integrationUpdate.mockResolvedValue({});
  mocks.inngestSend.mockResolvedValue(undefined);
  mocks.resolveMapping.mockReturnValue({
    themeId: null,
    mappingRuleId: null,
    mappingConf: "UNMAPPED",
  });
  mocks.billingEntryStagingCreateMany.mockResolvedValue({});
});

describe("billingSyncFunction registration", () => {
  it("registers with id billing-sync", () => {
    expect(capturedConfig.id).toBe("billing-sync");
  });

  it("listens to billing/sync.requested", () => {
    expect(capturedConfig.triggers[0].event).toBe("billing/sync.requested");
  });
});

describe("handler — happy path (no cursor)", () => {
  it("returns success with entriesProcessed=0 when no staged rows", async () => {
    const result = await capturedHandler({
      event: baseEvent,
      step: makeStep(),
    });
    expect(result).toEqual({ success: true, entriesProcessed: 0 });
  });

  it("creates a sync run in load-cursor step", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });
    expect(mocks.billingSyncRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RUNNING" }),
      })
    );
  });

  it("emits billing/snapshot.updated downstream event", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });
    expect(mocks.inngestSend).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "billing/snapshot.updated" }),
      ])
    );
  });
});

describe("handler — cursor-based startDate", () => {
  it("uses lastIngestedThrough - lookbackDays when cursor exists", async () => {
    const lastIngestedThrough = new Date("2026-05-20T00:00:00Z");
    mocks.billingSyncCursorFindUnique.mockResolvedValue({
      lastIngestedThrough,
      lookbackDays: 7,
    });

    await capturedHandler({ event: baseEvent, step: makeStep() });

    // fetchAwsPage should be called with startDate = 2026-05-13
    expect(mocks.fetchAwsPage).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: "2026-05-13" })
    );
  });
});

describe("handler — staging entries", () => {
  it("calls billingEntryStaging.createMany when fetchAwsPage returns entries", async () => {
    mocks.fetchAwsPage.mockResolvedValue({
      entries: [
        { provider: "AWS", accountId: "123", service: "EC2" },
        { provider: "AWS", accountId: "123", service: "S3" },
      ],
      nextPageToken: undefined,
    });

    await capturedHandler({ event: baseEvent, step: makeStep() });
    expect(mocks.billingEntryStagingCreateMany).toHaveBeenCalled();
    const [[call]] = mocks.billingEntryStagingCreateMany.mock.calls as [
      [{ data: unknown[] }],
    ];
    expect(call.data).toHaveLength(2);
  });

  it("skips createMany when fetchAwsPage returns empty entries", async () => {
    mocks.fetchAwsPage.mockResolvedValue({
      entries: [],
      nextPageToken: undefined,
    });
    await capturedHandler({ event: baseEvent, step: makeStep() });
    expect(mocks.billingEntryStagingCreateMany).not.toHaveBeenCalled();
  });
});

describe("handler — multi-page fetch", () => {
  it("fetches second page when nextToken returned", async () => {
    mocks.fetchAwsPage
      .mockResolvedValueOnce({ entries: [], nextPageToken: "token-1" })
      .mockResolvedValueOnce({ entries: [], nextPageToken: undefined });

    await capturedHandler({ event: baseEvent, step: makeStep() });
    expect(mocks.fetchAwsPage).toHaveBeenCalledTimes(2);
    expect(mocks.fetchAwsPage.mock.calls[1][0]).toMatchObject({
      nextPageToken: "token-1",
    });
  });
});

describe("handler — promote entries", () => {
  it("calls billingEntry.createMany and deletes staged rows", async () => {
    mocks.billingEntryStagingFindMany.mockResolvedValue([
      makeStagedRow({
        provider: "AWS",
        accountId: "123",
        externalId: "ext-1",
        service: "EC2",
        chargeCategory: "Usage",
        billedCost: "10",
        effectiveCost: "10",
        listCost: "10",
        unblendedAmount: "10",
        amortizedAmount: "10",
        usageStartDate: "2026-05-01",
        usageEndDate: "2026-05-02",
        currency: "USD",
        tenantCurrency: "USD",
        tenantAmount: "10",
        tags: {},
      }),
    ]);

    await capturedHandler({ event: baseEvent, step: makeStep() });
    expect(mocks.billingEntryCreateMany).toHaveBeenCalled();
    expect(mocks.billingEntryStagingDeleteMany).toHaveBeenCalled();
  });

  it("batches 501 staged rows into 2 createMany calls", async () => {
    const staged = Array.from({ length: 501 }, (_, i) =>
      makeStagedRow({
        provider: "AWS",
        accountId: "123",
        externalId: `ext-${i}`,
        service: "EC2",
        chargeCategory: "Usage",
        billedCost: "1",
        effectiveCost: "1",
        listCost: "1",
        unblendedAmount: "1",
        amortizedAmount: "1",
        usageStartDate: "2026-05-01",
        usageEndDate: "2026-05-02",
        currency: "USD",
        tenantCurrency: "USD",
        tenantAmount: "1",
        tags: {},
      })
    );
    mocks.billingEntryStagingFindMany.mockResolvedValue(staged);

    await capturedHandler({ event: baseEvent, step: makeStep() });
    expect(mocks.billingEntryCreateMany).toHaveBeenCalledTimes(2);
  });
});

describe("handler — extractCostFields defaults", () => {
  it("defaults all cost fields to '0' when payload is missing them", async () => {
    mocks.billingEntryStagingFindMany.mockResolvedValue([
      makeStagedRow({
        usageStartDate: "2026-05-01",
        usageEndDate: "2026-05-02",
        tags: {},
      }),
    ]);

    await capturedHandler({ event: baseEvent, step: makeStep() });

    const [[call]] = mocks.billingEntryCreateMany.mock.calls as [
      [{ data: Record<string, unknown>[] }],
    ];
    const entry = call.data[0];
    expect(entry.billedCost).toBe("0");
    expect(entry.effectiveCost).toBe("0");
    expect(entry.amortizedAmount).toBe("0");
    expect(entry.usageQuantity).toBeNull();
    expect(entry.usageUnit).toBeNull();
    expect(entry.currency).toBe("USD");
  });

  it("maps cost fields from payload when present", async () => {
    mocks.billingEntryStagingFindMany.mockResolvedValue([
      makeStagedRow({
        billedCost: "25.50",
        effectiveCost: "24.00",
        listCost: "26.00",
        unblendedAmount: "25.50",
        amortizedAmount: "24.00",
        usageQuantity: "500",
        usageUnit: "GB",
        currency: "EUR",
        tenantCurrency: "USD",
        tenantAmount: "24.00",
        usageStartDate: "2026-05-01",
        usageEndDate: "2026-05-02",
        tags: {},
      }),
    ]);

    await capturedHandler({ event: baseEvent, step: makeStep() });

    const [[call]] = mocks.billingEntryCreateMany.mock.calls as [
      [{ data: Record<string, unknown>[] }],
    ];
    const entry = call.data[0];
    expect(entry.billedCost).toBe("25.50");
    expect(entry.usageQuantity).toBe("500");
    expect(entry.usageUnit).toBe("GB");
    expect(entry.currency).toBe("EUR");
  });
});

// NEB-185 defeito 2 — o INSERT do CostSnapshot agrupava só por (tenantId,
// themeId, dia) e gravava NULL literal nas posições artId/epicId: todo o
// custo de um tema num dia caía numa única linha, sem quebra por épico/ART,
// mesmo a constraint única já suportando essa granularidade.
// Strips `-- ...` SQL comment lines so assertions target real SQL tokens,
// not prose in the explanatory comments living inside the template literal.
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

function findAggregateSnapshotsCall(marker: string) {
  const call = mocks.dbExecuteRaw.mock.calls.find(([strings]) =>
    (strings as unknown as string[]).join("").includes(marker)
  );
  if (!call) {
    throw new Error(
      `aggregate-snapshots $executeRaw call not found (${marker})`
    );
  }
  const [strings] = call as [TemplateStringsArray];
  return stripSqlComments(Array.from(strings).join("§"));
}

function findAggregateInsertCall() {
  return findAggregateSnapshotsCall('INSERT INTO "CostSnapshot"');
}

function findAggregateDeleteCall() {
  return findAggregateSnapshotsCall('DELETE FROM "CostSnapshot"');
}

describe("handler — aggregate-snapshots SQL groups by epic/ART", () => {
  it("selects be.artId and be.epicId instead of literal NULL", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    const sql = findAggregateInsertCall();
    expect(sql).toContain('be."artId"');
    expect(sql).toContain('be."epicId"');
  });

  it("groups by themeId, artId and epicId (not just themeId) so each entry lands in exactly one group", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    const sql = findAggregateInsertCall();
    const groupByClause = sql.split("GROUP BY")[1] ?? "";
    expect(groupByClause).toContain('be."themeId"');
    expect(groupByClause).toContain('be."artId"');
    expect(groupByClause).toContain('be."epicId"');
  });

  it("keeps okrId as literal NULL — no OKR resolution exists in the pipeline", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    const sql = findAggregateInsertCall();
    const selectClause = sql.split("SELECT")[1]?.split("FROM")[0] ?? "";
    // themeId, artId, epicId are all column refs now; okrId is the sole
    // remaining literal NULL in the SELECT list.
    expect((selectClause.match(/NULL/g) ?? []).length).toBe(1);
  });
});

// NEB-186 — DELETE+INSERT dentro de uma transação substituiu o
// INSERT ... ON CONFLICT DO UPDATE. Estes testes cobrem só a FORMA da SQL
// (string do template) — não provam que o dinheiro soma certo. A prova real
// está em __tests__/finops/cost-snapshot-aggregation.test.ts, contra um
// Postgres de verdade (gated por RUN_DB_TESTS).
describe("handler — aggregate-snapshots is a DELETE+INSERT transaction", () => {
  it("wraps DELETE and INSERT in a single $transaction call", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    expect(mocks.dbTransaction).toHaveBeenCalledTimes(1);
    const [statements] = mocks.dbTransaction.mock.calls[0] as [unknown[]];
    expect(statements).toHaveLength(2);
  });

  it("no longer uses ON CONFLICT — DELETE clears the range before INSERT", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    const sql = findAggregateInsertCall();
    expect(sql).not.toContain("ON CONFLICT");
  });

  it("DELETE scopes by tenantId, granularity and period range — no integrationId (CostSnapshot has no such column)", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    const sql = findAggregateDeleteCall();
    expect(sql).toContain('"tenantId"');
    expect(sql).toContain("granularity = 'DAILY'");
    expect(sql).toContain("period >=");
    expect(sql).toContain("period <");
    expect(sql).not.toContain("integrationId");
  });

  it("INSERT aggregates the whole tenant, not just the integration that triggered this sync (no integrationId filter)", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    const sql = findAggregateInsertCall();
    const whereClause = sql.split("WHERE")[1]?.split("GROUP BY")[0] ?? "";
    expect(whereClause).not.toContain("integrationId");
  });
});

describe("handler — advance cursor", () => {
  it("upserts cursor and updates syncRun to SUCCESS", async () => {
    await capturedHandler({ event: baseEvent, step: makeStep() });

    expect(mocks.billingSyncCursorUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { integrationId: "integ-1" } })
    );
    expect(mocks.billingSyncRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "SUCCESS" }),
      })
    );
    expect(mocks.integrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "integ-1" } })
    );
  });
});

describe("handler — resolveMapping", () => {
  it("applies tag rules to staged row entries", async () => {
    mocks.tagRuleFindMany.mockResolvedValue([
      {
        id: "rule-1",
        matchType: "TAG_KEY_VALUE",
        tagKey: "CostCenter",
        tagValue: "Eng",
        themeId: "theme-1",
        artId: null,
        epicId: null,
        priority: 1,
        enabled: true,
      },
    ]);
    mocks.resolveMapping.mockReturnValue({
      themeId: "theme-1",
      mappingRuleId: "rule-1",
      mappingConf: "MAPPED",
    });
    mocks.billingEntryStagingFindMany.mockResolvedValue([
      makeStagedRow({
        usageStartDate: "2026-05-01",
        usageEndDate: "2026-05-02",
        tags: { CostCenter: "Eng" },
      }),
    ]);

    await capturedHandler({ event: baseEvent, step: makeStep() });

    expect(mocks.resolveMapping).toHaveBeenCalled();
    const [[call]] = mocks.billingEntryCreateMany.mock.calls as [
      [{ data: Record<string, unknown>[] }],
    ];
    expect(call.data[0].themeId).toBe("theme-1");
    expect(call.data[0].mappingConf).toBe("MAPPED");
  });

  // NEB-185 defeito 1 — resolveMapping já calcula epicId e artId junto com
  // themeId (tag-rule-engine.ts), mas mapStagedRowToEntry só copiava themeId
  // para o insert: o custo por épico/ART era calculado e descartado.
  it("persists epicId and artId returned by resolveMapping onto the BillingEntry insert", async () => {
    mocks.resolveMapping.mockReturnValue({
      themeId: "theme-1",
      artId: "art-1",
      epicId: "epic-1",
      mappingRuleId: "rule-1",
      mappingConf: "MAPPED",
    });
    mocks.billingEntryStagingFindMany.mockResolvedValue([
      makeStagedRow({
        usageStartDate: "2026-05-01",
        usageEndDate: "2026-05-02",
        tags: { CostCenter: "Eng" },
      }),
    ]);

    await capturedHandler({ event: baseEvent, step: makeStep() });

    const [[call]] = mocks.billingEntryCreateMany.mock.calls as [
      [{ data: Record<string, unknown>[] }],
    ];
    expect(call.data[0].epicId).toBe("epic-1");
    expect(call.data[0].artId).toBe("art-1");
  });
});
