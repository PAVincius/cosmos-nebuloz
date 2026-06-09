"use server";

// Story-033: Tenant admin — member lifecycle, security policy, bulk invite
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

// ─── Last-admin guard ─────────────────────────────────────────────────────────

async function assertNotLastAdmin(
  tenantId: string,
  memberId: string
): Promise<void> {
  const member = await database.tenantMember.findFirst({
    where: { id: memberId, tenantId },
    select: { role: true },
  });

  if (member?.role !== "ADMIN") {
    return;
  }

  const adminCount = await database.tenantMember.count({
    where: { tenantId, role: "ADMIN" },
  });

  if (adminCount <= 1) {
    const err = new Error("LAST_ADMIN_BLOCKED") as Error & { code: string };
    err.code = "LAST_ADMIN_BLOCKED";
    throw err;
  }
}

// ─── Session revocation ───────────────────────────────────────────────────────

async function revokeUserSessions(userId: string): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return;
  }
  const { redis } = await import("@repo/rate-limit");
  await redis.set(`session:revoked:user:${userId}`, "1", { ex: 86_400 });
}

// ─── Member removal (AC-002/AC-003) ──────────────────────────────────────────

export type RemoveMemberResult =
  | { ok: true }
  | {
      ok: false;
      code: "LAST_ADMIN_BLOCKED" | "NOT_FOUND" | "SELF_REMOVE";
      message: string;
    };

export async function removeMemberSafe(
  memberId: string
): Promise<RemoveMemberResult> {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  const member = await database.tenantMember.findFirst({
    where: { id: memberId, tenantId: ctx.tenantId },
    select: { id: true, role: true, userId: true },
  });

  if (!member) {
    return { ok: false, code: "NOT_FOUND", message: "Member not found" };
  }
  if (member.userId === ctx.userId) {
    return {
      ok: false,
      code: "SELF_REMOVE",
      message: "Cannot remove yourself",
    };
  }

  try {
    await assertNotLastAdmin(ctx.tenantId, memberId);
  } catch {
    return {
      ok: false,
      code: "LAST_ADMIN_BLOCKED",
      message: "Cannot remove the last admin — promote another member first",
    };
  }

  await database.tenantMember.delete({ where: { id: memberId } });

  // AC-002: revoke sessions within 60s via Redis flag
  revokeUserSessions(member.userId).catch((err) => {
    log.error("[removeMemberSafe] session revocation failed", err);
  });

  database.auditLog
    .create({
      data: {
        tenantId: ctx.tenantId,
        action: "access.member.removed",
        actorId: ctx.userId,
        actorType: "user",
        metadata: { memberId, removedUserId: member.userId },
      },
    })
    .catch((err) => {
      log.error("[removeMemberSafe] audit log failed", err);
    });

  revalidatePath("/settings/workspace");
  return { ok: true };
}

// ─── Role change (AC-003) ─────────────────────────────────────────────────────

export type UpdateRoleResult =
  | { ok: true }
  | { ok: false; code: "LAST_ADMIN_BLOCKED" | "NOT_FOUND"; message: string };

export async function updateMemberRoleSafe(
  memberId: string,
  newRole: string
): Promise<UpdateRoleResult> {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  const member = await database.tenantMember.findFirst({
    where: { id: memberId, tenantId: ctx.tenantId },
    select: { id: true, role: true },
  });

  if (!member) {
    return { ok: false, code: "NOT_FOUND", message: "Member not found" };
  }

  // AC-003: if demoting the last ADMIN, block
  if (member.role === "ADMIN" && newRole !== "ADMIN") {
    const adminCount = await database.tenantMember.count({
      where: { tenantId: ctx.tenantId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return {
        ok: false,
        code: "LAST_ADMIN_BLOCKED",
        message: "Cannot remove the last admin — promote another member first",
      };
    }
  }

  await database.tenantMember.update({
    where: { id: memberId },
    data: {
      role: newRole as Parameters<
        typeof database.tenantMember.update
      >[0]["data"]["role"],
    },
  });

  revalidatePath("/settings/workspace");
  return { ok: true };
}

// ─── Bulk invite from CSV (AC-004) ────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BulkInviteRow = { email: string; role?: string };

export type BulkInviteResult = {
  sent: number;
  alreadyMember: string[];
  invalidEmail: string[];
};

export async function bulkInviteMembers(
  rows: BulkInviteRow[]
): Promise<BulkInviteResult> {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  const result: BulkInviteResult = {
    sent: 0,
    alreadyMember: [],
    invalidEmail: [],
  };

  const existingEmails = new Set(
    (
      await database.tenantMember.findMany({
        where: { tenantId: ctx.tenantId },
        include: { user: { select: { email: true } } },
      })
    ).map((m) => m.user.email.toLowerCase())
  );

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      result.invalidEmail.push(email);
      continue;
    }
    if (existingEmails.has(email)) {
      result.alreadyMember.push(email);
      continue;
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await database.tenantInvitation.create({
      data: {
        tenantId: ctx.tenantId,
        email,
        role: (row.role ?? "MEMBER") as Parameters<
          typeof database.tenantInvitation.create
        >[0]["data"]["role"],
        inviterId: ctx.userId,
        expiresAt,
      },
    });
    result.sent += 1;
  }

  return result;
}

// ─── Security policy (AC-006/AC-008) ─────────────────────────────────────────

const SecurityPolicySchema = z.object({
  require2FA: z.boolean().optional(),
  gracePeriodDays: z.number().int().min(0).max(90).optional(),
  allowedIpRanges: z.array(z.string()).optional(),
  terminologyMap: z.record(z.string()).optional(),
});

export type SecurityPolicyInput = z.infer<typeof SecurityPolicySchema>;

export async function upsertSecurityPolicy(
  input: SecurityPolicyInput
): Promise<void> {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  const parsed = SecurityPolicySchema.parse(input);

  await database.tenantSecurityPolicy.upsert({
    where: { tenantId: ctx.tenantId },
    create: {
      tenantId: ctx.tenantId,
      require2FA: parsed.require2FA ?? false,
      gracePeriodDays: parsed.gracePeriodDays ?? 7,
      allowedIpRanges: parsed.allowedIpRanges ?? [],
      terminologyMap: parsed.terminologyMap ?? null,
      updatedBy: ctx.userId,
    },
    update: {
      ...(parsed.require2FA !== undefined && { require2FA: parsed.require2FA }),
      ...(parsed.gracePeriodDays !== undefined && {
        gracePeriodDays: parsed.gracePeriodDays,
      }),
      ...(parsed.allowedIpRanges !== undefined && {
        allowedIpRanges: parsed.allowedIpRanges,
      }),
      ...(parsed.terminologyMap !== undefined && {
        terminologyMap: parsed.terminologyMap,
      }),
      updatedBy: ctx.userId,
    },
  });

  revalidatePath("/settings/security");
}
