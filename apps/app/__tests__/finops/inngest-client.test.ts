import { describe, expect, it } from "vitest";

describe("inngest client", () => {
  it("inngest module resolves", async () => {
    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });
});
