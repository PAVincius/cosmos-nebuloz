import type { Metadata } from "next";
import { SCREENS } from "@/components/cosmos/screens/registry";
import { ComingSoon, TITLES } from "@/components/cosmos/shell";

// Every /cosmos screen shares this one route, so none of them had a <title> —
// axe flags that on all of them, and every browser tab read "localhost:3012".
// TITLES already maps a screen id to the label the breadcrumb renders.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}): Promise<Metadata> {
  const { seg } = await params;
  const id = seg?.[0] ?? "dashboard";
  const [title, parent] = TITLES[id] ?? [id, "COSMOS"];
  return { title: `${title} | ${parent} · COSMOS` };
}

// Single dynamic route for every /cosmos/<id> screen. Ported screens come from
// the registry; anything else renders <ComingSoon>. seg[1] is an optional detail
// param (e.g. /cosmos/epic/EP-097).
export default async function CosmosScreenPage({
  params,
}: {
  params: Promise<{ seg?: string[] }>;
}) {
  const { seg } = await params;
  const id = seg?.[0] ?? "dashboard";
  const param = seg?.[1];
  const Screen = SCREENS[id];
  return Screen ? <Screen param={param} /> : <ComingSoon id={id} />;
}
