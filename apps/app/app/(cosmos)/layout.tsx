import {
  AuthError,
  redirectToSignIn,
  requireTenantSession,
} from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { SCREENS } from "@/components/cosmos/screens/registry";
import { CosmosShell, type ShellIdentity } from "@/components/cosmos/shell";
import "@repo/design-system/cosmos/cosmos.css";

// ORBIT -> "Orbit". Acronym roles (RTE/STE/SM/PO/DEV) stay uppercase; the rest
// read better title-cased.
const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();
const ACRONYM_ROLES = new Set(["STE", "RTE", "SM", "PO", "DEV"]);
const WHITESPACE = /\s+/;

const initials = (name: string) =>
  name
    .split(WHITESPACE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "?";

export async function resolveIdentity(): Promise<ShellIdentity | null> {
  try {
    const ctx = await requireTenantSession(await headers());
    // Mesma leitura de /api/tenants (TenantMember por userId, sem
    // cross-tenant — FR-014, spec 009): a lista de contas da pessoa,
    // separada da leitura escopada ao tenant ativo logo acima.
    const [tenant, memberships] = await Promise.all([
      database.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { name: true, plan: true },
      }),
      database.tenantMember.findMany({
        where: { userId: ctx.userId },
        include: { tenant: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      userName: ctx.user.name || ctx.user.email,
      userEmail: ctx.user.email,
      tenantName: tenant?.name ?? "—",
      tenantInitials: initials(tenant?.name ?? "?"),
      planLabel: titleCase(tenant?.plan ?? "ORBIT"),
      role: ACRONYM_ROLES.has(ctx.role) ? ctx.role : titleCase(ctx.role),
      activeTenantId: ctx.tenantId,
      tenants: memberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        role: m.role,
      })),
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }
    throw error;
  }
}

// Fonts (Manrope / Space Grotesk / JetBrains Mono) are already loaded on <html>
// by @repo/design-system/lib/fonts — cosmos.css references those vars directly,
// so no duplicate next/font load here.
//
// SCREENS is only imported here (a Server Component) — CosmosShell is
// "use client" and must not import the registry itself, since several
// ported screens are Server Components. Only the plain string keys cross
// the client boundary.
const CosmosLayout = async ({ children }: { children: ReactNode }) => {
  const identity = await resolveIdentity();

  if (!identity) {
    return redirectToSignIn();
  }

  return (
    <CosmosShell identity={identity} screenIds={Object.keys(SCREENS)}>
      {children}
    </CosmosShell>
  );
};

export default CosmosLayout;
