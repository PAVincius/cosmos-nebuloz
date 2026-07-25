import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
  epicFindFirst: vi.fn().mockResolvedValue({
    id: "e1",
    title: "Payments",
    descriptionMd: "Credit card payments",
    tenantId: "t1",
  }),
  generateText: vi.fn().mockResolvedValue({
    text: "Implement payments module with credit cards…",
  }),
  getAIModel: vi.fn().mockReturnValue({}),
  getActiveProvider: vi.fn().mockReturnValue("anthropic"),
  ragSearch: vi.fn().mockResolvedValue([]),
  headersResult: vi.fn().mockResolvedValue({}),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: { epic: { findFirst: mocks.epicFindFirst } },
}));
vi.mock("next/headers", () => ({ headers: mocks.headersResult }));
vi.mock("ai", () => ({ generateText: mocks.generateText }));
vi.mock("@repo/ai/lib/models", () => ({
  getAIModel: mocks.getAIModel,
  getActiveProvider: mocks.getActiveProvider,
}));
vi.mock("@/app/actions/ai-prompt/rag-search", () => ({
  ragSearch: mocks.ragSearch,
}));

import { generateAndDeliverPrompt } from "@/app/actions/ai-prompt/generate-prompt";

describe("generateAndDeliverPrompt", () => {
  it("returns prompt and deepLink for cursor target", async () => {
    const result = await generateAndDeliverPrompt({
      epicId: "e1",
      target: "cursor",
      ragDocIds: [],
    });
    expect(result.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).data?.prompt).toContain("payments");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).data?.deepLink).toContain("cursor://");
  });

  it("returns claude-ai deepLink for claude-ai target", async () => {
    const result = await generateAndDeliverPrompt({
      epicId: "e1",
      target: "claude-ai",
      ragDocIds: [],
    });
    expect(result.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).data?.deepLink).toContain("claude.ai");
  });
});
