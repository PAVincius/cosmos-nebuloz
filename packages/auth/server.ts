import "server-only";

import { database } from "@repo/database";

export type { MemberRole } from "@repo/database";

import { log } from "@repo/observability/log";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_IDLE_SECONDS = 24 * 60 * 60; // 24h idle timeout
const SESSION_ABSOLUTE_SECONDS = 7 * 24 * 60 * 60; // 7d absolute max

const _rawSecret = process.env.BETTER_AUTH_SECRET;
if (!_rawSecret || _rawSecret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set and at least 32 characters long"
  );
}
const AUTH_SECRET: string = _rawSecret;

export const auth = betterAuth({
  database: prismaAdapter(database, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12, // SOC2 CC6: min 12 chars
  },
  session: {
    expiresIn: SESSION_IDLE_SECONDS,
    updateAge: SESSION_IDLE_SECONDS / 2,
    cookieCache: {
      enabled: true,
      maxAge: SESSION_ABSOLUTE_SECONDS,
    },
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
  secret: AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  databaseHooks: {
    session: {
      create: {
        after: (session) => {
          log.info("[auth] session.created", {
            userId: session.userId,
            sessionId: session.id,
            expiresAt: session.expiresAt,
            timestamp: new Date().toISOString(),
          });
        },
      },
      delete: {
        after: (session) => {
          log.info("[auth] session.deleted", {
            userId: (session as { userId?: string }).userId ?? "unknown",
            sessionId: session.id,
            timestamp: new Date().toISOString(),
          });
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;

export type TenantContext = {
  userId: string;
  tenantId: string;
  role: MemberRole;
  user: AuthUser;
};

export class AuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "NO_ACTIVE_ORGANIZATION";

  constructor(
    code: "UNAUTHORIZED" | "FORBIDDEN" | "NO_ACTIVE_ORGANIZATION",
    message?: string
  ) {
    super(message ?? code);
    this.name = "AuthError";
    this.code = code;
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

const MFA_REQUIRED_ROLES: MemberRole[] = ["ADMIN", "STE"];

/**
 * SOC2 CC6.2 — MFA is mandatory for privileged roles (OWNER, ADMIN, STE).
 * Throws FORBIDDEN with a redirect hint if MFA is not verified on this session.
 */
export async function requireMfaForPrivilegedRoles(
  ctx: TenantContext,
  reqHeaders: Headers
): Promise<void> {
  if (!MFA_REQUIRED_ROLES.includes(ctx.role)) {
    return;
  }

  const user = await database.user.findUnique({
    where: { id: ctx.userId },
    select: { twoFactorEnabled: true },
  });

  if (!user?.twoFactorEnabled) {
    throw new AuthError(
      "FORBIDDEN",
      "MFA is required for your role. Please enable two-factor authentication."
    );
  }

  const session = await auth.api.getSession({ headers: reqHeaders });
  const sessionData = session?.session as
    | { twoFactorVerified?: boolean }
    | undefined;
  if (!sessionData?.twoFactorVerified) {
    throw new AuthError(
      "FORBIDDEN",
      "MFA verification required. Please complete two-factor authentication."
    );
  }
}
