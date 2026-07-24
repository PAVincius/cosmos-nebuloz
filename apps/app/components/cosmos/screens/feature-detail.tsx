import { getFeature } from "@/app/(cosmos)/actions/epics";
import { ComingSoon } from "../shell";
import FeatureDetailClient from "./feature-detail-client";

export default async function FeatureDetailScreen({
  param,
}: {
  param?: string;
}) {
  if (!param) {
    return <ComingSoon id="feature" />;
  }
  const res = await getFeature(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="feature" />;
  }
  return <FeatureDetailClient initial={res.data} />;
}
