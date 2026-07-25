import { getEpicDetailFull } from "@/app/(cosmos)/actions/epic-detail";
import { ComingSoon } from "../shell";
import EpicDetailClient from "./epic-detail-client";

export default async function EpicDetailScreen({ param }: { param?: string }) {
  if (!param) {
    return <ComingSoon id="epic" />;
  }
  const res = await getEpicDetailFull(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="epic" />;
  }
  return <EpicDetailClient epicId={param} initial={res.data} />;
}
