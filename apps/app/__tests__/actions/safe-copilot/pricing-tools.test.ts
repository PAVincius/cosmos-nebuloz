import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  pricingClientSend: vi.fn(),
}));

// Track GetProductsCommand constructor calls
const getProductsCommandCalls: unknown[] = [];

// Mock @aws-sdk/client-pricing so we can control pricingClient.send()
vi.mock("@aws-sdk/client-pricing", async () => {
  const PricingClient = function (this: unknown) {
    (this as { send: unknown }).send = mocks.pricingClientSend;
  };
  // We need a function that records its constructor calls so we can inspect filters
  const GetProductsCommand = function (this: unknown, input: unknown) {
    getProductsCommandCalls.push(input);
    Object.assign(this as object, input as object);
  };
  return { PricingClient, GetProductsCommand };
});

// Mock `ai` so tool() is a passthrough — execute is directly accessible
vi.mock("ai", () => ({
  tool: vi.fn((def: unknown) => def),
  embed: vi.fn(),
}));

// ─── Subject under test ─────────────────────────────────────────────────────

import {
  awsPricingTool,
  gcpPricingTool,
} from "../../../app/actions/safe-copilot/tools/pricing-tools";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePriceItemStr(
  overrides: {
    instanceType?: string;
    operatingSystem?: string;
    priceUsd?: string;
    unit?: string;
    servicecode?: string;
    location?: string;
    hasOnDemand?: boolean;
    priceZero?: boolean;
  } = {}
): string {
  const {
    instanceType = "t3.medium",
    operatingSystem = "Linux",
    priceUsd = "0.0416",
    unit = "Hrs",
    servicecode = "AmazonEC2",
    location = "US East (N. Virginia)",
    hasOnDemand = true,
    priceZero = false,
  } = overrides;

  return JSON.stringify({
    product: {
      attributes: {
        instanceType,
        operatingSystem,
        servicecode,
        location,
      },
    },
    terms: hasOnDemand
      ? {
          OnDemand: {
            "offer-key-1": {
              priceDimensions: {
                "dim-key-1": {
                  unit,
                  pricePerUnit: { USD: priceZero ? "0.0000000000" : priceUsd },
                  description: `${operatingSystem}/UNIX`,
                },
              },
            },
          },
        }
      : {},
  });
}

function makeAwsSuccessResponse(priceItemStr: string) {
  return { PriceList: [priceItemStr] };
}

// GCP SKU builder
function makeGcpSku(
  overrides: {
    description?: string;
    region?: string;
    units?: string;
    nanos?: number;
    usageUnit?: string;
  } = {}
) {
  const {
    description = "N2 Instance Core running in Americas",
    region = "us-central1",
    units = "0",
    nanos = 31_611_000,
    usageUnit = "h",
  } = overrides;

  return {
    description,
    serviceRegions: [region],
    pricingInfo: [
      {
        pricingExpression: {
          usageUnit,
          tieredRates: [{ unitPrice: { units, nanos } }],
        },
      },
    ],
  };
}

// ─── AWS Pricing Tool ────────────────────────────────────────────────────────

