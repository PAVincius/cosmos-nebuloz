// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveConflict } from "@/app/actions/integrations/sync/conflict-resolver";

describe("resolveConflict", () => {
  it("external wins when external is more recent", () => {
    const result = resolveConflict({
      cosmosId: "epic-1",
      cosmosType: "Epic",
      externalSource: "linear",
      externalId: "lin-1",
      cosmosUpdatedAt: new Date("2026-01-01T10:00:00Z"),
      externalUpdatedAt: new Date("2026-01-01T11:00:00Z"),
    });
    expect(result).toBe("external_wins");
  });

  it("cosmos wins when cosmos is more recent", () => {
    const result = resolveConflict({
      cosmosId: "epic-1",
      cosmosType: "Epic",
      externalSource: "github",
      externalId: "42",
      cosmosUpdatedAt: new Date("2026-01-01T12:00:00Z"),
      externalUpdatedAt: new Date("2026-01-01T10:00:00Z"),
    });
    expect(result).toBe("cosmos_wins");
  });

  it("external wins on tie (engineers are source of truth)", () => {
    const ts = new Date("2026-01-01T10:00:00Z");
    const result = resolveConflict({
      cosmosId: "epic-1",
      cosmosType: "Epic",
      externalSource: "linear",
      externalId: "lin-1",
      cosmosUpdatedAt: ts,
      externalUpdatedAt: ts,
    });
    expect(result).toBe("external_wins");
  });

  it("works with github source as well", () => {
    const result = resolveConflict({
      cosmosId: "story-1",
      cosmosType: "Story",
      externalSource: "github",
      externalId: "99",
      cosmosUpdatedAt: new Date("2026-03-01T08:00:00Z"),
      externalUpdatedAt: new Date("2026-03-01T09:00:00Z"),
    });
    expect(result).toBe("external_wins");
  });
});
