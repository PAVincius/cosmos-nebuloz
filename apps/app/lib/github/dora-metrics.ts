// Story-025: DORA metrics computation (AC-005)

export type DeploymentRecord = {
  deployedAt: Date;
  firstCommitAt?: Date | null;
  state: "success" | "failure" | "error";
};

export type IncidentRecord = {
  startedAt: Date;
  resolvedAt: Date;
};

export type DORAClassification = "Elite" | "High" | "Medium" | "Low";

export type DORAMetrics = {
  deploymentFrequency: number; // deployments/day
  avgLeadTimeHours: number; // commit → production
  changeFailureRate: number; // 0–1
  mttrHours: number; // mean time to restore
  classification: DORAClassification;
};

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const ONE_HOUR_MS = 3_600_000;

export function computeDORAMetrics(
  deployments: DeploymentRecord[],
  incidents: IncidentRecord[],
  days = 30
): DORAMetrics {
  const successful = deployments.filter((d) => d.state === "success");

  const deploymentFrequency = successful.length / days;

  const leadTimes = successful
    .filter((d) => d.firstCommitAt !== null)
    .map(
      (d) => (d.deployedAt.getTime() - d.firstCommitAt!.getTime()) / ONE_HOUR_MS
    );
  const avgLeadTimeHours = mean(leadTimes);

  // Change failure rate: deployments followed by an incident within 1h
  const failedDeployments = successful.filter((d) =>
    incidents.some(
      (i) =>
        i.startedAt > d.deployedAt &&
        i.startedAt.getTime() - d.deployedAt.getTime() <= ONE_HOUR_MS
    )
  );
  const changeFailureRate =
    successful.length > 0 ? failedDeployments.length / successful.length : 0;

  const restorationTimes = incidents.map(
    (i) => (i.resolvedAt.getTime() - i.startedAt.getTime()) / ONE_HOUR_MS
  );
  const mttrHours = mean(restorationTimes);

  const classification = classifyDORA({
    deploymentFrequency,
    avgLeadTimeHours,
    changeFailureRate,
    mttrHours,
  });

  return {
    deploymentFrequency,
    avgLeadTimeHours,
    changeFailureRate,
    mttrHours,
    classification,
  };
}

function classifyDORA(metrics: {
  deploymentFrequency: number;
  avgLeadTimeHours: number;
  changeFailureRate: number;
  mttrHours: number;
}): DORAClassification {
  const {
    deploymentFrequency,
    avgLeadTimeHours,
    changeFailureRate,
    mttrHours,
  } = metrics;

  // Elite: multiple deploys/day, <1h lead time, <5% CFR, <1h MTTR
  if (
    deploymentFrequency >= 1 &&
    avgLeadTimeHours < 1 &&
    changeFailureRate < 0.05 &&
    mttrHours < 1
  ) {
    return "Elite";
  }

  // High: deploy weekly–daily, 1d–1w lead time, 5–15% CFR, <24h MTTR
  if (
    deploymentFrequency >= 1 / 7 &&
    avgLeadTimeHours < 168 &&
    changeFailureRate < 0.15 &&
    mttrHours < 24
  ) {
    return "High";
  }

  // Medium: monthly deploys, 1w–1m lead time, 15–30% CFR
  if (
    deploymentFrequency >= 1 / 30 &&
    avgLeadTimeHours < 720 &&
    changeFailureRate < 0.3
  ) {
    return "Medium";
  }

  return "Low";
}