describe("awsPricingTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductsCommandCalls.length = 0;
  });

  // Cast to get access to execute
  const tool = awsPricingTool as unknown as {
    execute: (args: {
      serviceCode: string;
      instanceType?: string;
      region: string;
      operatingSystem?: string;
      quantity: number;
      hoursPerMonth: number;
    }) => Promise<unknown>;
  };

  describe("EC2 success", () => {
    it("returns found:true with results and summary for valid EC2 instance", async () => {
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(makePriceItemStr({ instanceType: "t3.medium" }))
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "t3.medium",
        region: "us-east-1",
        operatingSystem: "Linux",
        quantity: 1,
        hoursPerMonth: 730,
      })) as Record<string, unknown>;

      expect(result.found).toBe(true);
      expect(result.service).toBe("AmazonEC2");
      expect(result.instanceType).toBe("t3.medium");
      expect(result.region).toBe("us-east-1");
      expect(result.quantity).toBe(1);
      expect(result.hoursPerMonth).toBe(730);
      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.summary).toBe("string");
    });

    it("computes estimatedMonthlyCost correctly for hourly unit", async () => {
      // 0.0416 USD/hr * 730 hrs/mo * 1 instance = 30.368 => rounded to 30.37
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(
          makePriceItemStr({ priceUsd: "0.0416", unit: "Hrs" })
        )
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "t3.medium",
        region: "us-east-1",
        operatingSystem: "Linux",
        quantity: 1,
        hoursPerMonth: 730,
      })) as {
        found: boolean;
        results: Array<{ estimatedMonthlyCost: number }>;
      };

      expect(result.found).toBe(true);
      expect(result.results[0]?.estimatedMonthlyCost).toBeCloseTo(30.37, 1);
    });

    it("multiplies by quantity when quantity > 1", async () => {
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(
          makePriceItemStr({ priceUsd: "0.1000", unit: "Hrs" })
        )
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "m5.large",
        region: "us-east-1",
        quantity: 3,
        hoursPerMonth: 730,
      })) as {
        found: boolean;
        results: Array<{ estimatedMonthlyCost: number }>;
      };

      expect(result.found).toBe(true);
      // 0.1 * 730 * 3 = 219
      expect(result.results[0]?.estimatedMonthlyCost).toBeCloseTo(219, 0);
    });

    it("returns found:false with message when PriceList is empty", async () => {
      mocks.pricingClientSend.mockResolvedValue({ PriceList: [] });

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "x99.unknown",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; message: string };

      expect(result.found).toBe(false);
      expect(result.message).toContain("No pricing found");
      expect(result.message).toContain("AmazonEC2");
    });

    it("returns found:false with message when PriceList is undefined", async () => {
      mocks.pricingClientSend.mockResolvedValue({});

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "t3.micro",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; message: string };

      expect(result.found).toBe(false);
    });

    it("returns found:false with message when all price dimensions have zero price", async () => {
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(makePriceItemStr({ priceZero: true }))
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "t3.medium",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; message?: string };

      expect(result.found).toBe(false);
    });

    it("skips items with no OnDemand terms", async () => {
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(makePriceItemStr({ hasOnDemand: false }))
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "t3.medium",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean };

      expect(result.found).toBe(false);
    });
  });

  describe("RDS service", () => {
    it("returns found:true for RDS with PostgreSQL/Single-AZ filters applied", async () => {
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(
          makePriceItemStr({
            servicecode: "AmazonRDS",
            instanceType: "db.t3.medium",
            priceUsd: "0.087",
          })
        )
      );

      const result = (await tool.execute({
        serviceCode: "AmazonRDS",
        instanceType: "db.t3.medium",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean };

      expect(result.found).toBe(true);
      // Verify that GetProductsCommand was called with RDS service code
      expect(getProductsCommandCalls.length).toBeGreaterThan(0);
      expect(getProductsCommandCalls[0]).toMatchObject({
        ServiceCode: "AmazonRDS",
      });
    });
  });

  describe("Non-EC2/RDS service (AmazonS3)", () => {
    it("returns found:true for S3 without EC2/RDS-specific filters", async () => {
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(
          makePriceItemStr({
            servicecode: "AmazonS3",
            unit: "GB-Mo",
            priceUsd: "0.023",
          })
        )
      );

      const result = (await tool.execute({
        serviceCode: "AmazonS3",
        region: "us-east-1",
        quantity: 100,
        hoursPerMonth: 730,
      })) as { found: boolean; service: string };

      // S3 uses non-hourly unit (GB-Mo does not include "hr"), so cost = price * quantity
      expect(result.found).toBe(true);
    });
  });

  describe("Region mapping", () => {
    it("maps eu-west-1 to Europe (Ireland) location string", async () => {
      mocks.pricingClientSend.mockResolvedValue({ PriceList: [] });

      await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "t3.medium",
        region: "eu-west-1",
        quantity: 1,
        hoursPerMonth: 730,
      });

      expect(getProductsCommandCalls.length).toBeGreaterThan(0);
      const cmdInput = getProductsCommandCalls[0] as {
        Filters: Array<{ Field: string; Value: string }>;
      };
      const locationFilter = cmdInput.Filters.find(
        (f) => f.Field === "location"
      );
      expect(locationFilter?.Value).toBe("Europe (Ireland)");
    });

    it("defaults to us-east-1 location for unknown region", async () => {
      mocks.pricingClientSend.mockResolvedValue({ PriceList: [] });

      await tool.execute({
        serviceCode: "AmazonEC2",
        region: "ap-unknown-99",
        quantity: 1,
        hoursPerMonth: 730,
      });

      expect(getProductsCommandCalls.length).toBeGreaterThan(0);
      const cmdInput = getProductsCommandCalls[0] as {
        Filters: Array<{ Field: string; Value: string }>;
      };
      const locationFilter = cmdInput.Filters.find(
        (f) => f.Field === "location"
      );
      expect(locationFilter?.Value).toBe("US East (N. Virginia)");
    });
  });

  describe("Error handling", () => {
    it("returns found:false with generic error message when pricingClient.send throws non-auth error", async () => {
      mocks.pricingClientSend.mockRejectedValue(new Error("Network timeout"));

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "t3.medium",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toBe("Network timeout");
    });

    it("returns found:false with credentials error message when error contains 'credentials'", async () => {
      mocks.pricingClientSend.mockRejectedValue(
        new Error("Could not load credentials from any providers")
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "t3.medium",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toContain("AWS Pricing API: missing credentials");
    });

    it("returns found:false with credentials error message when error contains 'UnauthorizedException'", async () => {
      mocks.pricingClientSend.mockRejectedValue(
        new Error("UnauthorizedException: user is not authorized")
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toContain("AWS Pricing API: missing credentials");
    });

    it("returns found:false with credentials error message when error contains 'AccessDenied'", async () => {
      mocks.pricingClientSend.mockRejectedValue(
        new Error("AccessDenied: insufficient permissions")
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toContain("AWS Pricing API: missing credentials");
      expect(result.error).toContain("AWS_ACCESS_KEY_ID");
    });

    it("returns fallback error message when thrown value is not an Error instance", async () => {
      mocks.pricingClientSend.mockRejectedValue("string error");

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toBe("AWS Pricing API unavailable");
    });
  });

  describe("Summary format", () => {
    it("summary includes quantity, instanceType, region and monthly cost", async () => {
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(
          makePriceItemStr({ priceUsd: "0.1000", unit: "Hrs" })
        )
      );

      const result = (await tool.execute({
        serviceCode: "AmazonEC2",
        instanceType: "m5.large",
        region: "us-east-1",
        quantity: 2,
        hoursPerMonth: 730,
      })) as { found: boolean; summary: string };

      expect(result.summary).toContain("2x");
      expect(result.summary).toContain("m5.large");
      expect(result.summary).toContain("us-east-1");
      expect(result.summary).toContain("/month");
    });

    it("summary uses serviceCode when no instanceType provided", async () => {
      mocks.pricingClientSend.mockResolvedValue(
        makeAwsSuccessResponse(
          makePriceItemStr({
            servicecode: "AmazonS3",
            unit: "GB-Mo",
            priceUsd: "0.023",
          })
        )
      );

      const result = (await tool.execute({
        serviceCode: "AmazonS3",
        region: "us-east-1",
        quantity: 1,
        hoursPerMonth: 730,
      })) as { found: boolean; summary: string };

      expect(result.summary).toContain("AmazonS3");
    });
  });
});

