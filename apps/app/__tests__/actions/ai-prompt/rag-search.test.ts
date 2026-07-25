// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ragSearch } from "../../../app/actions/ai-prompt/rag-search";

describe("ragSearch", () => {
  it("always returns an empty array", async () => {
    const result = await ragSearch("tenant-1", "what is SAFe?");
    expect(result).toEqual([]);
  });

  it("returns [] regardless of args (stub behaviour)", async () => {
    const r1 = await ragSearch("t", "q", 100);
    const r2 = await ragSearch(undefined, undefined, 0);
    expect(r1).toEqual([]);
    expect(r2).toEqual([]);
  });
});
