"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { renderInviteEmail, resend } from "@repo/email";
import Fuse from "fuse.js";
import { headers } from "next/headers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenantMemberResult = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  source: "current_tenant";
};

type OtherTenantMemberResult = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  tenantId: string;
  tenantName: string;
  source: "other_tenant";
};

type SearchMembersResult = {
  currentTenant: TenantMemberResult[];
  otherTenants: OtherTenantMemberResult[];
};

// ---------------------------------------------------------------------------
// Function 1: getTenantMembersForSearch
// ---------------------------------------------------------------------------

export async function getTenantMembersForSearch(): Promise<TenantMemberResult[]> {
  const ctx = await requireTenantSession(await headers());

  const memberships = await database.tenantMember.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return memberships.map((m) => ({
    userId: m.user.id,
    name: m.user.name ?? m.user.email,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    source: "current_tenant" as const,
  }));
}

// ---------------------------------------------------------------------------
// Function 2: searchMembersWithCrossTenant
// ---------------------------------------------------------------------------

export async function searchMembersWithCrossTenant(
  query: string
): Promise<SearchMembersResult> {
  const ctx = await requireTenantSession(await headers());

  // Fetch all current tenant members
  const memberships = await database.tenantMember.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  const allCurrentMembers: TenantMemberResult[] = memberships.map((m) => ({
    userId: m.user.id,
    name: m.user.name ?? m.user.email,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    source: "current_tenant" as const,
  }));

  // Short-circuit: no query → return all current members, no cross-tenant search
  if (!query.trim()) {
    return { currentTenant: allCurrentMembers, otherTenants: [] };
  }

  // Fuzzy-search current tenant members
  const fuse = new Fuse(allCurrentMembers, {
    keys: ["name", "email"],
    threshold: 0.4,
  });
  const currentTenant = fuse
    .search(query)
    .map((result) => result.item);

  // Build set of user IDs already in current tenant for exclusion
  const currentTenantUserIds = new Set(allCurrentMembers.map((m) => m.userId));

  // Cross-tenant search: find users by name or email
  const externalUsers = await database.user.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      memberships: {
        include: {
          tenant: { select: { id: true, name: true } },
        },
      },
    },
    take: 10,
  });

  // Exclude users already in current tenant; flatten into per-tenant entries
  const otherTenants: OtherTenantMemberResult[] = [];

  for (const user of externalUsers) {
    if (currentTenantUserIds.has(user.id)) {
      continue;
    }

    for (const membership of user.memberships) {
      otherTenants.push({
        userId: user.id,
        name: user.name ?? user.email,
        email: user.email,
        image: user.image,
        tenantId: membership.tenant.id,
        tenantName: membership.tenant.name,
        source: "other_tenant" as const,
      });
    }
  }

  return { currentTenant, otherTenants };
}

// ---------------------------------------------------------------------------
// Function 3: sendMemberInvite
// ---------------------------------------------------------------------------

type SendMemberInviteInput = {
  email: string;
  name?: string;
};

type SendMemberInviteResult = {
  success: true;
};

export async function sendMemberInvite(
  input: SendMemberInviteInput
): Promise<SendMemberInviteResult> {
  const ctx = await requireTenantSession(await headers());

  // Guard: user already a member?
  const existingMember = await database.tenantMember.findFirst({
    where: {
      tenantId: ctx.tenantId,
      user: { email: input.email },
    },
  });

  if (existingMember) {
    throw new Error("Usuário já é membro deste workspace");
  }

  // Guard: pending invitation already exists?
  const existingInvitation = await database.tenantInvitation.findFirst({
    where: {
      tenantId: ctx.tenantId,
      email: input.email,
      status: "PENDING",
    },
  });

  if (existingInvitation) {
    throw new Error("Convite já enviado para este email");
  }

  const [invitation, tenant] = await Promise.all([
    database.tenantInvitation.create({
      data: {
        tenantId: ctx.tenantId,
        email: input.email,
        role: "MEMBER",
        status: "PENDING",
        inviterId: ctx.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
    database.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { name: true },
    }),
  ]);

  const tenantName = tenant?.name ?? "seu workspace";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3012";
  const fromAddress = process.env.RESEND_FROM ?? "noreply@nebuloz.com";

  // Send invitation email — failure must not block invitation creation
  try {
    const html = await renderInviteEmail({
      inviteeName: input.name,
      workspaceName: tenantName,
      acceptUrl: `${appUrl}/invite/${invitation.id}`,
      expiresInDays: 7,
    });

    await resend.emails.send({
      from: `Cosmos <${fromAddress}>`,
      to: input.email,
      subject: `Você foi convidado para ${tenantName} no Cosmos`,
      html,
    });
  } catch (emailError: unknown) {
    console.error("sendMemberInvite: falha ao enviar email de convite", {
      tenant_id: ctx.tenantId,
      inviter_id: ctx.userId,
      recipient: input.email,
      error: emailError,
    });
  }

  return { success: true };
}
