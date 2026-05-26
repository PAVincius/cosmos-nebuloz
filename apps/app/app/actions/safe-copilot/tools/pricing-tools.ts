// apps/app/app/actions/safe-copilot/tools/pricing-tools.ts
// Cloud pricing tools for Copilot — answers cost estimation questions
// Uses public pricing APIs (no tenant credentials needed)

import {
  type Filter,
  GetProductsCommand,
  PricingClient,
} from "@aws-sdk/client-pricing";
import { tool } from "ai";
import { z } from "zod";

// AWS Pricing API is only available in us-east-1
const pricingClient = new PricingClient({
  region: "us-east-1",
  // Uses COSMOS deployment credentials (env: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
  // Pricing API is public data — only requires basic IAM, no billing permission
});

type AwsPriceResult = {
  service: string;
  instanceType?: string;
  region: string;
  pricePerUnit: number;
  unit: string;
  currency: string;
  estimatedMonthlyCost: number;
  estimatedYearlyCost: number;
  terms: string;
};

type PriceDimension = Record<string, unknown>;
type PriceOffer = { priceDimensions: Record<string, PriceDimension> };

function extractPriceFromDimension(dim: PriceDimension): number {
  const usdPrices = dim.pricePerUnit as Record<string, string>;
  return Number.parseFloat(usdPrices?.USD ?? "0");
}

function buildAwsResult(params: {
  attrs: Record<string, string>;
  serviceCode: string;
  dim: PriceDimension;
  pricePerUnit: number;
  hoursPerMonth: number;
  quantity: number;
}): AwsPriceResult {
  const { attrs, serviceCode, dim, pricePerUnit, hoursPerMonth, quantity } =
    params;
  const isHourly = String(dim.unit ?? "")
    .toLowerCase()
    .includes("hr");
  const monthlyCost = isHourly
    ? pricePerUnit * hoursPerMonth * quantity
    : pricePerUnit * quantity;

  return {
    service: attrs?.servicecode ?? serviceCode,
    instanceType: attrs?.instanceType,
    region: attrs?.location ?? "",
    pricePerUnit,
    unit: String(dim.unit ?? ""),
    currency: "USD",
    estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
    estimatedYearlyCost: Math.round(monthlyCost * 12 * 100) / 100,
    terms: "On-Demand",
  };
}

function extractOfferResult(params: {
  offer: PriceOffer;
  attrs: Record<string, string>;
  serviceCode: string;
  hoursPerMonth: number;
  quantity: number;
}): AwsPriceResult | null {
  const { offer, attrs, serviceCode, hoursPerMonth, quantity } = params;
  for (const dimKey of Object.keys(offer.priceDimensions)) {
    const dim = offer.priceDimensions[dimKey] as PriceDimension;
    const pricePerUnit = extractPriceFromDimension(dim);
    if (pricePerUnit > 0) {
      return buildAwsResult({
        attrs,
        serviceCode,
        dim,
        pricePerUnit,
        hoursPerMonth,
        quantity,
      });
    }
  }
  return null;
}

function parsePriceItem(params: {
  priceItemStr: string;
  serviceCode: string;
  hoursPerMonth: number;
  quantity: number;
}): AwsPriceResult | null {
  const { priceItemStr, serviceCode, hoursPerMonth, quantity } = params;
  const priceItem = JSON.parse(priceItemStr) as Record<string, unknown>;
  const product = priceItem.product as Record<string, unknown>;
  const attrs = product.attributes as Record<string, string>;
  const terms = priceItem.terms as Record<string, unknown>;

  const onDemand = terms?.OnDemand as Record<string, PriceOffer> | undefined;
  if (!onDemand) {
    return null;
  }

  for (const offerKey of Object.keys(onDemand)) {
    const offer = onDemand[offerKey];
    const result = extractOfferResult({
      offer,
      attrs,
      serviceCode,
      hoursPerMonth,
      quantity,
    });
    if (result) {
      return result;
    }
  }
  return null;
}

async function fetchAwsPrice(params: {
  serviceCode: string;
  filters: Filter[];
  quantity: number;
  hoursPerMonth?: number;
}): Promise<AwsPriceResult[]> {
  const { serviceCode, filters, quantity, hoursPerMonth = 730 } = params;

  const cmd = new GetProductsCommand({
    ServiceCode: serviceCode,
    Filters: filters,
    MaxResults: 5,
  });

  const resp = await pricingClient.send(cmd);
  const results: AwsPriceResult[] = [];

  for (const priceItemStr of resp.PriceList ?? []) {
    const result = parsePriceItem({
      priceItemStr,
      serviceCode,
      hoursPerMonth,
      quantity,
    });
    if (result) {
      results.push(result);
    }
  }

  return results;
}

