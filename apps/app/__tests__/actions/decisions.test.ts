import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
}));
vi.mock("@repo/database", () => ({
  database: {
    decisionLogEntry: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "d1",
          titulo: "Aprovar migração multi-tenant",
          decisao: "approved",
          justificativa: "Reduz dívida técnica crítica",
          tipo: "epic_decision",
          targetType: "epic",
          dataDecisao: new Date("2026-02-10"),
          tags: ["tech-debt"],
        },
      ]),
    },
  },
}));

import { database } from "@repo/database";
import { listDecisions } from "../../app/(cosmos)/actions/decisions";

describe("listDecisions", () => {
  it("returns tenant-scoped decisions ordered by most recent", async () => {
    const r = await listDecisions();
    expect(r.ok).toBe(true);
    expect(database.decisionLogEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
        orderBy: { dataDecisao: "desc" },
      })
    );
    if (r.ok) {
      expect(r.data[0].titulo).toBe("Aprovar migração multi-tenant");
      expect(typeof r.data[0].dataDecisao).toBe("string");
    }
  });
});
