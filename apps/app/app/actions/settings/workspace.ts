"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import type { MemberRole } from "@repo/database";
import { database } from "@repo/database";
import { renderInviteEmail, resend } from "@repo/email";
import { log } from "@repo/observability/log";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { logAudit } from "../audit/log-audit";

export async function getWorkspaceSettings() {
  const ctx = await requireTenantSession(await headers());

  const [tenant, membersCount, members, invitations] = await Promise.all([
    database.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        plan: true,
        createdAt: true,
      },
    }),
    database.tenantMember.count({ where: { tenantId: ctx.tenantId } }),
    database.tenantMember.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    database.tenantInvitation.findMany({
      where: { tenantId: ctx.tenantId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!tenant) {
    throw new Error("Workspace não encontrado.");
  }

  return {
    tenant,
    membersCount,
    members,
    invitations,
    currentUserRole: ctx.role,
  };
}

export async function updateWorkspace(input: {
  name?: string;
  slug?: string;
  logo?: string;
}) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  await database.tenant.update({
    where: { id: ctx.tenantId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.slug !== undefined && {
        slug: input.slug.trim().toLowerCase(),
      }),
      ...(input.logo !== undefined && { logo: input.logo || null }),
    },
  });

  void logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "updated",
    entityType: "TENANT",
    entityId: ctx.tenantId,
    diff: input,
  });

  revalidatePath("/settings/workspace");
}

export async function inviteMember(email: string, role: MemberRole) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  if (!email?.trim()) {
    throw new Error("Email é obrigatório.");
  }

  // Check if already a member
  const existingUser = await database.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });

  if (existingUser) {
    const existingMember = await database.tenantMember.findFirst({
      where: { tenantId: ctx.tenantId, userId: existingUser.id },
    });
    if (existingMember) {
      throw new Error("Usuário já é membro deste workspace.");
    }
  }

  // Cancel existing pending invitations for this email
  await database.tenantInvitation.updateMany({
    where: {
      tenantId: ctx.tenantId,
      email: email.trim().toLowerCase(),
      status: "PENDING",
    },
    data: { status: "CANCELED" },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const [invitation, tenant, inviter] = await Promise.all([
    database.tenantInvitation.create({
      data: {
        tenantId: ctx.tenantId,
        email: email.trim().toLowerCase(),
        role,
        status: "PENDING",
        expiresAt,
        inviterId: ctx.userId,
      },
    }),
    database.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true },
    }),
    database.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    }),
  ]);

  const workspaceName = tenant?.name ?? "seu workspace";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3012";
  const fromAddress = process.env.RESEND_FROM ?? "noreply@nebuloz.ai";

  try {
    const html = await renderInviteEmail({
      inviterName: inviter?.name ?? undefined,
      workspaceName,
      acceptUrl: `${appUrl}/invite/${invitation.id}`,
      expiresInDays: 7,
    });

    await resend.emails.send({
      from: `Cosmos <${fromAddress}>`,
      to: email.trim().toLowerCase(),
      subject: `Você foi convidado para ${workspaceName} no Cosmos`,
      html,
    });
  } catch (emailError: unknown) {
    log.error("inviteMember: falha ao enviar email", {
      tenant_id: ctx.tenantId,
      inviter_id: ctx.userId,
      recipient: email,
      error: emailError,
    });
  }

  void logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "created",
    entityType: "MEMBER_INVITATION",
    entityId: invitation.id,
    diff: { email: email.trim().toLowerCase(), role },
  });

  revalidatePath("/settings/workspace");
}

export async function removeMember(memberId: string) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  const member = await database.tenantMember.findFirst({
    where: { id: memberId, tenantId: ctx.tenantId },
    select: { id: true, role: true, userId: true },
  });

  if (!member) {
    throw new Error("Membro não encontrado.");
  }
  if (member.userId === ctx.userId) {
    throw new Error("Você não pode remover a si mesmo.");
  }

  // Prevent removing last ADMIN
  if (member.role === "ADMIN") {
    const adminCount = await database.tenantMember.count({
      where: { tenantId: ctx.tenantId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new Error("Não é possível remover o último administrador.");
    }
  }

  await database.tenantMember.delete({ where: { id: memberId } });

  void logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "deleted",
    entityType: "TENANT_MEMBER",
    entityId: memberId,
    diff: { removedUserId: member.userId, removedRole: member.role },
  });

  revalidatePath("/settings/workspace");
  revalidatePath("/settings/members");
}

export async function updateMemberRole(memberId: string, role: MemberRole) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  const member = await database.tenantMember.findFirst({
    where: { id: memberId, tenantId: ctx.tenantId },
    select: { id: true, role: true },
  });

  if (!member) {
    throw new Error("Membro não encontrado.");
  }

  // Prevent downgrading if last admin
  if (member.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await database.tenantMember.count({
      where: { tenantId: ctx.tenantId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new Error("Não é possível rebaixar o último administrador.");
    }
  }

  await database.tenantMember.update({
    where: { id: memberId },
    data: { role },
  });

  void logAudit(ctx.tenantId, {
    userId: ctx.userId,
    action: "updated",
    entityType: "TENANT_MEMBER",
    entityId: memberId,
    diff: { previousRole: member.role, newRole: role },
  });

  revalidatePath("/settings/workspace");
  revalidatePath("/settings/members");
}

export async function cancelInvitation(invitationId: string) {
  const ctx = await requireTenantSession(await headers());
  requireRole(["ADMIN"], ctx);

  await database.tenantInvitation.updateMany({
    where: { id: invitationId, tenantId: ctx.tenantId },
    data: { status: "CANCELED" },
  });

  revalidatePath("/settings/workspace");
}
