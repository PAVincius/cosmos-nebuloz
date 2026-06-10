// @vitest-environment node
// Contract tests: both adapters must produce the same NormalizedSummary shape.

import { describe, expect, it } from "vitest";
import type { NormalizedSummary } from "@/lib/meeting/provider";
import { getProvider } from "@/lib/meeting/provider";
import { FathomAdapter } from "@/lib/meeting/providers/fathom";
import { FirefliesAdapter } from "@/lib/meeting/providers/fireflies";

const fireflies = new FirefliesAdapter();
const fathom = new FathomAdapter();

function hasCanonicalShape(s: NormalizedSummary): boolean {
  return (
    (typeof s.title === "string" || s.title === null) &&
    (typeof s.rawSummary.overview === "string" ||
      s.rawSummary.overview === null) &&
    (typeof s.rawSummary.actionItems === "string" ||
      s.rawSummary.actionItems === null) &&
    Array.isArray(s.rawSummary.keywords) &&
    (typeof s.rawSummary.outline === "string" || s.rawSummary.outline === null)
  );
}

describe("FirefliesAdapter", () => {
  it("normalizeSummary produces canonical shape on full payload", () => {
    const raw = {
      id: "t1",
      title: "PI Planning",
      summary: {
        overview: "Overview text",
        action_items: "- Do X\n- Do Y",
        keywords: ["SAFe", "PI"],
        outline: "1. Intro",
      },
    };
    const out = fireflies.normalizeSummary(raw);
    expect(hasCanonicalShape(out)).toBe(true);
    expect(out.title).toBe("PI Planning");
    expect(out.rawSummary.overview).toBe("Overview text");
    expect(out.rawSummary.keywords).toEqual(["SAFe", "PI"]);
  });

  it("normalizeSummary handles empty payload without throwing", () => {
    const out = fireflies.normalizeSummary(null);
    expect(hasCanonicalShape(out)).toBe(true);
    expect(out.title).toBeNull();
  });

  it("extractMeetingId reads meetingId field", () => {
    expect(fireflies.extractMeetingId({ meetingId: "m1" })).toBe("m1");
    expect(fireflies.extractMeetingId({})).toBeNull();
  });

  it("verifySignature accepts valid HMAC and rejects tampered body", () => {
    const secret = "test-secret";
    const body = Buffer.from('{"meetingId":"m1"}');
    const { createHmac } = require("node:crypto");
    const hmac = createHmac("sha256", secret).update(body).digest("hex");
    const sig = `sha256=${hmac}`;

    expect(fireflies.verifySignature(body, sig, secret)).toBe(true);
    expect(
      fireflies.verifySignature(Buffer.from("tampered"), sig, secret)
    ).toBe(false);
  });
});

describe("FathomAdapter", () => {
  it("normalizeSummary produces canonical shape on full payload", () => {
    const raw = {
      title: "Retrospectiva",
      action_items: [{ text: "Fix CI" }, { text: "Update docs" }],
      highlights: [{ text: "Team velocity improved" }],
    };
    const out = fathom.normalizeSummary(raw);
    expect(hasCanonicalShape(out)).toBe(true);
    expect(out.title).toBe("Retrospectiva");
    expect(out.rawSummary.actionItems).toBe("Fix CI\nUpdate docs");
    expect(out.rawSummary.overview).toBe("Team velocity improved");
  });

  it("normalizeSummary handles empty payload without throwing", () => {
    const out = fathom.normalizeSummary(null);
    expect(hasCanonicalShape(out)).toBe(true);
    expect(out.title).toBeNull();
    expect(out.rawSummary.actionItems).toBeNull();
  });

  it("extractMeetingId reads call_id field", () => {
    expect(fathom.extractMeetingId({ call_id: "c1" })).toBe("c1");
    expect(fathom.extractMeetingId({ meetingId: "m1" })).toBeNull();
  });

  it("verifySignature accepts valid HMAC and rejects tampered body", () => {
    const secret = "fathom-secret";
    const body = Buffer.from('{"call_id":"c1"}');
    const { createHmac } = require("node:crypto");
    const hmac = createHmac("sha256", secret).update(body).digest("hex");
    const sig = `sha256=${hmac}`;

    expect(fathom.verifySignature(body, sig, secret)).toBe(true);
    expect(fathom.verifySignature(Buffer.from("tampered"), sig, secret)).toBe(
      false
    );
  });
});

describe("getProvider registry", () => {
  it("returns FirefliesAdapter for 'fireflies'", () => {
    const p = getProvider("fireflies");
    expect(p?.provider).toBe("fireflies");
  });

  it("returns FathomAdapter for 'fathom'", () => {
    const p = getProvider("fathom");
    expect(p?.provider).toBe("fathom");
  });

  it("returns null for unknown provider", () => {
    expect(getProvider("otter")).toBeNull();
  });

  it("both adapters produce the same NormalizedSummary shape (contract)", () => {
    const firefliesOut = getProvider("fireflies")!.normalizeSummary({});
    const fathomOut = getProvider("fathom")!.normalizeSummary({});
    expect(Object.keys(firefliesOut)).toEqual(Object.keys(fathomOut));
    expect(Object.keys(firefliesOut.rawSummary)).toEqual(
      Object.keys(fathomOut.rawSummary)
    );
  });
});
