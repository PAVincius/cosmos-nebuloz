// @vitest-environment node
//
// Consent gate on the Fireflies ingest pipeline
// (docs/compliance/consentimento-de-gravacao.md §7, passo 2). Captures the
// real inngest handler the same way linear-webhook-consumer.test.ts does —
// mock `inngest.createFunction`, grab the registered handler, invoke it with
// a fake `step`/`event`.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  send: vi.fn().mockResolvedValue(undefined),
  integrationFindFirst: vi.fn(),
  transcriptUpsert: vi.fn(),
  participantCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
  fetchFirefliesTranscript: vi.fn().mockResolvedValue({ id: "m1" }),
  decryptConfigSecrets: vi.fn((c: Record<string, unknown>) => c),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: mocks.createFunction, send: mocks.send },
}));

vi.mock("@repo/database", () => ({
  database: {
    meetingIntegration: { findFirst: mocks.integrationFindFirst },
    meetingTranscript: { upsert: mocks.transcriptUpsert },
    meetingParticipant: { createMany: mocks.participantCreateMany },
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), info: vi.fn() },
}));

vi.mock("@repo/security/encrypt", () => ({
  decryptConfigSecrets: mocks.decryptConfigSecrets,
}));

// normalizeFirefliesParticipants is kept real (pure function, already unit
// tested in fireflies-normalize-participants.test.ts) — tests below drive it
// through the `participants`/`workspace_users` fields on the fetched
// transcript, exactly like the real pipeline would.
vi.mock("@/lib/inngest/fireflies-normalize", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/inngest/fireflies-normalize")
  >("@/lib/inngest/fireflies-normalize");
  return {
    ...actual,
    fetchFirefliesTranscript: mocks.fetchFirefliesTranscript,
    normalizeFirefliesSummary: () => ({
      title: "Sprint Review",
      rawSummary: {
        overview: "ok",
        actionItems: null,
        keywords: [],
        outline: null,
      },
    }),
  };
});

import "@/lib/inngest/fireflies-transcript";

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
  mocks.fetchFirefliesTranscript.mockResolvedValue({ id: "m1" });
  mocks.decryptConfigSecrets.mockImplementation(
    (c: Record<string, unknown>) => c
  );
});

describe("fireflies-transcript consent gate", () => {
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

    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({ consentState: "GRANTED" }),
      })
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("consent not granted");
  });

  it("STANDING + standingConsentRef + known no external participant → transcript created GRANTED, mapper IS enqueued", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "int1",
      status: "ACTIVE",
      config: { apiKey: "k" },
      consentMode: "STANDING",
      standingConsentRef: "policy-doc-42",
    });
    // Both fields present and every participant is a workspace user — this
    // is the "sabemos que não há externo" case from §4/§7.
    mocks.fetchFirefliesTranscript.mockResolvedValue({
      id: "m1",
      participants: ["rte@nebuloz.ai"],
      workspace_users: ["rte@nebuloz.ai"],
      organizer_email: "rte@nebuloz.ai",
    });
    mocks.transcriptUpsert.mockResolvedValue({
      id: "tx1",
      consentState: "GRANTED",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      ok?: boolean;
      transcriptId?: string;
    };

    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          consentState: "GRANTED",
          consentGrantedRef: "policy-doc-42",
          consentGrantedAt: expect.any(Date),
          participantsKnown: true,
        }),
      })
    );
    expect(mocks.send).toHaveBeenCalledWith({
      name: "integration/fireflies.transcript.ready",
      data: { tenantId: "t1", transcriptId: "tx1" },
    });
    expect(result.ok).toBe(true);
  });

  it("STANDING + standingConsentRef + known EXTERNAL participant → stays PENDING, mapper NOT enqueued", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "int1",
      status: "ACTIVE",
      config: { apiKey: "k" },
      consentMode: "STANDING",
      standingConsentRef: "policy-doc-42",
    });
    mocks.fetchFirefliesTranscript.mockResolvedValue({
      id: "m1",
      participants: ["rte@nebuloz.ai", "guest@totvs.com"],
      workspace_users: ["rte@nebuloz.ai"],
    });
    mocks.transcriptUpsert.mockResolvedValue({
      id: "tx1",
      consentState: "PENDING",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      skipped?: boolean;
      reason?: string;
    };

    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ participantsKnown: true }),
      })
    );
    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({ consentState: "GRANTED" }),
      })
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("consent not granted");
  });

  it("STANDING + standingConsentRef + provider did NOT return participant fields → unknown, stays PENDING (fail closed)", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "int1",
      status: "ACTIVE",
      config: { apiKey: "k" },
      consentMode: "STANDING",
      standingConsentRef: "policy-doc-42",
    });
    // No `participants`/`workspace_users` at all — plan doesn't expose them,
    // or a partial response. This must NOT be read as "no external".
    mocks.fetchFirefliesTranscript.mockResolvedValue({ id: "m1" });
    mocks.transcriptUpsert.mockResolvedValue({
      id: "tx1",
      consentState: "PENDING",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      skipped?: boolean;
    };

    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          participantsKnown: false,
        }),
      })
    );
    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({ consentState: "GRANTED" }),
      })
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
  });

  it("persists MeetingParticipant rows alongside the transcript", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "int1",
      status: "ACTIVE",
      config: { apiKey: "k" },
      consentMode: "PER_MEETING",
      standingConsentRef: null,
    });
    mocks.fetchFirefliesTranscript.mockResolvedValue({
      id: "m1",
      participants: ["rte@nebuloz.ai", "guest@totvs.com"],
      workspace_users: ["rte@nebuloz.ai"],
      meeting_attendees: [
        { email: "guest@totvs.com", displayName: "Guest Person" },
      ],
      organizer_email: "rte@nebuloz.ai",
    });
    mocks.transcriptUpsert.mockResolvedValue({
      id: "tx1",
      consentState: "PENDING",
    });

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.participantCreateMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: "t1",
          transcriptId: "tx1",
          email: "rte@nebuloz.ai",
          name: null,
          isOrganizer: true,
          isExternal: false,
        },
        {
          tenantId: "t1",
          transcriptId: "tx1",
          email: "guest@totvs.com",
          name: "Guest Person",
          isOrganizer: false,
          isExternal: true,
        },
      ],
      skipDuplicates: true,
    });
  });

  it("STANDING without standingConsentRef → treated as not standing, stays PENDING", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "int1",
      status: "ACTIVE",
      config: { apiKey: "k" },
      consentMode: "STANDING",
      standingConsentRef: null,
    });
    mocks.transcriptUpsert.mockResolvedValue({
      id: "tx1",
      consentState: "PENDING",
    });

    await handler({ event: baseEvent, step: makeStep() });

    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({ consentState: "GRANTED" }),
      })
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("retry (upsert update path) never re-stamps consent — update payload has no consent fields", async () => {
    mocks.integrationFindFirst.mockResolvedValue({
      id: "int1",
      status: "ACTIVE",
      config: { apiKey: "k" },
      consentMode: "STANDING",
      standingConsentRef: "policy-doc-42",
    });
    // Simulates an already-REVOKED row surviving a webhook retry.
    mocks.transcriptUpsert.mockResolvedValue({
      id: "tx1",
      consentState: "REVOKED",
    });

    const result = (await handler({ event: baseEvent, step: makeStep() })) as {
      skipped?: boolean;
    };

    expect(mocks.transcriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          title: "Sprint Review",
          rawSummary: {
            overview: "ok",
            actionItems: null,
            keywords: [],
            outline: null,
          },
        },
      })
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
  });
});
