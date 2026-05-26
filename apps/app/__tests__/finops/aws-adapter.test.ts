// apps/app/__tests__/finops/aws-adapter.test.ts

import type { ResultByTime } from "@aws-sdk/client-cost-explorer";
import { describe, expect, it } from "vitest";
import { buildExternalId, normalizeAwsRow } from "@/lib/billing-adapters/aws";

describe("AWS adapter — normalizeAwsRow", () => {
  it("maps AmortizedCost to amortizedAmount", () => {
    const row: ResultByTime = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [
        {
          Keys: ["Amazon EC2", "cosmos:theme$theme_abc"],
          Metrics: {
            AmortizedCost: { Amount: "100.50", Unit: "USD" },
            UnblendedCost: { Amount: "105.00", Unit: "USD" },
            UsageQuantity: { Amount: "24", Unit: "Hrs" },
          },
        },
      ],
    };
    const results = normalizeAwsRow(row, "123456789", "integ_test");
    expect(results).toHaveLength(1);
    expect(results[0].amortizedAmount).toBe("100.50");
    expect(results[0].unblendedAmount).toBe("105.00");
    expect(results[0].service).toBe("Amazon EC2");
    expect(results[0].provider).toBe("AWS");
  });

  it("extracts themeId tag from Groups key", () => {
    const row: ResultByTime = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [
        {
          Keys: ["Amazon S3", "cosmos:theme$theme_xyz"],
          Metrics: {
            AmortizedCost: { Amount: "50", Unit: "USD" },
            UnblendedCost: { Amount: "50", Unit: "USD" },
            UsageQuantity: { Amount: "1", Unit: "GB" },
          },
        },
      ],
    };
    const results = normalizeAwsRow(row, "123456789", "integ_test");
    expect(results[0].tags["cosmos:theme"]).toBe("theme_xyz");
  });
});

describe("AWS adapter — buildExternalId", () => {
  it("produces a stable sha256 hex string", () => {
    const params = {
      date: "2026-05-01",
      service: "Amazon EC2",
      operation: "RunInstances",
      usageType: "BoxUsage:t3.micro",
      resourceId: "i-123",
    };
    const id1 = buildExternalId(params);
    const id2 = buildExternalId(params);
    expect(id1).toBe(id2);
    expect(id1).toHaveLength(64);
  });

  it("different inputs produce different IDs", () => {
    const id1 = buildExternalId({
      date: "2026-05-01",
      service: "Amazon EC2",
      operation: "RunInstances",
      usageType: "BoxUsage:t3.micro",
      resourceId: "",
    });
    const id2 = buildExternalId({
      date: "2026-05-01",
      service: "Amazon S3",
      operation: "PutObject",
      usageType: "Requests-Tier1",
      resourceId: "",
    });
    expect(id1).not.toBe(id2);
  });
});
