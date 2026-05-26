import { database } from "@repo/database";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { AlertTriangle } from "lucide-react";

type Props = {
  tenantId: string;
  scopeId: string;
};

export async function FlowAnomalyCallout({ tenantId, scopeId }: Props) {
  const run = await database.anomalyDetectionRun.findFirst({
    where: {
      tenantId,
      scopeId,
      status: "COMPLETED",
      anomalies: { some: { severity: { in: ["HIGH", "CRITICAL"] } } },
    },
    orderBy: { completedAt: "desc" },
    select: {
      anomalies: {
        where: { severity: { in: ["HIGH", "CRITICAL"] } },
        select: { rule: true, severity: true },
        take: 3,
      },
    },
  });

  if (!run?.anomalies.length) {
    return null;
  }

  return (
    <Alert className="border-rose-300 bg-rose-50" variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Anomalias ativas no fluxo</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
          {run.anomalies.map((a) => (
            <li key={`${a.rule}-${a.severity}`}>
              <strong>{a.rule}</strong> — {a.severity}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
