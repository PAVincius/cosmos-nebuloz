import { beforeEach, describe, expect, it, vi } from "vitest";

const { MockAuthError, mocks } = vi.hoisted(() => {
  class MockAuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  }

  const mocks = {
    headers: vi.fn(),
    requireTenantSession: vi.fn(),
    riskFindMany: vi.fn(),
    riskFindFirst: vi.fn(),
    piObjectiveFindMany: vi.fn(),
    piObjectiveFindFirst: vi.fn(),
    featureFindMany: vi.fn(),
    featureFindFirst: vi.fn(),
    epicFindMany: vi.fn(),
    epicFindFirst: vi.fn(),
    okrFindMany: vi.fn(),
    upsertKnowledgeChunk: vi.fn(),
    embedMany: vi.fn(),
    embed: vi.fn(),
    sanitizeForPrompt: vi.fn((s: string) => s),
    chunkText: vi.fn(),
  };

  return { MockAuthError, mocks };
});

const tenantCtx = {
  tenantId: "tenant-test",
  userId: "user-test",
  role: "PO" as const,
};

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    risk: { findMany: mocks.riskFindMany, findFirst: mocks.riskFindFirst },
    pIObjective: {
      findMany: mocks.piObjectiveFindMany,
      findFirst: mocks.piObjectiveFindFirst,
    },
    feature: {
      findMany: mocks.featureFindMany,
      findFirst: mocks.featureFindFirst,
    },
    epic: { findMany: mocks.epicFindMany, findFirst: mocks.epicFindFirst },
    oKR: { findMany: mocks.okrFindMany },
  },
}));
vi.mock("@repo/database/vector-search", () => ({
  upsertKnowledgeChunk: mocks.upsertKnowledgeChunk,
}));
vi.mock("ai", () => ({
  embedMany: mocks.embedMany,
  embed: mocks.embed,
}));
vi.mock("@repo/ai/lib/models", () => ({
  models: { embeddings: "text-embedding-3-small" },
}));
vi.mock("@/lib/prompt-sanitize", () => ({
  sanitizeForPrompt: mocks.sanitizeForPrompt,
}));
vi.mock("@/app/actions/safe-copilot/chunk-text", () => ({
  chunkText: mocks.chunkText,
}));

import { indexEntity } from "@/app/actions/safe-copilot/index-entity";
import {
  indexDocumentChunk,
  syncTenantKnowledge,
} from "@/app/actions/safe-copilot/indexer";

