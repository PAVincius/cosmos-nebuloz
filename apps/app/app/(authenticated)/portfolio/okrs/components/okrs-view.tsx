import type { OKRTraceabilityNode, OKRWithContext } from "@/app/actions/okrs";
import { OKRsDashboard } from "./okrs-dashboard";
import { OKRTraceabilityView } from "./okr-traceability-view";

type PIOption = { id: string; name: string };

type Props = {
  initialOKRs: OKRWithContext[];
  piPlans: PIOption[];
  traceability: OKRTraceabilityNode[];
};

// Mirrors cosmos.html's OkrsScreen (screen-okrs.jsx): dashboard and
// traceability are stacked sections, not a mutually-exclusive toggle.
export function OKRsView({ initialOKRs, piPlans, traceability }: Props) {
  return (
    <div className="space-y-8">
      <OKRsDashboard initialOKRs={initialOKRs} piPlans={piPlans} />
      <OKRTraceabilityView nodes={traceability} />
    </div>
  );
}
