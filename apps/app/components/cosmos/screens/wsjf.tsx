// wsjf.tsx — WSJF Rankings (portfolio prioritization table), ported from the
// cosmos handoff. Ranked backlog with glossary terms, and AI rebalance /
// scenario-simulator modals (light versions). Also loads tenant WsjfSettings
// (Task 16) so WsjfSettingsModal opens pre-filled.
import { getWsjfSettings, listWsjfItems } from "@/app/(cosmos)/actions/wsjf";
import { WsjfInner } from "./wsjf-client";

// Fallback if getWsjfSettings() itself errors (e.g. transient DB issue) —
// mirrors the defaults getWsjfSettings returns when no row exists. That file
// has "use server" and can't export this constant directly.
const WSJF_SETTINGS_DEFAULTS = {
  weightBv: 1,
  weightTc: 1,
  weightRr: 1,
  scale: "fibonacci" as const,
  autoRecalc: "daily" as const,
  rebalanceApprover: "rte" as const,
  staleDays: 14,
};

export default async function WsjfScreen() {
  const [itemsResult, settingsResult] = await Promise.all([
    listWsjfItems(),
    getWsjfSettings(),
  ]);
  const items = itemsResult.ok ? itemsResult.data : [];
  const settings = settingsResult.ok
    ? settingsResult.data
    : WSJF_SETTINGS_DEFAULTS;

  return <WsjfInner items={items} settings={settings} />;
}