function makeEmbeddings(n: number) {
  return Array.from({ length: n }, (_, i) => [i * 0.1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.embedMany.mockResolvedValue({ embeddings: makeEmbeddings(10) });
  mocks.embed.mockResolvedValue({ embedding: [0.1, 0.2] });
  mocks.upsertKnowledgeChunk.mockResolvedValue(undefined);
  mocks.chunkText.mockReturnValue(["chunk1"]);
  mocks.sanitizeForPrompt.mockImplementation((s: string) => s);
  // default empty DB
  mocks.riskFindMany.mockResolvedValue([]);
  mocks.piObjectiveFindMany.mockResolvedValue([]);
  mocks.featureFindMany.mockResolvedValue([]);
  mocks.epicFindMany.mockResolvedValue([]);
  mocks.okrFindMany.mockResolvedValue([]);
});

describe("syncTenantKnowledge", () => {
  it("returns zero counts when DB is empty", async () => {
    const result = await syncTenantKnowledge();
    expect(result.total).toBe(0);
    expect(result.indexed.risk).toBe(0);
    expect(mocks.embedMany).not.toHaveBeenCalled();
  });

  it("indexes one item of each type and returns total", async () => {
    mocks.riskFindMany.mockResolvedValue([
      {
        id: "r1",
        title: "Risk 1",
        description: "desc",
        status: "IDENTIFIED",
        category: "TECH",
        impact: "HIGH",
        piPlanId: "pi1",
      },
    ]);
    mocks.piObjectiveFindMany.mockResolvedValue([
      {
        id: "o1",
        title: "Obj 1",
        businessValue: 8,
        status: "DONE",
        isStretch: false,
        piPlanId: "pi1",
      },
    ]);
    mocks.featureFindMany.mockResolvedValue([
      {
        id: "f1",
        title: "Feat 1",
        statusId: "BACKLOG",
        wsjfScore: 10,
        epicId: "e1",
        piPlanId: "pi1",
      },
    ]);
    mocks.epicFindMany.mockResolvedValue([
      {
        id: "e1",
        title: "Epic 1",
        statusId: "IN_PROGRESS",
        strategicThemeId: "st1",
      },
    ]);
    mocks.okrFindMany.mockResolvedValue([
      {
        id: "okr1",
        title: "OKR 1",
        description: "okr desc",
        status: "ON_TRACK",
        type: "COMPANY",
        keyResults: [{ title: "KR1", current: 5, target: 10, unit: "%" }],
      },
    ]);
    mocks.embedMany.mockResolvedValue({ embeddings: makeEmbeddings(5) });

    const result = await syncTenantKnowledge();
    expect(result.total).toBe(5);
    expect(result.indexed.risk).toBe(1);
    expect(result.indexed.pi_objective).toBe(1);
    expect(result.indexed.feature).toBe(1);
    expect(result.indexed.epic).toBe(1);
    expect(result.indexed.okr).toBe(1);
  });

  it("omits null optional risk fields from textContent", async () => {
    mocks.riskFindMany.mockResolvedValue([
      {
        id: "r1",
        title: "Risk",
        description: null,
        status: null,
        category: null,
        impact: null,
        piPlanId: null,
      },
    ]);
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.1]] });

    await syncTenantKnowledge();
    expect(mocks.embedMany).toHaveBeenCalled();
    const [[call]] = mocks.embedMany.mock.calls as [[{ values: string[] }]];
    expect(call.values[0]).toContain("IDENTIFIED"); // default status
    expect(call.values[0]).not.toContain("Descrição:");
  });

  it("marks isStretch=true as Stretch, false as Comprometido", async () => {
    mocks.piObjectiveFindMany.mockResolvedValue([
      {
        id: "o1",
        title: "Stretch Obj",
        businessValue: 9,
        status: "ACTIVE",
        isStretch: true,
        piPlanId: "pi1",
      },
    ]);
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.1]] });

    await syncTenantKnowledge();
    const [[call]] = mocks.embedMany.mock.calls as [[{ values: string[] }]];
    expect(call.values[0]).toContain("Stretch");
    expect(call.values[0]).not.toContain("Comprometido");
  });

  it("omits WSJF line when wsjfScore is null", async () => {
    mocks.featureFindMany.mockResolvedValue([
      {
        id: "f1",
        title: "Feat",
        statusId: "BACKLOG",
        wsjfScore: null,
        epicId: null,
        piPlanId: null,
      },
    ]);
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.1]] });

    await syncTenantKnowledge();
    const [[call]] = mocks.embedMany.mock.calls as [[{ values: string[] }]];
    expect(call.values[0]).not.toContain("WSJF:");
  });

  it("includes WSJF line when wsjfScore is defined", async () => {
    mocks.featureFindMany.mockResolvedValue([
      {
        id: "f1",
        title: "Feat",
        statusId: "BACKLOG",
        wsjfScore: 15,
        epicId: null,
        piPlanId: null,
      },
    ]);
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.1]] });

    await syncTenantKnowledge();
    const [[call]] = mocks.embedMany.mock.calls as [[{ values: string[] }]];
    expect(call.values[0]).toContain("WSJF: 15");
  });

  it("splits 25 risks into 2 batches (BATCH_SIZE=20)", async () => {
    const risks = Array.from({ length: 25 }, (_, i) => ({
      id: `r${i}`,
      title: `Risk ${i}`,
      description: null,
      status: "IDENTIFIED",
      category: null,
      impact: null,
      piPlanId: null,
    }));
    mocks.riskFindMany.mockResolvedValue(risks);
    mocks.embedMany
      .mockResolvedValueOnce({ embeddings: makeEmbeddings(20) })
      .mockResolvedValueOnce({ embeddings: makeEmbeddings(5) });

    const result = await syncTenantKnowledge();
    expect(mocks.embedMany).toHaveBeenCalledTimes(2);
    expect(result.indexed.risk).toBe(25);
  });

  it("propagates auth errors", async () => {
    mocks.requireTenantSession.mockRejectedValue(
      new MockAuthError("UNAUTHENTICATED", "not logged in")
    );
    await expect(syncTenantKnowledge()).rejects.toThrow("not logged in");
  });
});

