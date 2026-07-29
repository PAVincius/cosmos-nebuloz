"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import {
  getWorkspaceSettings as getMatureWorkspaceSettings,
  updateWorkspace,
} from "../../actions/settings/workspace";

export type WorkspaceSettingsView = {
  members: { id: string; userName: string; userEmail: string; role: string }[];
  ssoEnabled: boolean;
};

export async function getWorkspaceSettings(): Promise<
  Result<WorkspaceSettingsView>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const [members, sso] = await Promise.all([
      database.tenantMember.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          role: true,
          user: { select: { name: true, email: true } },
        },
      }),
      // SECURITY: only `enabled` is selected — never idpMetadataUrl/idpCertificate/idpEntityId.
      database.tenantSSOConfig.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { enabled: true },
      }),
    ]);

    return {
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        userName: m.user.name ?? "—",
        userEmail: m.user.email,
      })),
      ssoEnabled: sso?.enabled ?? false,
    };
  });
}

// ─── Workspace tab (Settings screen, tab 1) ────────────────────────────────
// Wraps app/actions/settings/workspace.ts::getWorkspaceSettings/
// updateWorkspace — the mature layer already gates updateWorkspace to
// ADMIN; this file only adapts the throw-on-error contract to Result<T> so
// the screen can use the shared useAction/useActionToast hooks.

export type WorkspaceTabView = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    plan: string;
    createdAt: string;
  };
  membersCount: number;
  currentUserRole: string;
};

export async function getWorkspaceTab(): Promise<Result<WorkspaceTabView>> {
  return safeAction(async () => {
    const data = await getMatureWorkspaceSettings();
    return {
      tenant: {
        id: data.tenant.id,
        name: data.tenant.name,
        slug: data.tenant.slug,
        logo: data.tenant.logo,
        plan: data.tenant.plan,
        createdAt: data.tenant.createdAt.toISOString(),
      },
      membersCount: data.membersCount,
      currentUserRole: data.currentUserRole,
    };
  });
}

export type UpdateWorkspaceInfoInput = {
  name?: string;
  slug?: string;
  logo?: string;
};

export async function updateWorkspaceInfo(
  input: UpdateWorkspaceInfoInput
): Promise<Result<{ updated: true }>> {
  return safeAction(async () => {
    await updateWorkspace(input);
    return { updated: true as const };
  });
}
