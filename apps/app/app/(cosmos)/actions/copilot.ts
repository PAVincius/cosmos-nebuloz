"use server";

// copilot.ts — thin tenant-scoped bootstrap for the copilot screen. The chat
// pipeline itself (streaming, RAG, tools, sessions, quota) already lives in
// api/copilot/chat/route.ts + app/actions/safe-copilot/*; this only resolves
// the current user's SAFe role so the client can show the right suggested
// topic chips (ROLE_CHIPS, previously computed but never surfaced in any UI).
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import { detectPrimaryRole } from "../../actions/safe-copilot/roles/detect-role";
import {
  ROLE_CHIPS,
  type SuggestedChip,
} from "../../actions/safe-copilot/roles/role-chips";

export type CopilotBootstrap = {
  role: string;
  chips: SuggestedChip[];
};

export async function getCopilotBootstrap(): Promise<Result<CopilotBootstrap>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const role = detectPrimaryRole([ctx.role]);
    return { role, chips: ROLE_CHIPS[role] };
  });
}