// Map friendly region codes to AWS location strings used in Pricing API
const REGION_TO_LOCATION: Record<string, string> = {
  "us-east-1": "US East (N. Virginia)",
  "us-west-2": "US West (Oregon)",
  "eu-west-1": "Europe (Ireland)",
  "eu-central-1": "Europe (Frankfurt)",
  "ap-southeast-1": "Asia Pacific (Singapore)",
  "ap-northeast-1": "Asia Pacific (Tokyo)",
  "sa-east-1": "South America (Sao Paulo)",
};

function buildAwsFilters(params: {
  location: string;
  instanceType?: string;
  operatingSystem?: string;
  serviceCode: string;
}): Filter[] {
  const { location, instanceType, operatingSystem, serviceCode } = params;

  const filters: Filter[] = [
    { Type: "TERM_MATCH", Field: "location", Value: location },
    { Type: "TERM_MATCH", Field: "tenancy", Value: "Shared" },
    { Type: "TERM_MATCH", Field: "preInstalledSw", Value: "NA" },
    { Type: "TERM_MATCH", Field: "capacitystatus", Value: "Used" },
  ];

  if (instanceType) {
    filters.push({
      Type: "TERM_MATCH",
      Field: "instanceType",
      Value: instanceType,
    });
  }

  if (operatingSystem && serviceCode === "AmazonEC2") {
    filters.push({
      Type: "TERM_MATCH",
      Field: "operatingSystem",
      Value: operatingSystem,
    });
  }

  if (serviceCode === "AmazonRDS" && instanceType) {
    filters.push({
      Type: "TERM_MATCH",
      Field: "databaseEngine",
      Value: "PostgreSQL",
    });
    filters.push({
      Type: "TERM_MATCH",
      Field: "deploymentOption",
      Value: "Single-AZ",
    });
  }

  return filters;
}

export const awsPricingTool = tool({
  description:
    "Estimate AWS cloud costs for specific services (EC2, RDS, S3, etc.). " +
    "Use when the user asks about cost of running AWS resources, comparing instance types, " +
    "or estimating infrastructure spend. Returns price per unit and monthly/yearly estimates.",
  inputSchema: z.object({
    serviceCode: z
      .string()
      .describe(
        "AWS service code: AmazonEC2, AmazonRDS, AmazonS3, AWSLambda, AmazonElastiCache, etc."
      ),
    instanceType: z
      .string()
      .optional()
      .describe(
        "Instance type (e.g., r5.xlarge, t3.medium). Required for EC2/RDS."
      ),
    region: z
      .string()
      .default("us-east-1")
      .describe("AWS region code (e.g., us-east-1, eu-west-1, sa-east-1)"),
    operatingSystem: z
      .string()
      .optional()
      .default("Linux")
      .describe("OS for EC2: Linux, Windows, RHEL, SUSE"),
    quantity: z
      .number()
      .default(1)
      .describe("Number of instances/units to price"),
    hoursPerMonth: z
      .number()
      .default(730)
      .describe(
        "Hours per month to run (730 = 24/7, 160 = business hours only)"
      ),
  }),
  execute: async ({
    serviceCode,
    instanceType,
    region,
    operatingSystem,
    quantity,
    hoursPerMonth,
  }) => {
    const location =
      REGION_TO_LOCATION[region] ?? REGION_TO_LOCATION["us-east-1"];

    const filters = buildAwsFilters({
      location,
      instanceType,
      operatingSystem,
      serviceCode,
    });

    try {
      const prices = await fetchAwsPrice({
        serviceCode,
        filters,
        quantity,
        hoursPerMonth,
      });

      if (prices.length === 0) {
        return {
          found: false,
          message: `No pricing found for ${serviceCode} ${instanceType ?? ""} in ${region}. Try a different instance type or region.`,
        };
      }

      return {
        found: true,
        service: serviceCode,
        instanceType,
        region,
        quantity,
        hoursPerMonth,
        results: prices.slice(0, 3),
        summary: `${quantity}x ${instanceType ?? serviceCode} in ${region}: ~$${prices[0]?.estimatedMonthlyCost ?? 0}/month`,
      };
    } catch (err) {
      return {
        found: false,
        error:
          err instanceof Error ? err.message : "AWS Pricing API unavailable",
      };
    }
  },
});

// GCP Cloud Billing SKUs API (public, no auth required)
const GCP_BILLING_API = "https://cloudbilling.googleapis.com/v1";

type GcpSkuResult = {
  service: string;
  description: string;
  region: string;
  pricePerUnit: number;
  unit: string;
  currency: string;
  estimatedMonthlyCost: number;
};

type GcpTieredRate = {
  unitPrice: { units: string; nanos: number };
};

type GcpSku = {
  description: string;
  serviceRegions: string[];
  pricingInfo: Array<{
    pricingExpression: {
      usageUnit: string;
      tieredRates: GcpTieredRate[];
    };
  }>;
};

type GcpBillingResponse = {
  skus?: GcpSku[];
};

