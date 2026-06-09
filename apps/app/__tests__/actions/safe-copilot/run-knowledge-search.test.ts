import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  embed: vi.fn(),
  searchKnowledge: vi.fn(),
  models: { embeddings: "text-embedding-3-small" },
}));

vi.mock("ai", () => ({ embed: mocks.embed }));
vi.mock("@repo/ai/lib/models", () => ({ models: mocks.models }));
vi.mock("@repo/database/vector-search", () => ({
  searchKnowledge: mocks.searchKnowledge,
}));

import { runKnowledgeSearch } from "../../../app/actions/safe-copilot/tools/knowledge-search";

const FAKE_EMBEDDING = [0.1, 0.2, 0.3];

const makeHit = (
  overrides: Partial<{
    sourceType: string;
    sourceId: string | null;
    title: string | null;
    textContent: string;
    similarity: number;
  }> = {}
) => ({
  sourceType: "epic",
  sourceId: "src-1",
  title: "My Epic",
  textContent: "Some content about the epic.",
  similarity: 0.9,
  ...overrides,
});

describe("runKnowledgeSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.embed.mockResolvedValue({ embedding: FAKE_EMBEDDING });
    mocks.searchKnowledge.mockResolvedValue([makeHit()]);
  });

  it("returns mapped results from searchKnowledge", async () => {
    const results = await runKnowledgeSearch("PI planning", "tenant-1");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      sourceType: "epic",
      sourceId: "src-1",
      title: "My Epic",
      excerpt: "Some content about the epic.",
      similarity: 0.9,
    });
  });

  it("truncates textContent to 400 characters in excerpt", async () => {
    const longText = "A".repeat(800);
    mocks.searchKnowledge.mockResolvedValue([
      makeHit({ textContent: longText }),
    ]);

    const results = await runKnowledgeSearch("long text query", "tenant-1");

    expect(results[0].excerpt).toHaveLength(400);
    expect(results[0].excerpt).toBe("A".repeat(400));
  });

  it("returns empty array when searchKnowledge returns no hits", async () => {
    mocks.searchKnowledge.mockResolvedValue([]);

    const results = await runKnowledgeSearch("no results", "tenant-1");

    expect(results).toEqual([]);
  });

  it("passes sourceTypes and limit through to searchKnowledge", async () => {
    await runKnowledgeSearch("query", "tenant-42", ["epic", "story"], 5);

    expect(mocks.searchKnowledge).toHaveBeenCalledWith(
      "tenant-42",
      FAKE_EMBEDDING,
      "query",
      { sourceTypes: ["epic", "story"], limit: 5, threshold: 0.65 }
    );
  });

  it("uses default limit=8 when not specified", async () => {
    await runKnowledgeSearch("query", "tenant-1");

    expect(mocks.searchKnowledge).toHaveBeenCalledWith(
      "tenant-1",
      FAKE_EMBEDDING,
      "query",
      { sourceTypes: undefined, limit: 8, threshold: 0.65 }
    );
  });

  it("calls embed with the correct model and query value", async () => {
    await runKnowledgeSearch("PI planning", "tenant-1");

    expect(mocks.embed).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      value: "PI planning",
    });
  });
});
