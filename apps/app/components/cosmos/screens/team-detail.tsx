import { getTeam } from "@/app/(cosmos)/actions/teams";
import { ComingSoon } from "../shell";
import TeamDetailClient from "./team-detail-client";

export default async function TeamDetailScreen({ param }: { param?: string }) {
  if (!param) {
    return <ComingSoon id="team" />;
  }
  const res = await getTeam(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="team" />;
  }
  return <TeamDetailClient initial={res.data} />;
}
