type CapabilityEntry = { deliveredSp: number; confidenceLevel: number };

type TeamRow = {
  id: string;
  name: string;
  capabilities: Partial<Record<string, CapabilityEntry>>;
};

type Props = {
  teams: TeamRow[];
  taskTypes: readonly string[];
};

export function CapabilityMatrix({ teams, taskTypes }: Props) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left font-medium text-muted-foreground">Time</th>
            {taskTypes.map((t) => (
              <th key={t} className="p-2 text-center font-medium capitalize text-muted-foreground">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.id} className="border-t">
              <td className="p-2 font-medium">{team.name}</td>
              {taskTypes.map((t) => {
                const cap = team.capabilities[t];
                const score = cap ? cap.deliveredSp * cap.confidenceLevel : 0;
                const intensity = Math.min(1, score / 50);
                return (
                  <td
                    key={t}
                    className="p-2 text-center text-xs"
                    style={{ backgroundColor: `rgba(99, 102, 241, ${intensity * 0.6})` }}
                  >
                    {cap ? Math.round(cap.deliveredSp) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
