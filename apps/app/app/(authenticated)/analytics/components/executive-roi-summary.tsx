import { AlertTriangleIcon } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function thresholdColor(value: number, warn: number, good: number): string {
  if (value >= good) {
    return "bg-green-500";
  }
  if (value >= warn) {
    return "bg-amber-500";
  }
  return "bg-red-500";
}

function thresholdTextColor(value: number, warn: number, good: number): string {
  if (value >= good) {
    return "text-foreground";
  }
  if (value >= warn) {
    return "text-amber-600";
  }
  return "text-red-600";
}

function healthColor(score: number): string {
  if (score >= 75) {
    return "text-green-600";
  }
  if (score >= 50) {
    return "text-amber-600";
  }
  return "text-red-600";
}

function healthLabel(score: number): string {
  if (score >= 75) {
    return "Saudável";
  }
  if (score >= 50) {
    return "Em Atenção";
  }
  return "Crítico";
}

function predictabilitySub(v: number): string {
  if (v >= 80) {
    return "dentro do padrão SAFe";
  }
  if (v >= 60) {
    return "atenção — abaixo de 80%";
  }
  return "crítico — revisar PI";
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  piPredictability: number;
  riskResolutionRate: number;
  featureThroughput: number;
  avgVelocity: number;
  totalRisks: number;
  resolvedRisks: number;
  latestPIName: string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ExecutiveROISummary({
  piPredictability,
  riskResolutionRate,
  featureThroughput,
  avgVelocity,
  totalRisks,
  resolvedRisks,
  latestPIName,
}: Props) {
  const openRisks = totalRisks - resolvedRisks;

  const signals = [
    {
      label: "Predictability",
      value: `${piPredictability}%`,
      sub: predictabilitySub(piPredictability),
      dotColor: thresholdColor(piPredictability, 60, 80),
      textColor: thresholdTextColor(piPredictability, 60, 80),
    },
    {
      label: "Resolução de riscos",
      value: `${riskResolutionRate}%`,
      sub:
        riskResolutionRate >= 70
          ? `${resolvedRisks} de ${totalRisks} riscos tratados`
          : `${openRisks} riscos em aberto`,
      dotColor: thresholdColor(riskResolutionRate, 40, 70),
      textColor: thresholdTextColor(riskResolutionRate, 40, 70),
    },
    {
      label: "Feature throughput",
      value: `${featureThroughput}`,
      sub: "features entregues nos últimos 90 dias",
      dotColor: featureThroughput > 0 ? "bg-green-500" : "bg-amber-500",
      textColor: "text-foreground",
    },
    {
      label: "Velocity média",
      value: avgVelocity > 0 ? `${avgVelocity} SP` : "—",
      sub:
        avgVelocity > 0
          ? "por sprint, média dos times"
          : "times sem velocity configurada",
      dotColor: avgVelocity > 0 ? "bg-green-500" : "bg-muted-foreground/40",
      textColor: "text-foreground",
    },
  ];

  const okCount = [
    piPredictability >= 80,
    riskResolutionRate >= 70,
    featureThroughput > 0,
    avgVelocity > 0,
  ].filter(Boolean).length;
  const score = Math.round((okCount / signals.length) * 100);

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            Resumo Executivo
          </p>
          {latestPIName ? (
            <p className="mt-0.5 text-muted-foreground text-xs">
              {latestPIName}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`font-bold text-2xl tabular-nums ${healthColor(score)}`}
          >
            {score}%
          </p>
          <p className={`font-medium text-xs ${healthColor(score)}`}>
            {healthLabel(score)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {signals.map((s) => (
          <div className="space-y-1" key={s.label}>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.dotColor}`} />
              <p className="truncate font-medium text-muted-foreground text-xs">
                {s.label}
              </p>
            </div>
            <p className={`font-bold text-xl tabular-nums ${s.textColor}`}>
              {s.value}
            </p>
            <p className="text-muted-foreground text-xs leading-tight">
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      {openRisks > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md border border-amber-300/40 bg-amber-500/5 px-3 py-1.5">
          <AlertTriangleIcon className="h-3 w-3 shrink-0 text-amber-500" />
          <p className="text-amber-700 text-xs dark:text-amber-400">
            <strong>{openRisks} risco(s)</strong> sem resolução — revisar ROAM
            board antes do próximo steering review.
          </p>
        </div>
      )}
    </div>
  );
}
