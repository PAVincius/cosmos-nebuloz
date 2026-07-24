import { getInvestmentHorizon } from "@/app/(cosmos)/actions/horizons";
import { ComingSoon } from "../shell";
import HorizonDetailClient from "./horizon-detail-client";

export default async function HorizonDetailScreen({
  param,
}: {
  param?: string;
}) {
  if (!param) {
    return <ComingSoon id="horizon" />;
  }
  const res = await getInvestmentHorizon(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="horizon" />;
  }
  return <HorizonDetailClient initial={res.data} />;
}
