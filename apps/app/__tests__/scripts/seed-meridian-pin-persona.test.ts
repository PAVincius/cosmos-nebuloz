/**
 * `seed-meridian.ts` roda com `TENANT_SLUG` variável (`nebuloz` por padrão,
 * `cosmos-dev` no E2E — `pnpm seed:meridian cosmos-dev`). `db.tenantMember`/
 * `db.meridianMembership` são upsert por `{tenantId, userId}` — aditivo,
 * nunca remove a membership de uma rodada anterior contra outro tenant.
 *
 * Achado do Crivo (atrito, item c): Marina Duarte ficou com `TenantMember`
 * em `nebuloz` (seed antigo, 15/set) e em `cosmos-dev` (seed do E2E) ao
 * mesmo tempo. `requireTenantSession` (`packages/auth/server.ts`) escolhe o
 * `activeTenantId` com `tenantMember.findFirst` sem `orderBy` — que tenant
 * "ganha" depende da ordem de inserção, não do que o E2E precisa. O
 * `AS-200` semeado só existe em `cosmos-dev`; com a sessão presa em
 * `nebuloz`, M4-M9 não acham o assessment.
 *
 * `pinPersonaToTenant` é a correção: depois do upsert, apaga qualquer
 * membership da mesma persona em outro tenant, deixando `findFirst`
 * inequívoco.
 */
import { describe, expect, it, vi } from "vitest";
import { pinPersonaToTenant } from "../../scripts/seed-meridian";

describe("pinPersonaToTenant", () => {
  it("remove TenantMember de qualquer outro tenant, preserva o atual", async () => {
    const tenantMemberDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const meridianMembershipDeleteMany = vi
      .fn()
      .mockResolvedValue({ count: 1 });
    const db = {
      tenantMember: { deleteMany: tenantMemberDeleteMany },
      meridianMembership: { deleteMany: meridianMembershipDeleteMany },
    } as unknown as Parameters<typeof pinPersonaToTenant>[0];

    await pinPersonaToTenant(db, "user-marina", "tenant-cosmos-dev");

    expect(tenantMemberDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-marina", tenantId: { not: "tenant-cosmos-dev" } },
    });
  });

  it("remove MeridianMembership de qualquer outro tenant do mesmo jeito", async () => {
    const tenantMemberDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const meridianMembershipDeleteMany = vi
      .fn()
      .mockResolvedValue({ count: 1 });
    const db = {
      tenantMember: { deleteMany: tenantMemberDeleteMany },
      meridianMembership: { deleteMany: meridianMembershipDeleteMany },
    } as unknown as Parameters<typeof pinPersonaToTenant>[0];

    await pinPersonaToTenant(db, "user-marina", "tenant-cosmos-dev");

    expect(meridianMembershipDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-marina", tenantId: { not: "tenant-cosmos-dev" } },
    });
  });
});
