import { describe, it, expect } from "vitest";
import { parseMigrationCSV } from "../../lib/migration/csv-parser";

describe("parseMigrationCSV", () => {
  it("parses epic rows", () => {
    const csv = `type,title,description,status,team,sprint,storyPoints,parentTitle
epic,My Epic,desc,BACKLOG,,,0,`;
    const items = parseMigrationCSV(csv);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "epic", title: "My Epic", status: "BACKLOG" });
  });

  it("parses story rows with parent", () => {
    const csv = `type,title,description,status,team,sprint,storyPoints,parentTitle
story,Story A,,IN_PROGRESS,Team Alpha,Sprint 1,5,My Epic`;
    const items = parseMigrationCSV(csv);
    expect(items[0]).toMatchObject({
      type: "story",
      title: "Story A",
      parentTitle: "My Epic",
      storyPoints: 5,
    });
  });

  it("ignores rows with empty title", () => {
    const csv = `type,title,description,status,team,sprint,storyPoints,parentTitle
story,,,,,,0,`;
    expect(parseMigrationCSV(csv)).toHaveLength(0);
  });

  it("throws on missing required columns", () => {
    const csv = `name,description\nFoo,Bar`;
    expect(() => parseMigrationCSV(csv)).toThrow("Missing required columns");
  });

  it("handles multiple rows of different types", () => {
    const csv = `type,title,description,status,team,sprint,storyPoints,parentTitle
epic,Epic 1,,BACKLOG,,,0,
feature,Feature A,,BACKLOG,,,0,Epic 1
story,Story B,,TODO,Team Alpha,Sprint 1,3,Feature A`;
    const items = parseMigrationCSV(csv);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.type)).toEqual(["epic", "feature", "story"]);
  });
});
