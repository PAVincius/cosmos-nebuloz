import { describe, expect, it, vi } from "vitest";

// The component imports a server action (settings-audit) which pulls
// @repo/auth -> @repo/database and trips the client-env guard under vitest.
// Mock it so we can unit-test the pure toCsv exported alongside it.
vi.mock("@/app/(cosmos)/actions/settings-audit", () => ({
  getAuditTab: vi.fn(),
}));

import { toCsv } from "@/components/cosmos/screens/settings-audit-tab";

describe("toCsv — spreadsheet formula injection guard", () => {
  const row = {
    id: "1",
    action: "updated",
    entityType: "TenantMember",
    entityId: "m-1",
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("prefixes a formula-leading actor name with an apostrophe", () => {
    const csv = toCsv([{ ...row, actorName: '=HYPERLINK("http://evil","x")' }]);
    // The dangerous field is forced back to text with a leading '.
    expect(csv).toContain(`"'=HYPERLINK`);
    expect(csv).not.toContain(`"=HYPERLINK`);
  });

  it("leaves an ordinary actor name untouched", () => {
    const csv = toCsv([{ ...row, actorName: "Ana Souza" }]);
    expect(csv).toContain('"Ana Souza"');
    expect(csv).not.toContain("'Ana");
  });
});
