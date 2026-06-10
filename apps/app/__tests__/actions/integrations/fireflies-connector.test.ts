// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildFirefliesWebhookUrl } from "@/app/actions/integrations/connectors/fireflies";

describe("buildFirefliesWebhookUrl", () => {
  it("builds the per-integration webhook URL", () => {
    expect(buildFirefliesWebhookUrl("https://app.cosmos.io", "int_123")).toBe(
      "https://app.cosmos.io/api/webhooks/fireflies/int_123"
    );
  });

  it("strips trailing slashes from the base URL", () => {
    expect(buildFirefliesWebhookUrl("https://app.cosmos.io/", "int_9")).toBe(
      "https://app.cosmos.io/api/webhooks/fireflies/int_9"
    );
    expect(buildFirefliesWebhookUrl("https://app.cosmos.io///", "x")).toBe(
      "https://app.cosmos.io/api/webhooks/fireflies/x"
    );
  });

  it("works with localhost dev base", () => {
    expect(buildFirefliesWebhookUrl("http://localhost:3012", "abc")).toBe(
      "http://localhost:3012/api/webhooks/fireflies/abc"
    );
  });
});
