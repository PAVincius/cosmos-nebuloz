import { getValueStreamDetail } from "@/app/(cosmos)/actions/budgets";
import { ComingSoon } from "../shell";
import ValueStreamDetailClient from "./vs-detail-client";

export default async function ValueStreamDetailScreen({
  param,
}: {
  param?: string;
}) {
  if (!param) {
    return <ComingSoon id="vs" />;
  }
  const res = await getValueStreamDetail(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="vs" />;
  }
  return <ValueStreamDetailClient initial={res.data} />;
}
