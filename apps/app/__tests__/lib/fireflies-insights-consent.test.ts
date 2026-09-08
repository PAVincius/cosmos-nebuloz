// @vitest-environment node
//
// Defense-in-depth consent gate inside the mapper consumer itself
// (docs/compliance/consentimento-de-gravacao.md §7.2 — "portão que só existe
// em um caminho não é portão"). Even if `integration/fireflies.transcript.ready`
// were ever sent from somewhere other than the ingest gate, this consumer
// must refuse to call the LLM for anything that isn't GRANTED.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  transcriptFindFirst: vi.fn(),
  pIPlanFindFirst: vi.fn(),
  insightCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
  transcriptUpdate: vi.fn().mockResolvedValue({}),
  generateObject: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: mocks.createFunction },
}));

vi.mock("@repo/database", () => ({
  database: {
    meetingTranscript: {
      findFirst: mocks.transcriptFindFirst,
      update: mocks.transcriptUpdate,
    },
    meetingInsight: { createMany: mocks.insightCreateMany },
    pIPlan: { findFirst: mocks.pIPlanFindFirst },
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), info: vi.fn() },
}));

// If the gate fails, this is what would run — asserting it's never called is
// the point of the "reaches an LLM provider" check.
vi.mock("ai", () => ({ generateObject: mocks.generateObject }));
vi.mock("@repo/ai/lib/router", () => ({
  getActiveProvider: () => "openai",
  getAIModel: () => ({}),
}));

import "@/lib/inngest/fireflies-insights";

type StepCtx = {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
};
type HandlerFn = (ctx: { event: unknown; step: StepCtx }) => Promise<unknown>;

let handler: HandlerFn;

beforeAll(() => {
  const [[, fn]] = mocks.createFunction.mock.calls as [[unknown, HandlerFn]];
  handler = fn;
});

function makeStep(): StepCtx {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
  };
}

const baseEvent = { data: { tenantId: "t1", transcriptId: "tx1" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fireflies-insights consent gate", () => {
  it("PENDING transcript → skipped, never calls the LLM, never persists insights", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx1",
      rawSummary: { overview: "sensitive speech content" },
      status: "RECEIVED",
      consentState: "PENDING",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      skipped?: boolean;
      reason?: string;
    };

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("consent not granted");
    expect(mocks.generateObject).not.toHaveBeenCalled();
    expect(mocks.insightCreateMany).not.toHaveBeenCalled();
    expect(mocks.transcriptUpdate).not.toHaveBeenCalled();
  });

  it("DENIED transcript → skipped, never calls the LLM", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx1",
      rawSummary: { overview: "x" },
      status: "RECEIVED",
      consentState: "DENIED",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      skipped?: boolean;
    };

    expect(result.skipped).toBe(true);
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it("REVOKED transcript → skipped, never calls the LLM", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx1",
      rawSummary: null,
      status: "RECEIVED",
      consentState: "REVOKED",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      skipped?: boolean;
    };

    expect(result.skipped).toBe(true);
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  it("GRANTED transcript → proceeds past the gate (LLM path attempted)", async () => {
    mocks.transcriptFindFirst.mockResolvedValue({
      id: "tx1",
      rawSummary: { overview: "ok", actionItems: null, outline: null },
      status: "RECEIVED",
      consentState: "GRANTED",
    });
    mocks.generateObject.mockRejectedValue(new Error("router unavailable"));
    mocks.pIPlanFindFirst.mockResolvedValue(null);

    await handler({ event: baseEvent, step: makeStep() });

    // classifyInsights was reached (it tried — and fell back on failure,
    // which is the pre-existing, out-of-scope behavior of this function).
    expect(mocks.generateObject).toHaveBeenCalled();
  });
});