describe("indexEntity", () => {
  it("epic found — calls embedMany + upsertKnowledgeChunk", async () => {
    mocks.epicFindFirst.mockResolvedValue({
      title: "Epic A",
      descriptionMd: "Some description",
    });
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.1]] });

    await indexEntity("epic", "e1", tenantCtx.tenantId);
    expect(mocks.embedMany).toHaveBeenCalled();
    expect(mocks.upsertKnowledgeChunk).toHaveBeenCalled();
  });

  it("epic not found — returns early without embedding", async () => {
    mocks.epicFindFirst.mockResolvedValue(null);

    await indexEntity("epic", "e99", tenantCtx.tenantId);
    expect(mocks.embedMany).not.toHaveBeenCalled();
  });

  it("feature found — embeds with empty body", async () => {
    mocks.featureFindFirst.mockResolvedValue({ title: "Feature X" });
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.2]] });

    await indexEntity("feature", "f1", tenantCtx.tenantId);
    expect(mocks.embedMany).toHaveBeenCalled();
    const [[call]] = mocks.chunkText.mock.calls as [[string]];
    expect(call).toBe("Feature X"); // body is empty, only title remains
  });

  it("feature not found — returns early", async () => {
    mocks.featureFindFirst.mockResolvedValue(null);
    await indexEntity("feature", "f99", tenantCtx.tenantId);
    expect(mocks.embedMany).not.toHaveBeenCalled();
  });

  it("risk found — indexes description into body", async () => {
    mocks.riskFindFirst.mockResolvedValue({
      title: "Risk Y",
      description: "desc text",
    });
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.3]] });

    await indexEntity("risk", "r1", tenantCtx.tenantId);
    expect(mocks.chunkText).toHaveBeenCalledWith(
      expect.stringContaining("desc text")
    );
  });

  it("risk not found — returns early", async () => {
    mocks.riskFindFirst.mockResolvedValue(null);
    await indexEntity("risk", "r99", tenantCtx.tenantId);
    expect(mocks.embedMany).not.toHaveBeenCalled();
  });

  it("pi_objective found — embeds", async () => {
    mocks.piObjectiveFindFirst.mockResolvedValue({ title: "Obj Z" });
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.4]] });

    await indexEntity("pi_objective", "o1", tenantCtx.tenantId);
    expect(mocks.embedMany).toHaveBeenCalled();
  });

  it("pi_objective not found — returns early", async () => {
    mocks.piObjectiveFindFirst.mockResolvedValue(null);
    await indexEntity("pi_objective", "o99", tenantCtx.tenantId);
    expect(mocks.embedMany).not.toHaveBeenCalled();
  });

  it("unknown sourceType (default branch) — returns null without embedding", async () => {
    // "okr" is not in the switch; falls to default → returns null
    await indexEntity("okr" as "epic", "okr1", tenantCtx.tenantId);
    expect(mocks.embedMany).not.toHaveBeenCalled();
  });

  it("chunkText returning 3 chunks produces 3 upsertKnowledgeChunk calls", async () => {
    mocks.epicFindFirst.mockResolvedValue({
      title: "Long Epic",
      descriptionMd: "lots of text",
    });
    mocks.chunkText.mockReturnValue(["c1", "c2", "c3"]);
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.1], [0.2], [0.3]] });

    await indexEntity("epic", "e1", tenantCtx.tenantId);
    expect(mocks.upsertKnowledgeChunk).toHaveBeenCalledTimes(3);

    const calls = mocks.upsertKnowledgeChunk.mock.calls as [
      { chunkIndex: number },
    ][];
    expect(calls[0][0].chunkIndex).toBe(0);
    expect(calls[1][0].chunkIndex).toBe(1);
    expect(calls[2][0].chunkIndex).toBe(2);
  });

  it("upsertKnowledgeChunk receives correct tenantId and sourceType", async () => {
    mocks.epicFindFirst.mockResolvedValue({
      title: "Epic B",
      descriptionMd: "",
    });
    mocks.embedMany.mockResolvedValue({ embeddings: [[0.1]] });

    await indexEntity("epic", "e42", tenantCtx.tenantId);
    const [[upsertCall]] = mocks.upsertKnowledgeChunk.mock.calls as [
      [{ tenantId: string; sourceType: string; sourceId: string }],
    ];
    expect(upsertCall.tenantId).toBe(tenantCtx.tenantId);
    expect(upsertCall.sourceType).toBe("epic");
    expect(upsertCall.sourceId).toBe("e42");
  });
});

describe("indexDocumentChunk", () => {
  it("calls embed with formatted value and upserts with correct fields", async () => {
    await indexDocumentChunk("sess-1", "report.pdf", 0, "page content");

    expect(mocks.embed).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.stringContaining("report.pdf"),
      })
    );
    expect(mocks.upsertKnowledgeChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantCtx.tenantId,
        sourceType: "document",
        sourceId: "sess-1:report.pdf",
        chunkIndex: 0,
        title: "report.pdf",
        textContent: "page content",
        metadata: { sessionId: "sess-1", fileName: "report.pdf" },
        embedding: [0.1, 0.2],
      })
    );
  });

  it("includes 1-based chunk number in embed value", async () => {
    await indexDocumentChunk("sess-1", "doc.pdf", 3, "content");
    const [[call]] = mocks.embed.mock.calls as [[{ value: string }]];
    expect(call.value).toContain("chunk 4");
  });

  it("propagates auth errors without calling embed", async () => {
    mocks.requireTenantSession.mockRejectedValue(
      new MockAuthError("UNAUTHENTICATED", "unauthorized")
    );
    await expect(indexDocumentChunk("s", "f.pdf", 0, "text")).rejects.toThrow(
      "unauthorized"
    );
    expect(mocks.embed).not.toHaveBeenCalled();
  });
});
