"use server";

// settings-safe.ts — Configuração SAFe tab (Settings screen, tab 6). Two
// real, already-modelled things: per-ART cadence (ART.piCadenceWeeks/
// sprintLengthWeeks) and the tenant-wide WsjfSettings row. Cadence writes
// reuse app/actions/arts/lifecycle.ts::updateARTCadence verbatim (ADMIN|RTE
// gated, blocks edits while a PI Plan is COMMITTED/EXECUTING) — it already
// returns Result<T>, so it's re-exported rather than re-wrapped. WSJF reads/
// writes go through the new app/actions/settings/wsjf-settings.ts.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import { updateARTCadence } from "../../actions/arts/lifecycle";
import {
  getWsjfSettings,
  upsertWsjfSettings,
  type WsjfSettingsData,
} from "../../actions/settings/wsjf-settings";

export type ArtCadenceView = {
  id: string;
  name: string;
  status: string;
  piCadenceWeeks: number;
  sprintLengthWeeks: number;
  ipSprintEnabled: boolean;
};

export type SafeConfigTabView = {
  arts: ArtCadenceView[];
  wsjf: WsjfSettingsData;
  currentUserRole: string;
};

export async function getSafeConfigTab(): Promise<Result<SafeConfigTabView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const [arts, wsjf] = await Promise.all([
      database.aRT.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          piCadenceWeeks: true,
          sprintLengthWeeks: true,
          ipSprintEnabled: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      getWsjfSettings(),
    ]);

    return { arts, wsjf, currentUserRole: ctx.role };
  });
}

export { updateARTCadence as saveArtCadenceAction };

export async function saveWsjfSettingsAction(
  raw: unknown
): Promise<Result<{ updated: true }>> {
  return safeAction(async () => {
    await upsertWsjfSettings(raw);
    return { updated: true as const };
  });
}
