import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTE_BLOCKS,
  PROVIDERS,
  parseTaskBlocks,
} from "../../app/(cosmos)/actions/epic-tree.constants";

describe("parseTaskBlocks", () => {
  it("accepts the four supported block kinds", () => {
    const blocks = [
      { id: "b1", kind: "heading", text: "Resultado" },
      { id: "b2", kind: "paragraph", text: "Descreva o resultado." },
      { id: "b3", kind: "code", text: "const a = 1;" },
      {
        id: "b4",
        kind: "checklist",
        items: [{ id: "i1", text: "Sub-task", done: false }],
      },
    ];
    expect(parseTaskBlocks(blocks)).toEqual(blocks);
  });

  it("returns null for an unknown block kind", () => {
    expect(parseTaskBlocks([{ id: "b1", kind: "video", url: "x" }])).toBeNull();
  });

  it("returns null for a non-array payload", () => {
    expect(parseTaskBlocks({ kind: "heading" })).toBeNull();
  });

  it("returns an empty array for an empty note", () => {
    expect(parseTaskBlocks([])).toEqual([]);
  });

  it("seeds a native note with a heading, a paragraph and a checklist", () => {
    expect(DEFAULT_NOTE_BLOCKS.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "checklist",
    ]);
  });
});

describe("PROVIDERS", () => {
  it("builds an external URL from the ref for jira", () => {
    expect(PROVIDERS.jira.buildUrl("COS-142")).toBe(
      "https://cosmos.atlassian.net/browse/COS-142"
    );
  });

  it("has a letter and an accessible label for every provider", () => {
    for (const meta of Object.values(PROVIDERS)) {
      expect(meta.letter.length).toBeGreaterThan(0);
      expect(meta.label.length).toBeGreaterThan(0);
    }
  });
});
