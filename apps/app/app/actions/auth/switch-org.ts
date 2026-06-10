"use server";

import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import { invalidatePermissionCache } from "@/lib/rbac/resolve";
import { err, ok, type Result, toActionError } from "../_base";

const SwitchOrgSchema = z.object({
  targetTenantId: z.string().cuid(),
});

export type SwitchOrgResult = {
  tenantId: string;
  role: string;
};

export async function switchOrg(
  raw: unknown
): Promise<Result<SwitchOrgResult>> {
  try {
    const { targetTenantId } = SwitchOrgSchema.parse(raw);

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return err("UNAUTHORIZED", "UNAUTHORIZED");
    }

    const membership = await database.tenantMember.findFirst({
      where: { userId: session.user.id, tenantId: targetTenantId },
      select: { role: true, tenantId: true },
    });

    if (!membership) {
      return err("User is not a member of this organization", "FORBIDDEN");
    }

    await database.session.update({
      where: { id: session.session.id },
      data: { activeTenantId: targetTenantId },
    });

    await invalidatePermissionCache(targetTenantId, session.user.id).catch(
      () => null
    );

    return ok({ tenantId: targetTenantId, role: membership.role });
  } catch (e) {
    return err(toActionError(e));
  }
}
