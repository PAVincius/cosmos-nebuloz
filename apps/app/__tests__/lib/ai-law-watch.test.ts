import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  fetchBrazilAiLaws: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: mocks.createFunction,
  },
}));

vi.mock("@repo/database", () => ({
  database: {
    aiLawWatchRecord: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/ai-law-tracker/client", () => ({
  fetchBrazilAiLaws: mocks.fetchBrazilAiLaws,
}));

import "@/lib/inngest/ai-law-watch";

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

const baseEvent = { data: {} };

function apiLaw(overrides: Record<string, unknown> = {}) {
  return {
    identifier: "br-lei-1",
    title: "Marco Legal da IA",
    recordType: "lei",
    inForce: true,
    officialUrl: "https://exemplo.gov.br/lei-1",
    ...overrides,
  };
}

const ORIGINAL_ENV = process.env.AI_LAW_TRACKER_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_LAW_TRACKER_API_KEY = "test-key";
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "row-1" });
  mocks.update.mockResolvedValue({ id: "row-1" });
});

afterEach(() => {
  // "" e não delete: mesmo idioma de __tests__/rbac/rbac.test.ts para
  // representar env var não configurada sem o operador delete.
  process.env.AI_LAW_TRACKER_API_KEY = ORIGINAL_ENV ?? "";
});

describe("aiLawWatchFunction registration", () => {
  it("registra com o evento ai-law/watch.requested", () => {
    expect(capturedConfig.triggers[0].event).toBe("ai-law/watch.requested");
  });
});

describe("variável de ambiente ausente", () => {
  it("lança erro claro e não faz nenhuma chamada de rede", async () => {
    process.env.AI_LAW_TRACKER_API_KEY = "";
    mocks.fetchBrazilAiLaws.mockResolvedValue([]);

    await expect(
      capturedHandler({ event: baseEvent, step: makeStep() })
    ).rejects.toThrow(/AI_LAW_TRACKER_API_KEY/);

    expect(mocks.fetchBrazilAiLaws).not.toHaveBeenCalled();
  });
});

describe("primeira rodada — todos novos", () => {
  it("3 registros novos viram 3 creates e todos entram em novos", async () => {
    mocks.fetchBrazilAiLaws.mockResolvedValue([
      apiLaw({ identifier: "br-lei-1" }),
      apiLaw({ identifier: "br-lei-2" }),
      apiLaw({ identifier: "br-lei-3" }),
    ]);
    mocks.findUnique.mockResolvedValue(null);

    const result = await capturedHandler({
      event: baseEvent,
      step: makeStep(),
    });

    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      total: 3,
      novos: ["br-lei-1", "br-lei-2", "br-lei-3"],
      novos_count: 3,
    });
  });
});

describe("segunda rodada — só o novo conta como novo", () => {
  it("3 antigos + 1 novo: só 1 novo, antigos não re-disparam como novo", async () => {
    mocks.fetchBrazilAiLaws.mockResolvedValue([
      apiLaw({ identifier: "br-lei-1" }),
      apiLaw({ identifier: "br-lei-2" }),
      apiLaw({ identifier: "br-lei-3" }),
      apiLaw({ identifier: "br-lei-4" }),
    ]);
    mocks.findUnique.mockImplementation(
      ({
        where,
      }: {
        where: {
          tenantId_source_jurisdiction_identifier: { identifier: string };
        };
      }) => {
        const { identifier } = where.tenantId_source_jurisdiction_identifier;
        if (["br-lei-1", "br-lei-2", "br-lei-3"].includes(identifier)) {
          return Promise.resolve({ id: `row-${identifier}` });
        }
        return Promise.resolve(null);
      }
    );

    const result = await capturedHandler({
      event: baseEvent,
      step: makeStep(),
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      total: 4,
      novos: ["br-lei-4"],
      novos_count: 1,
    });
  });

  it("registro existente que voltou com título diferente é atualizado mas não conta como novo", async () => {
    mocks.fetchBrazilAiLaws.mockResolvedValue([
      apiLaw({ identifier: "br-lei-1", title: "Título Atualizado" }),
    ]);
    mocks.findUnique.mockResolvedValue({ id: "row-1" });

    const result = await capturedHandler({
      event: baseEvent,
      step: makeStep(),
    });

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-1" },
        data: expect.objectContaining({ title: "Título Atualizado" }),
      })
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 1, novos: [], novos_count: 0 });
  });
});
