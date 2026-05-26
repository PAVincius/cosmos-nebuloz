import { AnomalyCard } from "./anomaly-card";

type Anomaly = {
  id: string;
  rule: string;
  severity: string;
  metadata: { narrative?: string; actions?: string[]; recurrence?: string } | null;
};

type Props = { anomalies: Anomaly[] };

export function AnomalyFeed({ anomalies }: Props) {
  if (anomalies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma anomalia detectada recentemente.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {anomalies.map((a) => (
        <AnomalyCard key={a.id} anomaly={a} />
      ))}
    </div>
  );
}
