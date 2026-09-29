"use server";

import type { RankedGap } from "@/lib/meridian/gap-ranking";
import { listRankedGaps } from "@/lib/meridian/ranked-gaps";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";

// Gaps reais do Meridian para a "Nova trilha" (X-03, PDF p.3).
//
// O gap é do Meridian (mapa de fronteiras, entidade 6): o Scaffold só lê. A
// leitura pede `track.manage`, a mesma permissão de criar a trilha, e o tenant
// vem da sessão. Quem promove o gap para o Scaffold é o Meridian; aqui só se
// escolhe um gap já promovido e cria a trilha por `createTrackFromGap`.

export async function listScaffoldGaps(): Promise<ScaffoldResult<RankedGap[]>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("track.manage");
    return listRankedGaps(ctx);
  });
}
