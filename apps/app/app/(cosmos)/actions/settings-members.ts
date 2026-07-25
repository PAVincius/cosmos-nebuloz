"use server";

// settings-members.ts — Membros / RBAC tab (Settings screen, tab 2). Real
// TenantMember list via app/actions/teams/members.ts::getTenantMembersForSearch
// (already tenant-scoped). Mutations are wired to the mature layer, picked
// deliberately for their RBAC gate rather than by name match:
//   - invite: app/actions/settings/workspace.ts::inviteMember — ADMIN
//     gated. NOT members.ts::sendMemberInvite, which has no requireRole
//     call at all (any authenticated tenant member could invite) — using
//     the ungated one here would violate "member invite is ADMIN-gated".
//   - role change / removal: app/actions/settings/admin-settings.ts's
//     updateMemberRoleSafe / removeMemberSafe — ADMIN gated, with the
//     last-admin guard and (for removal) session revocation + audit log
//     already built in (Story-033 AC-002/AC-003).
// No RBAC matrix — no permissions-policy.ts or similar exists in the repo
// (checked), so this is a role-labelled member list, not a fabricated
// permission grid.
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import {
  removeMemberSafe,
  updateMemberRoleSafe,
} from "../../actions/settings/admin-settings";
import { inviteMember } from "../../actions/settings/workspace";
import { getTenantMembersForSearch } from "../../actions/teams/members";

const MemberRoleSchema = z.enum([
  "ADMIN",
  "STE",
  "RTE",
  "SM",
  "PO",
  "DEV",
  "MEMBER",
]);

export type MembersTabView = {
  members: {
    userId: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
  }[];
  currentUserRole: string;
  currentUserId: string;
};

export async function getMembersTab(): Promise<Result<MembersTabView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const members = await getTenantMembersForSearch();
    return {
      members,
      currentUserRole: ctx.role,
      currentUserId: ctx.userId,
    };
  });
}

export async function inviteMemberAction(
  raw: unknown
): Promise<Result<{ invited: true }>> {
  return safeAction(async () => {
    const input = z
      .object({ email: z.string().email(), role: MemberRoleSchema })
      .parse(raw);
    await inviteMember(input.email, input.role);
    return { invited: true as const };
  });
}

export async function updateMemberRoleAction(
  memberId: string,
  role: string
): Promise<Result<{ updated: true }>> {
  return safeAction(async () => {
    const parsedRole = MemberRoleSchema.parse(role);
    const res = await updateMemberRoleSafe(memberId, parsedRole);
    if (!res.ok) {
      throw new Error(res.message);
    }
    return { updated: true as const };
  });
}

export async function removeMemberAction(
  memberId: string
): Promise<Result<{ removed: true }>> {
  return safeAction(async () => {
    const res = await removeMemberSafe(memberId);
    if (!res.ok) {
      throw new Error(res.message);
    }
    return { removed: true as const };
  });
}
