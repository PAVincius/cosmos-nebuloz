"use server";

import { logSecurityEvent } from "@repo/audit";
import { headers } from "next/headers";
import { auth } from "./server";

type SessionActiveTenant = { activeTenantId?: string | null };

async function getSessionContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  return {
    userId: session?.user.id,
    tenantId:
      (session?.session as unknown as SessionActiveTenant).activeTenantId ??
      undefined,
  };
}

export async function logLoginSuccess(email: string): Promise<void> {
  try {
    const ctx = await getSessionContext();
    await logSecurityEvent({
      action: "auth.login.success",
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      metadata: { email },
    });
  } catch {
    // Non-blocking: audit failure must not break auth
  }
}

export async function logLoginFailure(email: string): Promise<void> {
  try {
    await logSecurityEvent({
      action: "auth.login.failure",
      metadata: { email, reason: "invalid_credentials" },
    });
  } catch {
    // Non-blocking: audit failure must not break auth
  }
}

export async function logMfaVerified(): Promise<void> {
  try {
    const ctx = await getSessionContext();
    await logSecurityEvent({
      action: "auth.mfa.verified",
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    });
  } catch {
    // Non-blocking: audit failure must not break auth
  }
}

export async function logMfaFailed(): Promise<void> {
  try {
    const ctx = await getSessionContext();
    await logSecurityEvent({
      action: "auth.mfa.failed",
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      reason: "invalid_totp_code",
    });
  } catch {
    // Non-blocking: audit failure must not break auth
  }
}

export async function logLogout(): Promise<void> {
  try {
    const ctx = await getSessionContext();
    await logSecurityEvent({
      action: "auth.logout",
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    });
  } catch {
    // Non-blocking: audit failure must not break auth
  }
}
