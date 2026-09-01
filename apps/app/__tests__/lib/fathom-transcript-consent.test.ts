// @vitest-environment node
//
// Same consent gate as fireflies-transcript-consent.test.ts, applied to the
// Fathom path — docs/compliance/consentimento-de-gravacao.md §7 explicitly
// requires "mesmo portão no caminho do Fathom".

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  send: vi.fn().mockResolvedValue(undefined),
  integrationFindFirst: vi.fn(),
  transcriptUpsert: vi.fn(),
  fetchTranscript: vi.fn().mockResolvedValue({ id: "m1" }),
  normalizeSummary: vi.fn(() => ({
    title: "PI Sync",
    rawSummary: {
      overview: "ok",
      actionItems: null,
      keywords: [],
      outline: null,
    },
  })),
  decryptConfigSecrets: vi.fn((c: Record<string, unknown>) => c),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: mocks.createFunction, send: mocks.send },
}));

vi.mock("@repo/database", () => ({
  database: {
    meetingIntegration: { findFirst: mocks.integrationFindFirst },
    meetingTranscript: { upsert: mocks.transcriptUpsert },
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), info: vi.fn() },
}));

vi.mock("@repo/security/encrypt", () => ({
  decryptConfigSecrets: mocks.decryptConfigSecrets,
}));

vi.mock("@/lib/meeting/providers/fathom", () => ({
  FathomAdapter: class {
    fetchTranscript = mocks.fetchTranscript;
    normalizeSummary = mocks.normalizeSummary;
  },
}));

import "@/lib/inngest/fathom-transcript";

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

const baseEvent = {
  data: { tenantId: "t1", integrationId: "int1", meetingId: "m1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchTranscript.mockResolvedValue({ id: "m1" });
  mocks.decryptConfigSecrets.mockImplementation(
    (c: Record<string, unknown>) => c
  );
});

describe("fathom-transcript consent gate", () => {
  it("PER_MEETING (default) → transcript stays PENDING, mapper NOT enqueued", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "int1",
      status: "ACTIVE",
      config: { apiKey: "k" },
      consentMode: "PER_MEETING",
      standingConsentRef: null,
    });
    mocks.transcriptUpsert.mockResolvedValue({
      id: "tx1",
      consentState: "PENDING",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      skipped?: boolean;
      reason?: string;
    };

    expect(mocks.send).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("consent not granted");
  });

  it("STANDING with standingConsentRef → transcript created GRANTED, mapper IS enqueued", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "int1",
      status: "ACTIVE",
      config: { apiKey: "k" },
      consentMode: "STANDING",
      standingConsentRef: "policy-doc-42",
    });
    mocks.transcriptUpsert.mockResolvedValue({
      id: "tx1",
      consentState: "GRANTED",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      ok?: boolean;
    };

    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          consentState: "GRANTED",
          consentGrantedRef: "policy-doc-42",
          consentGrantedAt: expect.any(Date),
        }),
      })
    );
    expect(mocks.send).toHaveBeenCalledWith({
      name: "integration/fireflies.transcript.ready",
      data: { tenantId: "t1", transcriptId: "tx1" },
    });
    expect(result.ok).toBe(true);
  });
});
