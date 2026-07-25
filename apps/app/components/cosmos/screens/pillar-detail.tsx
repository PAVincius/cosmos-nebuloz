import { getStrategyPillar } from "@/app/(cosmos)/actions/strategy";
import { ComingSoon } from "../shell";
import PillarDetailClient from "./pillar-detail-client";

export default async function PillarDetailScreen({
  param,
}: {
  param?: string;
}) {
  if (!param) {
    return <ComingSoon id="pillar" />;
  }
  const res = await getStrategyPillar(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="pillar" />;
  }
  return <PillarDetailClient initial={res.data} />;
}
