"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

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
