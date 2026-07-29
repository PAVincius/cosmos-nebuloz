// apps/app/app/(authenticated)/portfolio/value-streams/[id]/data.ts
//
// Data source for the Value Stream Detail screen. GAP: `ValueStream` /
// `InvestmentHorizon` have no Prisma model yet (packages/database/prisma/
// schema/*.prisma) — mirrors the sibling
// `portfolio/horizons/[id]/data.ts` stub until the Lean Budget schema lands.
// The page renders the empty state via `EmptyState` in ./components/
// value-stream-detail.tsx until this resolves to real data.

import type { ValueStreamDetail } from "./types";

export async function getValueStreamDetail(
  _id: string
): Promise<ValueStreamDetail | null> {
  return null;
}
