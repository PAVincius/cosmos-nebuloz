import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    webhookEndpoint: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "w1",
          url: "https://hooks.slack.com/x",
          eventTypes: ["pi_committed"],
          active: true,
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listWebhooks } from "../../app/(cosmos)/actions/webhooks";

describe("listWebhooks", () => {
  it("returns tenant-scoped webhooks without secret fields", async () => {
    const r = await listWebhooks();
    expect(r.ok).toBe(true);
    expect(database.webhookEndpoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
        select: { id: true, url: true, eventTypes: true, active: true },
      })
    );
    if (r.ok) {
      expect(r.data[0].eventTypes).toContain("pi_committed");
    }
  });
});
