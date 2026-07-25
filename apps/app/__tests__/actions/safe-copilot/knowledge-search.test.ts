// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chunkText } from "@/app/actions/safe-copilot/chunk-text";
import { extractCitations } from "@/app/actions/safe-copilot/context/citation-formatter";

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    expect(chunkText("hello world")).toHaveLength(1);
  });

  it("splits long text into multiple chunks", () => {
    const long = Array.from(
      { length: 20 },
      (_, i) => `paragraph ${i} with some content here`
    ).join("\n\n");
    const chunks = chunkText(long, { targetChars: 100 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk fits within 1.5x target", () => {
    const long = Array.from(
      { length: 30 },
      (_, i) => "word ".repeat(40) + i
    ).join("\n\n");
    const chunks = chunkText(long, { targetChars: 500 });
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(750);
    }
  });
});

describe("extractCitations", () => {
  it("extracts source references from text", () => {
    const text =
      "Risk identified [source: risk:abc123] and feature [source: feature:def456].";
    const citations = extractCitations(text);
    expect(citations).toHaveLength(2);
    expect(citations[0]).toEqual({ type: "risk", id: "abc123" });
    expect(citations[1]).toEqual({ type: "feature", id: "def456" });
  });

  it("returns empty array when no citations present", () => {
    expect(extractCitations("plain text without citations")).toHaveLength(0);
  });
});
