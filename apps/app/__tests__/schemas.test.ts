import { describe, expect, it } from "vitest";
import {
  ConfidenceVoteEventSchema,
  EPIC_STATUSES,
  UpdateEpicStatusSchema,
  UpdateWSJFSchema,
} from "../app/actions/schemas";

describe("UpdateWSJFSchema", () => {
  it("accepts valid WSJF input", () => {
    const parsed = UpdateWSJFSchema.parse({
      featureId: "feat-1",
      bv: 8,
      tc: 5,
      rr: 2,
      js: 3,
    });
    expect(parsed.js).toBe(3);
  });

  it("rejects job size zero", () => {
    expect(() =>
      UpdateWSJFSchema.parse({
        featureId: "f1",
        bv: 1,
        tc: 1,
        rr: 1,
        js: 0,
      })
    ).toThrow();
  });

  it("rejects negative BV", () => {
    expect(() =>
      UpdateWSJFSchema.parse({
        featureId: "f1",
        bv: -1,
        tc: 1,
        rr: 1,
        js: 2,
      })
    ).toThrow();
  });
});

describe("UpdateEpicStatusSchema", () => {
  it("accepts all SAFe portfolio statuses", () => {
    for (const statusId of EPIC_STATUSES) {
      const parsed = UpdateEpicStatusSchema.parse({
        epicId: "epic-1",
        statusId,
        order: 0,
      });
      expect(parsed.statusId).toBe(statusId);
    }
  });

  it("rejects unknown status", () => {
    expect(() =>
      UpdateEpicStatusSchema.parse({
        epicId: "epic-1",
        statusId: "FUNNEL",
        order: 0,
      })
    ).toThrow();
  });
});

describe("ConfidenceVoteEventSchema", () => {
  it("parses vote submission", () => {
    const event = ConfidenceVoteEventSchema.parse({
      type: "SUBMIT_VOTE",
      vote: 4,
    });
    expect(event.type).toBe("SUBMIT_VOTE");
  });

  it("rejects vote outside 1–5", () => {
    expect(() =>
      ConfidenceVoteEventSchema.parse({ type: "SUBMIT_VOTE", vote: 6 })
    ).toThrow();
  });
});
