// @vitest-environment node

import { describe, expect, it } from "vitest";
import { normalizeFirefliesSummary } from "@/lib/inngest/fireflies-normalize";

describe("normalizeFirefliesSummary", () => {
  it("maps a full transcript to internal shape", () => {
    const result = normalizeFirefliesSummary({
      id: "ASxwZxCstx",
      title: "PI Planning - ART Platform",
      summary: {
        overview: "Team aligned on Q3 objectives.",
        action_items: "Alice: refine epic-12. Bob: spike auth.",
        keywords: ["objectives", "auth"],
        outline: "1. Intro 2. Objectives 3. Risks",
      },
    });

    expect(result).toEqual({
      title: "PI Planning - ART Platform",
      rawSummary: {
        overview: "Team aligned on Q3 objectives.",
        actionItems: "Alice: refine epic-12. Bob: spike auth.",
        keywords: ["objectives", "auth"],
        outline: "1. Intro 2. Objectives 3. Risks",
      },
    });
  });

  it("defaults missing fields without throwing", () => {
    const result = normalizeFirefliesSummary({ id: "x" });
    expect(result).toEqual({
      title: null,
      rawSummary: {
        overview: null,
        actionItems: null,
        keywords: [],
        outline: null,
      },
    });
  });

  it("handles null/undefined transcript", () => {
    expect(normalizeFirefliesSummary(null).title).toBeNull();
    expect(normalizeFirefliesSummary(undefined).rawSummary.keywords).toEqual(
      []
    );
  });

  it("coerces non-array keywords to empty array", () => {
    const result = normalizeFirefliesSummary({
      summary: { keywords: undefined },
    });
    expect(result.rawSummary.keywords).toEqual([]);
  });
});
