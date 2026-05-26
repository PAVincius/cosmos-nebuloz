type Props = {
  epic: {
    id: string;
    title: string;
    investScore: number | null;
    valueStream?: string | null;
  };
  onTransition?: (epicId: string) => void;
};

function InvestScoreDisplay({ score }: { score: number | null }) {
  if (score === null) {
    return null;
  }
  const color =
    score >= 80
      ? "bg-green-100 text-green-800"
      : score >= 50
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${color}`}
    >
      {score}
    </span>
  );
}

export function EpicGovernanceCard({ epic, onTransition }: Props) {
  return (
    <div className="rounded border bg-card p-3 shadow-sm hover:shadow cursor-grab">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight">{epic.title}</h4>
        <InvestScoreDisplay score={epic.investScore} />
      </div>
      {epic.valueStream && (
        <div className="mt-2 text-xs text-muted-foreground">
          VS: {epic.valueStream}
        </div>
      )}
      {onTransition && (
        <button
          type="button"
          onClick={() => onTransition(epic.id)}
          className="mt-2 text-xs text-primary underline"
        >
          Transicionar
        </button>
      )}
    </div>
  );
}
