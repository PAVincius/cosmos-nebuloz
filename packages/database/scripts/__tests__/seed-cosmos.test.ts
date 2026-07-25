import { expect, it, vi } from "vitest";
import { seedDevMembership } from "../seed-cosmos.mts";

it("seeds an ADMIN dev member for cosmos-demo", async () => {
  const db = {
    user: { upsert: vi.fn().mockResolvedValue({ id: "u1" }) },
    tenantMember: {
      upsert: vi.fn().mockResolvedValue({ id: "m1", role: "ADMIN" }),
    },
  };
  const m = await seedDevMembership(db as never, "t-demo");
  expect(db.user.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { email: "dev@cosmos.local" },
    })
  );
  expect(m.role).toBe("ADMIN");
});
