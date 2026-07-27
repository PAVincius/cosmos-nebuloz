import type {
  ApprovalRequestWithSteps,
  GovernedEpicWithDetails,
} from "@/app/actions/governance/schema";
import { GovernanceEpicRow } from "./governance-epic-row";

type Props = {
  epics: GovernedEpicWithDetails[];
  requests: ApprovalRequestWithSteps[];
};

export function GovernanceEpicList({ epics, requests }: Props) {
  const requestByEpicId = new Map(
    requests
      .filter((r) => r.governedEpicId !== null)
      .map((r) => [r.governedEpicId as string, r])
  );

  if (epics.length === 0) {
    return (
      <p className="py-10 text-center text-[13px] text-ink-muted">
        Nenhum épico sob governança.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {epics.map((epic) => (
        <GovernanceEpicRow
          epic={epic}
          key={epic.id}
          request={requestByEpicId.get(epic.id) ?? null}
        />
      ))}
    </div>
  );
}
