import "server-only";

import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { database } from "@repo/database";
import type { MemberRole } from "@repo/database";

export const auth = betterAuth({
  database: prismaAdapter(database, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    additionalFields: {
      activeTenantId: {
        type: "string",
        nullable: true,
        // Server-only: tenant changes go through POST /api/auth/switch-tenant (membership check).
        input: false,
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "Cosmos",
      otpOptions: { digits: 6 },
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
export type { MemberRole };

export type TenantContext = {
  userId: string;
  tenantId: string;
  role: MemberRole;
  user: AuthUser;
};

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "NO_ACTIVE_ORGANIZATION",
    message?: string
  ) {
    super(message ?? code);
    this.name = "AuthError";
  }
}

export async function currentUser() {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });
  return session?.user ?? null;
}

export function redirectToSignIn(): never {
  return redirect("/sign-in");
}

export async function getOrgId(): Promise<string | null> {
  try {
    const ctx = await requireTenantSession(await nextHeaders());
    return ctx.tenantId;
  } catch {
    return null;
  }
}

export async function requireTenantSession(
  headers: Headers
): Promise<TenantContext> {
  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw new AuthError("UNAUTHORIZED");
  }

  let tenantId = (
    session.session as unknown as { activeTenantId?: string | null }
  ).activeTenantId;

  if (!tenantId) {
    const firstMember = await database.tenantMember.findFirst({
      where: { userId: session.user.id },
      select: { tenantId: true, role: true },
    });
    if (!firstMember) {
      throw new AuthError("NO_ACTIVE_ORGANIZATION");
    }
    tenantId = firstMember.tenantId;
    await database.session.update({
      where: { id: session.session.id },
      data: { activeTenantId: tenantId },
    });
    return {
      userId: session.user.id,
      tenantId,
      role: firstMember.role,
      user: session.user as AuthUser,
    };
  }

  // Load role — single indexed lookup, negligible overhead
  const member = await database.tenantMember.findFirst({
    where: { tenantId, userId: session.user.id },
    select: { role: true },
  });

  if (!member) {
    throw new AuthError("FORBIDDEN", "User is not a member of this tenant");
  }

  return {
    userId: session.user.id,
    tenantId,
    role: member.role,
    user: session.user as AuthUser,
  };
}

/**
 * Throws FORBIDDEN if the caller's role is not in allowedRoles.
 * Usage: requireRole(["RTE", "STE", "ADMIN"], ctx)
 */
export function requireRole(
  allowedRoles: MemberRole[],
  ctx: TenantContext
): void {
  if (!allowedRoles.includes(ctx.role)) {
    throw new AuthError(
      "FORBIDDEN",
      `Role ${ctx.role} not permitted. Required: ${allowedRoles.join(" | ")}`
    );
  }
}