// ─── GCP Pricing Tool ────────────────────────────────────────────────────────

describe("gcpPricingTool", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  const tool = gcpPricingTool as unknown as {
    execute: (args: {
      service: string;
      skuFilter: string;
      region: string;
      quantity: number;
    }) => Promise<unknown>;
  };

  describe("Unknown service", () => {
    it("returns found:false with message for unknown service name", async () => {
      const result = (await tool.execute({
        service: "unknownservice",
        skuFilter: "Instance Core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; message: string };

      expect(result.found).toBe(false);
      expect(result.message).toContain("Unknown GCP service");
      expect(result.message).toContain("unknownservice");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("is case-insensitive for service lookup", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [makeGcpSku()] }),
      });

      const result = (await tool.execute({
        service: "COMPUTE",
        skuFilter: "n2 instance core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean };

      // COMPUTE → compute → known service, should NOT return unknown
      expect(result.found).toBe(true);
    });
  });

  describe("Known services resolve correct serviceId", () => {
    const knownServices = [
      { service: "compute", expectedId: "6F81-5844-456A" },
      { service: "cloudsql", expectedId: "9662-B51E-5089" },
      { service: "gcs", expectedId: "95FF-2EF5-5EA1" },
      { service: "bigquery", expectedId: "24E6-581D-38E5" },
      { service: "gke", expectedId: "6F81-5844-456A" },
      { service: "cloudrun", expectedId: "152E-C115-5142" },
    ];

    for (const { service, expectedId } of knownServices) {
      it(`resolves '${service}' to serviceId ${expectedId}`, async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          json: async () => ({ skus: [] }),
        });

        await tool.execute({
          service,
          skuFilter: "something",
          region: "us-central1",
          quantity: 1,
        });

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(expectedId)
        );
      });
    }
  });

  describe("Success path", () => {
    it("returns found:true with results and summary when SKUs match", async () => {
      const sku = makeGcpSku({
        description: "N2 Instance Core running in Americas",
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [sku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 1,
      })) as {
        found: boolean;
        service: string;
        skuFilter: string;
        region: string;
        quantity: number;
        results: Array<{ estimatedMonthlyCost: number; description: string }>;
        summary: string;
      };

      expect(result.found).toBe(true);
      expect(result.service).toBe("compute");
      expect(result.skuFilter).toBe("N2 Instance Core");
      expect(result.region).toBe("us-central1");
      expect(result.quantity).toBe(1);
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(typeof result.summary).toBe("string");
      expect(result.summary).toContain("/month");
    });

    it("computes estimatedMonthlyCost for hourly unit (h)", async () => {
      // nanos = 31611000 → 0.031611 USD/h * 730 * 1 = 23.076... ≈ 23.08
      const sku = makeGcpSku({ nanos: 31_611_000, usageUnit: "h" });
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [sku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "n2 instance core",
        region: "us-central1",
        quantity: 1,
      })) as {
        found: boolean;
        results: Array<{ estimatedMonthlyCost: number }>;
      };

      expect(result.found).toBe(true);
      expect(result.results[0]?.estimatedMonthlyCost).toBeCloseTo(23.08, 1);
    });

    it("computes estimatedMonthlyCost for non-hourly unit (GiBy.mo)", async () => {
      // units=0, nanos=20000000 → 0.02 USD/unit * quantity=10 = 0.2
      const sku = makeGcpSku({
        description: "Standard Storage us-central1",
        nanos: 20_000_000,
        usageUnit: "GiBy.mo",
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [sku] }),
      });

      const result = (await tool.execute({
        service: "gcs",
        skuFilter: "standard storage",
        region: "us-central1",
        quantity: 10,
      })) as {
        found: boolean;
        results: Array<{ estimatedMonthlyCost: number }>;
      };

      expect(result.found).toBe(true);
      // 0.02 * 10 = 0.2
      expect(result.results[0]?.estimatedMonthlyCost).toBeCloseTo(0.2, 2);
    });

    it("multiplies by quantity for hourly SKUs", async () => {
      const sku = makeGcpSku({ nanos: 100_000_000, usageUnit: "h" }); // 0.1 USD/h
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [sku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "n2 instance core",
        region: "us-central1",
        quantity: 5,
      })) as {
        found: boolean;
        results: Array<{ estimatedMonthlyCost: number }>;
      };

      expect(result.found).toBe(true);
      // 0.1 * 730 * 5 = 365
      expect(result.results[0]?.estimatedMonthlyCost).toBeCloseTo(365, 0);
    });

    it("filters SKUs by region — excludes SKUs not in the requested region", async () => {
      const matchingSku = makeGcpSku({
        description: "N2 Instance Core running in Americas",
        region: "us-central1",
      });
      const otherRegionSku = makeGcpSku({
        description: "N2 Instance Core running in Europe",
        region: "europe-west1",
      });

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [otherRegionSku, matchingSku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "n2 instance core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; results: Array<{ region: string }> };

      expect(result.found).toBe(true);
      // Only the us-central1 SKU should be returned
      for (const r of result.results) {
        expect(r.region).toBe("us-central1");
      }
    });

    it("filters SKUs by description (case-insensitive skuFilter)", async () => {
      const matchingSku = makeGcpSku({
        description: "N2 Instance Core running in Americas",
      });
      const nonMatchingSku = makeGcpSku({
        description: "SSD backed PD Capacity in Americas",
      });

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [nonMatchingSku, matchingSku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "N2 INSTANCE CORE",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; results: Array<{ description: string }> };

      expect(result.found).toBe(true);
      expect(
        result.results.every((r) =>
          r.description.toLowerCase().includes("n2 instance core")
        )
      ).toBe(true);
    });

    it("accepts global region and includes all region SKUs", async () => {
      const sku = makeGcpSku({
        description: "Standard Storage",
        region: "us-central1",
      });

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [sku] }),
      });

      const result = (await tool.execute({
        service: "gcs",
        skuFilter: "standard storage",
        region: "global",
        quantity: 1,
      })) as { found: boolean };

      expect(result.found).toBe(true);
    });

    it("caps results at 5 SKUs", async () => {
      const skus = Array.from({ length: 10 }, (_, i) =>
        makeGcpSku({ description: `N2 Instance Core variant ${i}` })
      );

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "n2 instance core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; results: unknown[] };

      expect(result.found).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe("No matching SKUs", () => {
    it("returns found:false with message when API returns empty skus array", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "nonexistent SKU type",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; message: string };

      expect(result.found).toBe(false);
      expect(result.message).toContain("No SKUs found");
      expect(result.message).toContain("nonexistent SKU type");
    });

    it("returns found:false when skus is undefined in response", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "something",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean };

      expect(result.found).toBe(false);
    });

    it("returns found:false when all SKUs have zero price (filtered out)", async () => {
      const zeroSku = {
        description: "N2 Instance Core running in Americas",
        serviceRegions: ["us-central1"],
        pricingInfo: [
          {
            pricingExpression: {
              usageUnit: "h",
              tieredRates: [{ unitPrice: { units: "0", nanos: 0 } }],
            },
          },
        ],
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [zeroSku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "n2 instance core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean };

      expect(result.found).toBe(false);
    });

    it("returns found:false when SKU has no pricingInfo", async () => {
      const noPricingSku = {
        description: "N2 Instance Core running in Americas",
        serviceRegions: ["us-central1"],
        pricingInfo: [],
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [noPricingSku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "n2 instance core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean };

      expect(result.found).toBe(false);
    });

    it("returns found:false when tieredRates is empty", async () => {
      const noTiersSku = {
        description: "N2 Instance Core running in Americas",
        serviceRegions: ["us-central1"],
        pricingInfo: [
          {
            pricingExpression: {
              usageUnit: "h",
              tieredRates: [],
            },
          },
        ],
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [noTiersSku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "n2 instance core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean };

      expect(result.found).toBe(false);
    });
  });

  describe("HTTP error handling", () => {
    it("returns found:false with GCP auth error message on HTTP 401", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toContain("GCP Billing API requires authentication");
      expect(result.error).toContain("GCP_PRICING_API_KEY");
    });

    it("returns found:false with GCP auth error message on HTTP 403", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toContain("GCP Billing API requires authentication");
    });

    it("returns found:false with status error message on HTTP 500", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toContain("GCP Billing API error: 500");
    });

    it("returns found:false with error message when fetch throws", async () => {
      fetchMock.mockRejectedValue(new Error("Network unreachable"));

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toBe("Network unreachable");
    });

    it("returns fallback error message when thrown value is not an Error", async () => {
      fetchMock.mockRejectedValue("unexpected string");

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 1,
      })) as { found: boolean; error: string };

      expect(result.found).toBe(false);
      expect(result.error).toBe("GCP Pricing API unavailable");
    });
  });

  describe("GCP_PRICING_API_KEY env var", () => {
    it("includes API key in URL when GCP_PRICING_API_KEY is set", async () => {
      const originalKey = process.env.GCP_PRICING_API_KEY;
      process.env.GCP_PRICING_API_KEY = "test-api-key-123";

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [] }),
      });

      await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 1,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("key=test-api-key-123")
      );

      process.env.GCP_PRICING_API_KEY = originalKey;
    });

    it("omits key param from URL when GCP_PRICING_API_KEY is not set", async () => {
      const originalKey = process.env.GCP_PRICING_API_KEY;
      process.env.GCP_PRICING_API_KEY = "";

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [] }),
      });

      await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 1,
      });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain("key=");

      process.env.GCP_PRICING_API_KEY = originalKey;
    });
  });

  describe("Summary format", () => {
    it("summary includes quantity, SKU description, region and monthly cost", async () => {
      const sku = makeGcpSku({
        description: "N2 Instance Core running in Americas",
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ skus: [sku] }),
      });

      const result = (await tool.execute({
        service: "compute",
        skuFilter: "N2 Instance Core",
        region: "us-central1",
        quantity: 3,
      })) as { found: boolean; summary: string };

      expect(result.summary).toContain("3x");
      expect(result.summary).toContain("us-central1");
      expect(result.summary).toContain("/month");
    });
  });
});
