import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  epicFindFirst: vi.fn(),
  ragSearch: vi.fn(),
  getActiveProvider: vi.fn(),
  getAIModel: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: { epic: { findFirst: mocks.epicFindFirst } },
}));
vi.mock("@/app/actions/ai-prompt/rag-search", () => ({
  ragSearch: mocks.ragSearch,
}));
vi.mock("@repo/ai/lib/models", () => ({
  getActiveProvider: mocks.getActiveProvider,
  getAIModel: mocks.getAIModel,
}));
vi.mock("ai", () => ({ generateText: mocks.generateText }));
vi.mock("@/app/actions/_base", () => ({
  safeAction: vi.fn(async (fn: () => Promise<unknown>) => {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }),
}));

import { generateAndDeliverPrompt } from "@/app/actions/ai-prompt/generate-prompt";

const tenantCtx = {
  tenantId: "tenant-test",
  userId: "user-test",
  role: "PO" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.epicFindFirst.mockResolvedValue({
    id: "e1",
    title: "Test Epic",
    descriptionMd: "desc",
  });
  mocks.ragSearch.mockResolvedValue([]);
  mocks.getActiveProvider.mockReturnValue("anthropic");
  mocks.getAIModel.mockReturnValue("claude-3-5-sonnet");
  mocks.generateText.mockResolvedValue({ text: "generated prompt text" });
});

describe("generateAndDeliverPrompt", () => {
  it("returns error when epic not found", async () => {
    mocks.epicFindFirst.mockResolvedValue(null);
    const result = await generateAndDeliverPrompt({
      epicId: "e99",
      target: "cursor",
      ragDocIds: [],
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe(
      "Épico não encontrado"
    );
  });

  it("returns error when provider is none", async () => {
    mocks.getActiveProvider.mockReturnValue("none");
    const result = await generateAndDeliverPrompt({
      epicId: "e1",
      target: "cursor",
      ragDocIds: [],
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe(
      "Nenhuma chave de IA configurada."
    );
  });

  it("returns prompt and deepLink on success", async () => {
    const result = await generateAndDeliverPrompt({
      epicId: "e1",
      target: "claude-ai",
      ragDocIds: [],
    });
    expect(result.ok).toBe(true);
    const data = (
      result as { ok: true; data: { prompt: string; deepLink: string } }
    ).data;
    expect(data.prompt).toBe("generated prompt text");
    expect(data.deepLink).toContain("claude.ai");
  });

  it("includes RAG context when ragSearch returns docs", async () => {
    mocks.ragSearch.mockResolvedValue([
      { title: "Doc1", content: "relevant content" },
    ]);

    await generateAndDeliverPrompt({
      epicId: "e1",
      target: "cursor",
      ragDocIds: [],
    });

    const [[call]] = mocks.generateText.mock.calls as [
      [{ prompt: string; system: string }],
    ];
    expect(call.prompt).toContain("DOCUMENTOS RELEVANTES");
    expect(call.prompt).toContain("Doc1");
  });

  it("excludes RAG context when ragSearch returns empty", async () => {
    mocks.ragSearch.mockResolvedValue([]);

    await generateAndDeliverPrompt({
      epicId: "e1",
      target: "cursor",
      ragDocIds: [],
    });

    const [[call]] = mocks.generateText.mock.calls as [
      [{ prompt: string; system: string }],
    ];
    expect(call.prompt).not.toContain("DOCUMENTOS RELEVANTES");
  });
});

describe("buildDeepLink — all targets", () => {
  const targets = [
    { target: "cursor", prefix: "cursor://" },
    { target: "windsurf", prefix: "windsurf://" },
    { target: "vscode", prefix: "vscode://" },
    { target: "claude-code", prefix: "claude-code://" },
    { target: "claude-ai", prefix: "https://claude.ai" },
    { target: "chatgpt", prefix: "https://chatgpt.com" },
    { target: "groq", prefix: "https://groq.com/" },
    { target: "gemini", prefix: "https://gemini.google.com" },
    { target: "perplexity", prefix: "https://perplexity.ai" },
  ] as const;

  for (const { target, prefix } of targets) {
    it(`target "${target}" produces deepLink starting with "${prefix}"`, async () => {
      const result = await generateAndDeliverPrompt({
        epicId: "e1",
        target,
        ragDocIds: [],
      });
      expect(result.ok).toBe(true);
      const data = (result as { ok: true; data: { deepLink: string } }).data;
      expect(data.deepLink).toMatch(
        new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
      );
    });
  }
});

describe("systemPromptForTarget", () => {
  it("claude-code target uses System Prompt structure in system", async () => {
    await generateAndDeliverPrompt({
      epicId: "e1",
      target: "claude-code",
      ragDocIds: [],
    });
    const [[call]] = mocks.generateText.mock.calls as [
      [{ prompt: string; system: string }],
    ];
    expect(call.system).toContain("System Prompt structure");
  });

  it("cursor target uses one-shot implementation in system", async () => {
    await generateAndDeliverPrompt({
      epicId: "e1",
      target: "cursor",
      ragDocIds: [],
    });
    const [[call]] = mocks.generateText.mock.calls as [
      [{ prompt: string; system: string }],
    ];
    expect(call.system).toContain("one-shot implementation");
  });

  it("gemini uses base system prompt without extra instructions", async () => {
    await generateAndDeliverPrompt({
      epicId: "e1",
      target: "gemini",
      ragDocIds: [],
    });
    const [[call]] = mocks.generateText.mock.calls as [
      [{ prompt: string; system: string }],
    ];
    expect(call.system).not.toContain("System Prompt structure");
    expect(call.system).not.toContain("one-shot implementation");
  });
});
