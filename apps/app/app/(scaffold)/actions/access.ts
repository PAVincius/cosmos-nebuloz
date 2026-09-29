"use server";

import type { ScaffoldRole } from "@repo/database";
import {
  hasScaffoldPermission,
  SCAFFOLD_PERMISSIONS,
  type ScaffoldPermission,
  scaffoldDenialReason,
} from "@repo/rbac";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import { requireScaffoldContext } from "@/lib/scaffold/guards";

// O que a pessoa pode fazer no Scaffold, para a tela desabilitar o controle com
// o motivo escrito em vez de oferecê-lo e derrubar a tela na recusa. Quem
// decide continua sendo o servidor: cada action repete o guard.

export type PermissionView = { allowed: boolean; reason: string | null };

export type ScaffoldAccess = {
  role: ScaffoldRole;
  can: Record<ScaffoldPermission, PermissionView>;
};

export async function getScaffoldAccess(): Promise<
  ScaffoldResult<ScaffoldAccess>
> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldContext();
    const can = {} as Record<ScaffoldPermission, PermissionView>;
    for (const p of SCAFFOLD_PERMISSIONS) {
      const allowed = hasScaffoldPermission(ctx.scaffoldRole, p);
      can[p] = { allowed, reason: allowed ? null : scaffoldDenialReason(p) };
    }
    return { role: ctx.scaffoldRole, can };
  });
}
