import { Badge } from "@repo/design-system/components/ui/badge";
import { appDesign } from "@/lib/app-design";
import {
  ShieldAlertIcon,
  TargetIcon,
  TrendingUpIcon,
  CheckCircle2Icon,
} from "lucide-react";
import type {
  ARTHealthIndicators,
  PIHealthSummary,
} from "@/app/actions/arts/observability";

function HealthCard({
  icon,
  label,
  value,
  sublabel,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  status?: "ok" | "warn" | "danger";
}) {
  const statusColor =
    status === "ok"
      ? "text-emerald-600"
      : status === "warn"
        ? "text-amber-600"
        : status === "danger"
          ? "text-rose-600"
          : "text-foreground";

  return (
    <div className={appDesign.statCard}>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`${appDesign.statValue} ${statusColor}`}>{value}</div>
      {sublabel && (
        <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

function PIHealthRow({ pi }: { pi: PIHealthSummary }) {
  const color =
    pi.predictability >= 80
      ? "text-emerald-600"
      : pi.predictability >= 50
        ? "text-amber-600"
        : "text-rose-600";

  const barColor =
    pi.predictability >= 80
      ? "bg-emerald-500"
      : pi.predictability >= 50
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="flex items-center gap-3 rounded border border-border/60 bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{pi.piName}</span>
          {pi.stretchObjectives > 0 && (
            <Badge variant="outline" className="text-xs">
              {pi.stretchObjectives} stretch
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {pi.achievedObjectives}/{pi.totalObjectives} objetivos alcançados
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${pi.predictability}%` }}
          />
        </div>
        <span className={`tabular-nums text-xs font-semibold ${color}`}>
          {pi.predictability}%
        </span>
      </div>
    </div>
  );
}

interface ARTHealthIndicatorsPanelProps {
  health: ARTHealthIndicators;
}

export function ARTHealthIndicatorsPanel({
  health,
}: ARTHealthIndicatorsPanelProps) {
  const riskStatus: "ok" | "warn" | "danger" =
    health.unresolvedRisks === 0
      ? "ok"
      : health.unresolvedRisks <= 3
        ? "warn"
        : "danger";

  const lastPI = health.piHealth[0];
  const predictStatus: "ok" | "warn" | "danger" = !lastPI
    ? "ok"
    : lastPI.predictability >= 80
      ? "ok"
      : lastPI.predictability >= 50
        ? "warn"
        : "danger";

  const totalAchieved = health.piHealth.reduce(
    (sum, p) => sum + p.achievedObjectives,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HealthCard
          icon={<ShieldAlertIcon className="h-3.5 w-3.5" />}
          label="Riscos Ativos"
          value={health.activeRisks}
          sublabel={`${health.unresolvedRisks} sem plano`}
          status={riskStatus}
        />
        <HealthCard
          icon={<TrendingUpIcon className="h-3.5 w-3.5" />}
          label="Predictability"
          value={lastPI ? `${lastPI.predictability}%` : "—"}
          sublabel={lastPI?.piName ?? "Nenhum PI"}
          status={predictStatus}
        />
        <HealthCard
          icon={<TargetIcon className="h-3.5 w-3.5" />}
          label="PIs Planejados"
          value={health.piHealth.length}
          sublabel="histórico total"
        />
        <HealthCard
          icon={<CheckCircle2Icon className="h-3.5 w-3.5" />}
          label="Objetivos Alcançados"
          value={totalAchieved}
          sublabel="total acumulado"
          status="ok"
        />
      </div>

      {health.piHealth.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">Predictability por PI</h4>
          <div className="flex flex-col gap-1.5">
            {health.piHealth.slice(0, 5).map((pi) => (
              <PIHealthRow key={pi.piId} pi={pi} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
