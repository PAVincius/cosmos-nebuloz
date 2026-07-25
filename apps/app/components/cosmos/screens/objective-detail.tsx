import { getObjectiveDetail } from "@/app/(cosmos)/actions/objective-detail";
import { getTenantMembersForSearch } from "@/app/actions/teams/members";
import { ComingSoon } from "../shell";
import ObjectiveDetailClient from "./objective-detail-client";

export default async function ObjectiveDetailScreen({
  param,
}: {
  param?: string;
}) {
  if (!param) {
    return <ComingSoon id="okr" />;
  }
  const [res, owners] = await Promise.all([
    getObjectiveDetail(param),
    getTenantMembersForSearch(),
  ]);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="okr" />;
  }
  return (
    <ObjectiveDetailClient
      initial={res.data}
      objectiveId={param}
      owners={owners.map((o) => ({ id: o.userId, name: o.name }))}
    />
  );
}
