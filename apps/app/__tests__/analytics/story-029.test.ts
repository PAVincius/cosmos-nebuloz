import { describe, expect, it } from "vitest";
import {
  aggregateOrgHealth,
  computeArtHealth,
  PPM_CRITICAL_THRESHOLD,
  PPM_WARNING_THRESHOLD,
} from "../../lib/analytics/art-health";

const healthy = (piPPM = 0.9) => ({ anomalies: [], piPPM });
const withAnomalies = (severities: string[], piPPM = 0.9) => ({
  anomalies: severities.map((s) => ({ severity: s })),
  piPPM,
});

describe("computeArtHealth (AC-001)", () => {
  it("HEALTHY when no anomalies and good PPM", () => {
    expect(computeArtHealth(healthy(0.9))).toBe("HEALTHY");
  });

  it("HEALTHY with 0 CRITICAL anomalies and PPM=0.80", () => {
    expect(computeArtHealth(healthy(0.8))).toBe("HEALTHY");
  });

  it("WARNING with 1 CRITICAL anomaly", () => {
    expect(computeArtHealth(withAnomalies(["CRITICAL"]))).toBe("WARNING");
  });

  it("WARNING with PPM < 0.80 but >= 0.65", () => {
    expect(computeArtHealth(healthy(0.79))).toBe("WARNING");
    expect(computeArtHealth(healthy(0.65))).toBe("WARNING");
  });

  it("CRITICAL with >= 2 CRITICAL anomalies", () => {
    expect(computeArtHealth(withAnomalies(["CRITICAL", "CRITICAL"]))).toBe(
      "CRITICAL"
    );
  });

  it("CRITICAL with PPM < 0.65", () => {
    expect(computeArtHealth(healthy(0.64))).toBe("CRITICAL");
    expect(computeArtHealth(healthy(0))).toBe("CRITICAL");
  });

  it("CRITICAL with PPM=null (defaults to 0)", () => {
    expect(computeArtHealth({ anomalies: [], piPPM: null })).toBe("CRITICAL");
  });

  it("thresholds exported as constants", () => {
    expect(PPM_CRITICAL_THRESHOLD).toBe(0.65);
    expect(PPM_WARNING_THRESHOLD).toBe(0.8);
  });

  it("non-CRITICAL anomalies don't trigger WARNING", () => {
    expect(computeArtHealth(withAnomalies(["HIGH", "MEDIUM"]))).toBe("HEALTHY");
  });
});

describe("aggregateOrgHealth (AC-002)", () => {
  it("HEALTHY when all HEALTHY", () => {
    expect(aggregateOrgHealth(["HEALTHY", "HEALTHY"])).toBe("HEALTHY");
  });

  it("WARNING when any WARNING", () => {
    expect(aggregateOrgHealth(["HEALTHY", "WARNING"])).toBe("WARNING");
  });

  it("CRITICAL when any CRITICAL", () => {
    expect(aggregateOrgHealth(["HEALTHY", "WARNING", "CRITICAL"])).toBe(
      "CRITICAL"
    );
  });

  it("CRITICAL takes precedence over WARNING", () => {
    expect(aggregateOrgHealth(["WARNING", "CRITICAL"])).toBe("CRITICAL");
  });

  it("empty array returns HEALTHY", () => {
    expect(aggregateOrgHealth([])).toBe("HEALTHY");
  });
});
