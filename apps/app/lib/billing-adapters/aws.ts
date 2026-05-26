import { createHash } from "node:crypto";
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type GetCostAndUsageCommandInput,
  type ResultByTime,
} from "@aws-sdk/client-cost-explorer";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AwsAdapterConfig = {
  roleArn: string;
  externalId: string;
  region?: string;
};

export type NormalizedEntry = {
  provider: "AWS";
  accountId: string;
  integrationId: string;
  externalId: string;
  usageStartDate: Date;
  usageEndDate: Date;
  service: string;
  chargeCategory: string;
  billedCost: string;
  effectiveCost: string;
  listCost: string;
  unblendedAmount: string;
  amortizedAmount: string;
  usageQuantity: string;
  usageUnit: string;
  currency: string;
  tenantCurrency: string;
  tenantAmount: string;
  fxRate: string;
  tags: Record<string, string>;
  mappingConf: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export type BuildExternalIdParams = {
  date: string;
  service: string;
  operation: string;
  usageType: string;
  resourceId: string;
};

export function buildExternalId(params: BuildExternalIdParams): string {
  const raw = `${params.date}|${params.service}|${params.operation}|${params.usageType}|${params.resourceId}`;
  return createHash("sha256").update(raw).digest("hex");
}

function extractTagsFromKey(tagVal: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const tagParts = tagVal.split("$");
  if (tagParts.length === 2 && tagParts[0] && tagParts[1]) {
    tags[tagParts[0]] = tagParts[1];
  }
  return tags;
}

function extractMetrics(
  metrics: Record<string, { Amount?: string; Unit?: string }>
) {
  const amortized = metrics.AmortizedCost?.Amount ?? "0";
  const unblended = metrics.UnblendedCost?.Amount ?? "0";
  const quantity = metrics.UsageQuantity?.Amount ?? "0";
  const unit = metrics.UsageQuantity?.Unit ?? "";
  const currency = metrics.AmortizedCost?.Unit ?? "USD";
  return { amortized, unblended, quantity, unit, currency };
}

export function normalizeAwsRow(
  row: ResultByTime,
  accountId: string,
  integrationId: string
): NormalizedEntry[] {
  const start = row.TimePeriod?.Start ?? "";
  const end = row.TimePeriod?.End ?? "";
  const results: NormalizedEntry[] = [];

  for (const group of row.Groups ?? []) {
    const keys = group.Keys ?? [];
    const service = keys[0] ?? "Unknown";
    const tagVal = keys[1] ?? "";
    const tags = extractTagsFromKey(tagVal);
    const { amortized, unblended, quantity, unit, currency } = extractMetrics(
      (group.Metrics ?? {}) as Record<
        string,
        { Amount?: string; Unit?: string }
      >
    );

    const externalId = buildExternalId({
      date: start,
      service,
      operation: "",
      usageType: "",
      resourceId: "",
    });

    results.push({
      provider: "AWS",
      accountId,
      integrationId,
      externalId,
      usageStartDate: new Date(start),
      usageEndDate: new Date(end),
      service,
      chargeCategory: "Usage",
      billedCost: unblended,
      effectiveCost: amortized,
      listCost: unblended,
      unblendedAmount: unblended,
      amortizedAmount: amortized,
      usageQuantity: quantity,
      usageUnit: unit,
      currency,
      tenantCurrency: currency,
      tenantAmount: amortized,
      fxRate: "1",
      tags,
      mappingConf: "UNMAPPED",
    });
  }

  return results;
}

// ─── Paginated fetch ──────────────────────────────────────────────────────────

export async function fetchAwsPage(params: {
  config: AwsAdapterConfig;
  tenantId: string;
  startDate: string;
  endDate: string;
  nextPageToken?: string;
}): Promise<{ entries: NormalizedEntry[]; nextPageToken: string | undefined }> {
  const { config, tenantId, startDate, endDate, nextPageToken } = params;

  const credentials = fromTemporaryCredentials({
    params: {
      RoleArn: config.roleArn,
      ExternalId: config.externalId,
      RoleSessionName: `cosmos-finops-${tenantId}`,
      DurationSeconds: 3600,
    },
  });

  const ce = new CostExplorerClient({
    region: config.region ?? "us-east-1",
    credentials,
  });

  const input: GetCostAndUsageCommandInput = {
    TimePeriod: { Start: startDate, End: endDate },
    Granularity: "DAILY",
    Metrics: ["AmortizedCost", "UnblendedCost", "UsageQuantity"],
    GroupBy: [
      { Type: "DIMENSION", Key: "SERVICE" },
      { Type: "TAG", Key: "cosmos:theme" },
    ],
    NextPageToken: nextPageToken,
  };

  const response = await ce.send(new GetCostAndUsageCommand(input));
  const entries: NormalizedEntry[] = [];

  for (const row of response.ResultsByTime ?? []) {
    const accountId = config.roleArn.split(":")[4] ?? "unknown";
    entries.push(...normalizeAwsRow(row, accountId, ""));
  }

  return {
    entries,
    nextPageToken: response.NextPageToken,
  };
}
