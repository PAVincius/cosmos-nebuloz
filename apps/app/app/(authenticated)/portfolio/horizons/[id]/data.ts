// apps/app/app/(authenticated)/portfolio/horizons/[id]/data.ts
//
// GAP: there is no `InvestmentHorizon` / `ValueStream` Prisma model in
// packages/database/prisma/schema/*.prisma yet, and therefore no server
// action to back this screen (see .design-ref/SCREEN_MANIFEST.md #29).
// This stub is the single integration point to swap once that model
// exists — e.g. `getInvestmentHorizonById` in `@/app/actions/lean-budget`.

import type { InvestmentHorizonDetail } from "./types";

export async function getInvestmentHorizonDetail(
  _id: string
): Promise<InvestmentHorizonDetail | null> {
  return null;
}
