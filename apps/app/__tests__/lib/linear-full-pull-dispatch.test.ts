// linear-full-pull-dispatch.test.ts — COS-90: cron de reconciliação que
// dispara triggerLinearFullPull por integração Linear ativa. Backfill que
// corrige perda de webhook (triggerLinearFullPull não tinha chamador
// nenhum antes desta issue).
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  integrationFindMany: vi.fn(),
  decryptConfigSecrets: vi.fn(),
  triggerLinearFullPull: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: mocks.createFunction },
}));

vi.mock("@repo/database", () => ({
  database: { integration: { findMany: mocks.integrationFindMany } },
}));

vi.mock("@repo/security/encrypt", () => ({
  decryptConfigSecrets: mocks.decryptConfigSecrets,
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: mocks.logError, warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/app/actions/integrations/sync/linear-full-pull", () => ({
  triggerLinearFullPull: mocks.triggerLinearFullPull,
}));

import { dispatchLinearFullPull } from "@/lib/inngest/linear-full-pull-dispatch";

type StepCtx = {
  run: <T>(name: string, fn: () => T | Promise<T>) => Promise<T>;
};

function makeStep(): StepCtx {
  return {
    run: vi.fn((_name: string, fn) => Promise.resolve(fn())),
  };
}

// A chamada a createFunction acontece no top-level do módulo, no import
// acima — captura antes do primeiro vi.clearAllMocks() do beforeEach apagar
// o histórico (mesmo cuidado de __tests__/lib/billing-sync.test.ts).
let capturedConfig: { id: string; triggers: { cron: string }[] };

beforeAll(() => {
  const [[config]] = mocks.createFunction.mock.calls as [
    [{ id: string; triggers: { cron: string }[] }],
  ];
  capturedConfig = config;
});

beforeEach(() => {
  vi.clearAllMocks();
  // Passa o config adiante sem alterar — os testes deste arquivo não
  // exercitam a criptografia em si (packages/security tem os próprios).
  mocks.decryptConfigSecrets.mockImplementation(
    (c: Record<string, unknown>) => c
  );
  mocks.triggerLinearFullPull.mockResolvedValue({
    itemsProcessed: 0,
    cursor: null,
    complete: true,
  });
});

describe("linearFullPullDispatch registration", () => {
  it("registra com id linear-full-pull-dispatch e cron a cada 6h", () => {
    expect(capturedConfig.id).toBe("linear-full-pull-dispatch");
    expect(capturedConfig.triggers[0]?.cron).toBe("0 */6 * * *");
  });
});

describe("dispatchLinearFullPull", () => {
  it("consulta só integrations Linear ativas", async () => {
    mocks.integrationFindMany.mockResolvedValue([]);

    await dispatchLinearFullPull({ step: makeStep() });

    expect(mocks.integrationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "linear", status: "ACTIVE" },
      })
    );
  });

  it("dispara triggerLinearFullPull para cada integration ativa, com teamId e apiKey do mapping/config", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "integ-1",
        tenantId: "t1",
        config: { apiKey: "key-1" },
        mapping: { projectId: "team-1" },
      },
      {
        id: "integ-2",
        tenantId: "t2",
        config: { apiKey: "key-2" },
        mapping: { projectId: "team-2", linearProjectId: "proj-2" },
      },
    ]);

    const result = await dispatchLinearFullPull({ step: makeStep() });

    expect(mocks.triggerLinearFullPull).toHaveBeenCalledTimes(2);
    expect(mocks.triggerLinearFullPull).toHaveBeenCalledWith({
      tenantId: "t1",
      integrationId: "integ-1",
      teamId: "team-1",
      apiKey: "key-1",
    });
    expect(mocks.triggerLinearFullPull).toHaveBeenCalledWith({
      tenantId: "t2",
      integrationId: "integ-2",
      teamId: "team-2",
      apiKey: "key-2",
      linearProjectId: "proj-2",
    });
    expect(result).toEqual({ examinadas: 2, disparadas: 2 });
  });

  it("não passa resumeCursor — cada rodada varre o time inteiro, não retoma de onde parou", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "integ-1",
        tenantId: "t1",
        config: { apiKey: "key-1" },
        mapping: { projectId: "team-1" },
      },
    ]);

    await dispatchLinearFullPull({ step: makeStep() });

    const call = mocks.triggerLinearFullPull.mock.calls[0][0];
    expect(call.resumeCursor).toBeUndefined();
  });

  it("pula integration sem time mapeado, sem travar as demais", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "integ-1",
        tenantId: "t1",
        config: { apiKey: "key-1" },
        mapping: null,
      },
      {
        id: "integ-2",
        tenantId: "t2",
        config: { apiKey: "key-2" },
        mapping: { projectId: "team-2" },
      },
    ]);

    const result = await dispatchLinearFullPull({ step: makeStep() });

    expect(mocks.triggerLinearFullPull).toHaveBeenCalledTimes(1);
    expect(mocks.triggerLinearFullPull).toHaveBeenCalledWith(
      expect.objectContaining({ integrationId: "integ-2" })
    );
    expect(result).toEqual({ examinadas: 2, disparadas: 1 });
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining("sem time mapeado"),
      expect.objectContaining({ integrationId: "integ-1" })
    );
  });

  it("pula integration sem apiKey decriptável", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "integ-1",
        tenantId: "t1",
        config: {},
        mapping: { projectId: "team-1" },
      },
    ]);

    const result = await dispatchLinearFullPull({ step: makeStep() });

    expect(mocks.triggerLinearFullPull).not.toHaveBeenCalled();
    expect(result.disparadas).toBe(0);
  });

  it("isola falha de uma integration — as demais continuam disparando", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "integ-1",
        tenantId: "t1",
        config: { apiKey: "key-1" },
        mapping: { projectId: "team-1" },
      },
      {
        id: "integ-2",
        tenantId: "t2",
        config: { apiKey: "key-2" },
        mapping: { projectId: "team-2" },
      },
    ]);
    mocks.triggerLinearFullPull
      .mockRejectedValueOnce(new Error("Linear API fora do ar"))
      .mockResolvedValueOnce({
        itemsProcessed: 1,
        cursor: null,
        complete: true,
      });

    const result = await dispatchLinearFullPull({ step: makeStep() });

    expect(mocks.triggerLinearFullPull).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ examinadas: 2, disparadas: 1 });
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.stringContaining("full pull falhou"),
      expect.objectContaining({ integrationId: "integ-1" })
    );
  });
});
