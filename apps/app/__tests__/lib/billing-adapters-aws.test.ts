import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ceSend: vi.fn(),
}));

vi.mock("@aws-sdk/client-cost-explorer", async () => {
  const CostExplorerClient = function (this: unknown, _config: unknown) {
    (this as { send: typeof mocks.ceSend }).send = mocks.ceSend;
  };
  const GetCostAndUsageCommand = function (this: unknown, input: unknown) {
    Object.assign(this as object, input as object);
  };
  return { CostExplorerClient, GetCostAndUsageCommand };
});

vi.mock("@aws-sdk/credential-providers", () => ({
  fromTemporaryCredentials: vi.fn(() => "mock-credentials"),
}));

import {
  buildExternalId,
  fetchAwsPage,
  normalizeAwsRow,
} from "@/lib/billing-adapters/aws";

const defaultConfig = {
  roleArn: "arn:aws:iam::123456789:role/CostRole",
  externalId: "ext-id",
  region: "us-east-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildExternalId", () => {
  it("returns a 64-char hex SHA-256 hash", () => {
    const id = buildExternalId({
      date: "2026-05-01",
      service: "AmazonEC2",
      operation: "RunInstances",
      usageType: "BoxUsage",
      resourceId: "i-123",
    });
    expect(id).toHaveLength(64);
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic — same params → same hash", () => {
    const params = {
      date: "2026-05-01",
      service: "S3",
      operation: "PutObject",
      usageType: "Requests",
      resourceId: "bucket-1",
    };
    expect(buildExternalId(params)).toBe(buildExternalId(params));
  });

  it("differs for different service", () => {
    const base = {
      date: "2026-05-01",
      operation: "",
      usageType: "",
      resourceId: "",
    };
    const a = buildExternalId({ ...base, service: "S3" });
    const b = buildExternalId({ ...base, service: "EC2" });
    expect(a).not.toBe(b);
  });

  it("matches manual SHA-256 computation", () => {
    const params = {
      date: "2026-01-01",
      service: "Lambda",
      operation: "Invoke",
      usageType: "GB-Second",
      resourceId: "fn-abc",
    };
    const expected = createHash("sha256")
      .update(
        `${params.date}|${params.service}|${params.operation}|${params.usageType}|${params.resourceId}`
      )
      .digest("hex");
    expect(buildExternalId(params)).toBe(expected);
  });
});

