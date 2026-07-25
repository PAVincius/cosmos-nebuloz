import { SCREENS } from "@/components/cosmos/screens/registry";
import { ComingSoon } from "@/components/cosmos/shell";

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
