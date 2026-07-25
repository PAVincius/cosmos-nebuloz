// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  type InsightClassification,
  parseActionItemsFallback,
  proposedTargetFor,
  toClassifiedInsights,
} from "@/lib/meeting/insight-classify";

describe("parseActionItemsFallback", () => {
  it("splits multi-line action items into ACTION insights", () => {
    const result = parseActionItemsFallback(
      "Alice: refine epic-12\nBob: spike auth flow"
    );
    expect(result).toEqual([
      { type: "ACTION", text: "Alice: refine epic-12", proposedTarget: "Task" },
      { type: "ACTION", text: "Bob: spike auth flow", proposedTarget: "Task" },
    ]);
  });

  it("strips bullet and numbering prefixes", () => {
    const result = parseActionItemsFallback("- do X\n2) do Y\n• do Z");
    expect(result.map((r) => r.text)).toEqual(["do X", "do Y", "do Z"]);
  });

  it("drops empty lines", () => {
    const result = parseActionItemsFallback("task one\n\n   \ntask two");
    expect(result).toHaveLength(2);
  });

  it("returns empty array for null/empty", () => {
    expect(parseActionItemsFallback(null)).toEqual([]);
    expect(parseActionItemsFallback("")).toEqual([]);
    expect(parseActionItemsFallback(undefined)).toEqual([]);
  });
});

describe("proposedTargetFor", () => {
  it("maps each type to its domain target", () => {
    expect(proposedTargetFor("ACTION")).toBe("Task");
    expect(proposedTargetFor("RISK")).toBe("Risk");
    expect(proposedTargetFor("DECISION")).toBe("DecisionLog");
  });
});

describe("toClassifiedInsights", () => {
  it("attaches proposed targets to LLM output", () => {
    const classification: InsightClassification = {
      insights: [
        { type: "RISK", text: "auth dependency may slip" },
        { type: "DECISION", text: "adopt pgvector for RAG" },
      ],
    };
    expect(toClassifiedInsights(classification)).toEqual([
      {
        type: "RISK",
        text: "auth dependency may slip",
        proposedTarget: "Risk",
      },
      {
        type: "DECISION",
        text: "adopt pgvector for RAG",
        proposedTarget: "DecisionLog",
      },
    ]);
  });
});