function skuMatchesFilter(
  sku: GcpSku,
  filterLower: string,
  region: string
): boolean {
  if (!sku.description.toLowerCase().includes(filterLower)) {
    return false;
  }
  if (
    region !== "global" &&
    !sku.serviceRegions.some((r) => r.includes(region))
  ) {
    return false;
  }
  return true;
}

function computeGcpSkuPrice(firstTier: GcpTieredRate): number {
  return (
    Number(firstTier.unitPrice.units ?? 0) +
    (firstTier.unitPrice.nanos ?? 0) / 1e9
  );
}

function buildGcpResult(params: {
  sku: GcpSku;
  serviceId: string;
  region: string;
  price: number;
  unit: string;
  quantity: number;
}): GcpSkuResult {
  const { sku, serviceId, region, price, unit, quantity } = params;
  const isHourly = unit.toLowerCase().includes("h");
  const monthlyCost = isHourly ? price * 730 * quantity : price * quantity;

  return {
    service: serviceId,
    description: sku.description,
    region,
    pricePerUnit: price,
    unit,
    currency: "USD",
    estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
  };
}

function parseGcpSku(params: {
  sku: GcpSku;
  serviceId: string;
  region: string;
  quantity: number;
}): GcpSkuResult | null {
  const { sku, serviceId, region, quantity } = params;
  const pricing = sku.pricingInfo[0]?.pricingExpression;
  if (!pricing) {
    return null;
  }
  const firstTier = pricing.tieredRates[0];
  if (!firstTier) {
    return null;
  }
  const price = computeGcpSkuPrice(firstTier);
  if (price <= 0) {
    return null;
  }
  return buildGcpResult({
    sku,
    serviceId,
    region,
    price,
    unit: pricing.usageUnit,
    quantity,
  });
}

async function fetchGcpSku(params: {
  serviceId: string;
  skuFilter: string;
  region: string;
  quantity: number;
}): Promise<GcpSkuResult[]> {
  const { serviceId, skuFilter, region, quantity } = params;
  const url = `${GCP_BILLING_API}/services/${serviceId}/skus?currencyCode=USD&pageSize=20`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`GCP Billing API error: ${resp.status}`);
  }

  const data = (await resp.json()) as GcpBillingResponse;
  const filterLower = skuFilter.toLowerCase();
  const results: GcpSkuResult[] = [];

  for (const sku of data.skus ?? []) {
    if (!skuMatchesFilter(sku, filterLower, region)) {
      continue;
    }
    const result = parseGcpSku({ sku, serviceId, region, quantity });
    if (result) {
      results.push(result);
    }
  }

  return results.slice(0, 5);
}

// Common GCP service IDs
const GCP_SERVICES: Record<string, string> = {
  compute: "6F81-5844-456A", // Compute Engine
  cloudsql: "9662-B51E-5089", // Cloud SQL
  gcs: "95FF-2EF5-5EA1", // Cloud Storage
  bigquery: "24E6-581D-38E5", // BigQuery
  gke: "6F81-5844-456A", // GKE (same as Compute)
  cloudrun: "152E-C115-5142", // Cloud Run
};

export const gcpPricingTool = tool({
  description:
    "Estimate Google Cloud Platform (GCP) costs for specific services (Compute Engine, Cloud SQL, GCS, BigQuery, etc.). " +
    "Use when the user asks about GCP resource costs or comparing AWS vs GCP pricing.",
  inputSchema: z.object({
    service: z
      .string()
      .describe("GCP service: compute, cloudsql, gcs, bigquery, cloudrun, gke"),
    skuFilter: z
      .string()
      .describe(
        "Filter to match SKU description (e.g., 'N2 Instance Core', 'SSD backed PD', 'Standard Storage')"
      ),
    region: z
      .string()
      .default("us-central1")
      .describe(
        "GCP region (e.g., us-central1, europe-west1, southamerica-east1)"
      ),
    quantity: z.number().default(1).describe("Number of units"),
  }),
  execute: async ({ service, skuFilter, region, quantity }) => {
    const serviceId = GCP_SERVICES[service.toLowerCase()];
    if (!serviceId) {
      return {
        found: false,
        message: `Unknown GCP service: ${service}. Use: compute, cloudsql, gcs, bigquery, cloudrun, gke`,
      };
    }

    try {
      const results = await fetchGcpSku({
        serviceId,
        skuFilter,
        region,
        quantity,
      });

      if (results.length === 0) {
        return {
          found: false,
          message: `No SKUs found for "${skuFilter}" in ${region}. Try a broader filter.`,
        };
      }

      return {
        found: true,
        service,
        skuFilter,
        region,
        quantity,
        results,
        summary: `${quantity}x "${results[0]?.description}" in ${region}: ~$${results[0]?.estimatedMonthlyCost}/month`,
      };
    } catch (err) {
      return {
        found: false,
        error:
          err instanceof Error ? err.message : "GCP Billing API unavailable",
      };
    }
  },
});
