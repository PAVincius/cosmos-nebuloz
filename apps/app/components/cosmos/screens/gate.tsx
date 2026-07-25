import { getGovernedEpicDetail } from "@/app/(cosmos)/actions/governance";
import { ComingSoon } from "../shell";
import GateDetailClient from "./gate-detail-client";

// gate.tsx — per-epic Governance Gate detail (RF §2.18), param route
// mirroring epic-detail.tsx: param is the Epic id. Backed by the existing
// GovernedEpic + ApprovalWorkflow/ApprovalRequest/ApprovalStepInstance
// models (apps/app/app/actions/governance) — no new modelling, see
// gate-detail-client.tsx for the divergence from the handoff's per-criterion
// checklist.
export default async function GateScreen({ param }: { param?: string }) {
  if (!param) {
    return <ComingSoon id="gate" />;
  }
  const res = await getGovernedEpicDetail(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="gate" />;
  }
  return <GateDetailClient epicId={param} initial={res.data} />;
}
