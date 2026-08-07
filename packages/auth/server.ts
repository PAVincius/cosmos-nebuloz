import "server-only";

import { database } from "@repo/database";

export type { MemberRole } from "@repo/database";

import type { MemberRole } from "@repo/database";

import { log } from "@repo/observability/log";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_IDLE_SECONDS = 24 * 60 * 60; // 24h idle timeout
const SESSION_ABSOLUTE_SECONDS = 7 * 24 * 60 * 60; // 7d absolute max
/** Janela em que uma sessão encerrada ainda é servida pelo cookie assinado.
 *  É o teto do atraso da revogação — e o prazo que o AC-002 pede. */
const SESSION_REVALIDATE_SECONDS = 60;

const _rawSecret = process.env.BETTER_AUTH_SECRET;
if (!_rawSecret || _rawSecret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set and at least 32 characters long"
  );
}
const AUTH_SECRET: string = _rawSecret;

/** Origens aceitas nas requisições de auth, montadas a partir do ambiente.
 *  `VERCEL_URL` é a URL única daquele deploy — é o que faz preview funcionar
 *  sem ninguém cadastrar variável a cada branch. */
const TRUSTED_ORIGINS: string[] = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
  process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
].filter((origin): origin is string => Boolean(origin));

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
    // O `cookieCache` serve a sessão a partir do cookie assinado, sem reler o
    // banco — é o que faz o guard custar duas queries e não três.
    //
    // O `maxAge` era `SESSION_ABSOLUTE_SECONDS`, sete dias: enquanto o cookie
    // valesse, o servidor não relia a linha de `Session`, e apagar essa linha
    // não encerrava nada. Isso transformava o cache em "a sessão inteira" e
    // deixava o sistema **sem nenhuma forma de encerrar uma sessão** — o caso
    // que importa é cookie roubado ou conta comprometida, onde remover
    // permissão não basta porque a permissão não é o problema.
    //
    // 60s é o prazo que o AC-002 já pedia. Custa uma leitura de sessão por
    // pessoa por minuto e devolve a capacidade de expulsar alguém.
    cookieCache: {
      enabled: true,
      maxAge: SESSION_REVALIDATE_SECONDS,
    },
    additionalFields: {
      activeTenantId: {
        type: "string",
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
  // Toda requisição de auth é recusada com "Invalid origin" quando a origem não
  // bate com o baseURL. Isso quebra os previews da Vercel por construção: cada
  // deploy nasce com uma URL própria, que nenhuma variável fixa pode antecipar.
  //
  // As origens saem do ambiente, uma a uma — nada de curinga `*.vercel.app`,
  // que abriria o fluxo de auth para qualquer página hospedada no domínio.
  trustedOrigins: TRUSTED_ORIGINS,
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          log.info("[auth] session.created", {
            userId: session.userId,
            sessionId: session.id,
            expiresAt: session.expiresAt,
            timestamp: new Date().toISOString(),
          });
        },
      },
      delete: {
        after: async (session) => {
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
    try {
      await database.session.update({
        where: { id: session.session.id },
        data: { activeTenantId: tenantId },
      });
    } catch (e: unknown) {
      // P2025 = session row not found by id (stale better-auth cookie-cache id after a
      // session rotation). Persisting activeTenantId here is best-effort — we already have
      // a validated session and a confirmed membership, so proceed rather than deny access.
      const isRecordNotFound =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code: string }).code === "P2025";
      if (!isRecordNotFound) {
        throw e;
      }
    }
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
