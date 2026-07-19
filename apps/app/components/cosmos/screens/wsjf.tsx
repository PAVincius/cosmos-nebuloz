// wsjf.tsx — WSJF Rankings (portfolio prioritization table), ported from the
// cosmos handoff. Ranked backlog with rank-movement deltas, glossary terms,
// and AI rebalance / scenario-simulator modals (light versions).
import { listWsjfItems } from "@/app/(cosmos)/actions/wsjf";
import { WsjfInner } from "./wsjf-client";

export default async function WsjfScreen() {
  const itemsResult = await listWsjfItems();
  const items = itemsResult.ok ? itemsResult.data : [];

  return <WsjfInner items={items} />;
}