describe("normalizeAwsRow", () => {
  it("returns empty array when Groups is empty", () => {
    const row = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [],
    };
    expect(normalizeAwsRow(row, "123", "integ-1")).toHaveLength(0);
  });

  it("returns empty array when Groups is undefined", () => {
    const row = { TimePeriod: { Start: "2026-05-01", End: "2026-05-02" } };
    expect(normalizeAwsRow(row, "123", "integ-1")).toHaveLength(0);
  });

  it("maps a single group with all metrics correctly", () => {
    const row = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [
        {
          Keys: ["AmazonEC2", "Environment$production"],
          Metrics: {
            AmortizedCost: { Amount: "12.50", Unit: "USD" },
            UnblendedCost: { Amount: "13.00", Unit: "USD" },
            UsageQuantity: { Amount: "100", Unit: "Hrs" },
          },
        },
      ],
    };
    const entries = normalizeAwsRow(row, "123456789", "integ-1");
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.provider).toBe("AWS");
    expect(e.service).toBe("AmazonEC2");
    expect(e.amortizedAmount).toBe("12.50");
    expect(e.unblendedAmount).toBe("13.00");
    expect(e.usageQuantity).toBe("100");
    expect(e.usageUnit).toBe("Hrs");
    expect(e.currency).toBe("USD");
    expect(e.accountId).toBe("123456789");
  });

  it("parses tag from KEY$VALUE format", () => {
    const row = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [
        {
          Keys: ["S3", "CostCenter$Engineering"],
          Metrics: {
            AmortizedCost: { Amount: "5", Unit: "USD" },
            UnblendedCost: { Amount: "5", Unit: "USD" },
            UsageQuantity: { Amount: "0", Unit: "" },
          },
        },
      ],
    };
    const [entry] = normalizeAwsRow(row, "123", "i1");
    expect(entry.tags).toEqual({ CostCenter: "Engineering" });
  });

  it("returns empty tags when tagVal has no $ separator", () => {
    const row = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [
        {
          Keys: ["Lambda", "no-separator"],
          Metrics: {
            AmortizedCost: { Amount: "1", Unit: "USD" },
            UnblendedCost: { Amount: "1", Unit: "USD" },
            UsageQuantity: { Amount: "0", Unit: "" },
          },
        },
      ],
    };
    const [entry] = normalizeAwsRow(row, "123", "i1");
    expect(entry.tags).toEqual({});
  });

  it("defaults missing metrics to '0'", () => {
    const row = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [{ Keys: ["SomeService", ""], Metrics: {} }],
    };
    const [entry] = normalizeAwsRow(row, "123", "i1");
    expect(entry.amortizedAmount).toBe("0");
    expect(entry.unblendedAmount).toBe("0");
    expect(entry.usageQuantity).toBe("0");
  });

  it("maps multiple groups to multiple entries", () => {
    const row = {
      TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
      Groups: [
        {
          Keys: ["EC2", ""],
          Metrics: {
            AmortizedCost: { Amount: "10", Unit: "USD" },
            UnblendedCost: { Amount: "10", Unit: "USD" },
            UsageQuantity: { Amount: "5", Unit: "Hrs" },
          },
        },
        {
          Keys: ["S3", ""],
          Metrics: {
            AmortizedCost: { Amount: "2", Unit: "USD" },
            UnblendedCost: { Amount: "2", Unit: "USD" },
            UsageQuantity: { Amount: "100", Unit: "GB" },
          },
        },
      ],
    };
    const entries = normalizeAwsRow(row, "123", "i1");
    expect(entries).toHaveLength(2);
    expect(entries[0].service).toBe("EC2");
    expect(entries[1].service).toBe("S3");
  });
});

describe("fetchAwsPage", () => {
  it("returns empty entries when ResultsByTime is empty", async () => {
    mocks.ceSend.mockResolvedValue({
      ResultsByTime: [],
      NextPageToken: undefined,
    });

    const result = await fetchAwsPage({
      config: defaultConfig,
      tenantId: "t1",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });

    expect(result.entries).toHaveLength(0);
    expect(result.nextPageToken).toBeUndefined();
  });

  it("returns entries from ResultsByTime groups", async () => {
    mocks.ceSend.mockResolvedValue({
      ResultsByTime: [
        {
          TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
          Groups: [
            {
              Keys: ["EC2", ""],
              Metrics: {
                AmortizedCost: { Amount: "5", Unit: "USD" },
                UnblendedCost: { Amount: "5", Unit: "USD" },
                UsageQuantity: { Amount: "10", Unit: "Hrs" },
              },
            },
          ],
        },
      ],
      NextPageToken: undefined,
    });

    const result = await fetchAwsPage({
      config: defaultConfig,
      tenantId: "t1",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].service).toBe("EC2");
  });

  it("forwards NextPageToken from response", async () => {
    mocks.ceSend.mockResolvedValue({
      ResultsByTime: [],
      NextPageToken: "token-abc123",
    });

    const result = await fetchAwsPage({
      config: defaultConfig,
      tenantId: "t1",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      nextPageToken: undefined,
    });

    expect(result.nextPageToken).toBe("token-abc123");
  });

  it("extracts accountId from roleArn (segment [4])", async () => {
    mocks.ceSend.mockResolvedValue({
      ResultsByTime: [
        {
          TimePeriod: { Start: "2026-05-01", End: "2026-05-02" },
          Groups: [
            {
              Keys: ["Lambda", ""],
              Metrics: {
                AmortizedCost: { Amount: "1", Unit: "USD" },
                UnblendedCost: { Amount: "1", Unit: "USD" },
                UsageQuantity: { Amount: "0", Unit: "" },
              },
            },
          ],
        },
      ],
      NextPageToken: undefined,
    });

    const result = await fetchAwsPage({
      config: {
        roleArn: "arn:aws:iam::999888777:role/MyRole",
        externalId: "e",
        region: "us-east-1",
      },
      tenantId: "t1",
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });

    expect(result.entries[0].accountId).toBe("999888777");
  });
});
