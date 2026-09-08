import {
  NEBULOZ_USE_CASES,
  NEBULOZ_VENDORS,
} from "@repo/provisioning/src/charter-nebuloz";
import { describe, expect, it } from "vitest";

// Teste puro sobre o dado estático do Charter da Nebuloz — nenhum banco
// envolvido. Garante que `apps/app/scripts/seed-charter-nebuloz.ts` recebe um
// dataset consistente antes de tocar o Postgres.

const VALID_VENDOR_TIERS = new Set([
  "APPROVED",
  "RESTRICTED",
  "REVIEW",
  "BLOCKED",
]);
const VALID_DATA_CLASSES = new Set([
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
]);
const VALID_EXPOSURES = new Set(["INTERNAL", "EXTERNAL"]);
const VALID_CRITICALITIES = new Set(["LOW", "MEDIUM", "HIGH"]);
const VALID_HITL = new Set(["FULL_REVIEW", "SAMPLING", "PASSIVE"]);

const RISK_AXES = [
  "privacy",
  "regulatory",
  "security",
  "bias",
  "ip",
  "operational",
  "reputational",
] as const;

describe("NEBULOZ_VENDORS", () => {
  it("tem exatamente 18 fornecedores (runbook §5)", () => {
    expect(NEBULOZ_VENDORS).toHaveLength(18);
  });

  it("tem códigos únicos", () => {
    const codes = NEBULOZ_VENDORS.map((v) => v.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("todo tier informado é um CharterVendorTier válido", () => {
    for (const v of NEBULOZ_VENDORS) {
      if (v.tier !== undefined) {
        expect(VALID_VENDOR_TIERS.has(v.tier)).toBe(true);
      }
    }
  });

  it("não tem texto com placeholder não resolvido ([[)", () => {
    for (const v of NEBULOZ_VENDORS) {
      expect(v.name).not.toContain("[[");
      expect(v.category).not.toContain("[[");
      if (v.notes) {
        expect(v.notes).not.toContain("[[");
      }
    }
  });

  it("code, name e category nunca são vazios", () => {
    for (const v of NEBULOZ_VENDORS) {
      expect(v.code.trim().length).toBeGreaterThan(0);
      expect(v.name.trim().length).toBeGreaterThan(0);
      expect(v.category.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("NEBULOZ_USE_CASES", () => {
  it("tem exatamente 9 casos de uso (runbook §6)", () => {
    expect(NEBULOZ_USE_CASES).toHaveLength(9);
  });

  it("tem códigos únicos", () => {
    const codes = NEBULOZ_USE_CASES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("todo vendorCode referenciado existe em NEBULOZ_VENDORS", () => {
    const vendorCodes = new Set(NEBULOZ_VENDORS.map((v) => v.code));
    for (const uc of NEBULOZ_USE_CASES) {
      if (uc.vendorCode) {
        expect(vendorCodes.has(uc.vendorCode)).toBe(true);
      }
    }
  });

  it("dataClass, exposure, criticality e hitl são valores de enum válidos", () => {
    for (const uc of NEBULOZ_USE_CASES) {
      expect(VALID_DATA_CLASSES.has(uc.dataClass)).toBe(true);
      expect(VALID_EXPOSURES.has(uc.exposure)).toBe(true);
      expect(VALID_CRITICALITIES.has(uc.criticality)).toBe(true);
      expect(VALID_HITL.has(uc.hitl)).toBe(true);
    }
  });

  it("slaTotal é um inteiro positivo", () => {
    for (const uc of NEBULOZ_USE_CASES) {
      expect(Number.isInteger(uc.slaTotal)).toBe(true);
      expect(uc.slaTotal).toBeGreaterThan(0);
    }
  });

  it("os sete eixos de risco estão entre 1 e 5, impacto e probabilidade", () => {
    for (const uc of NEBULOZ_USE_CASES) {
      for (const axis of RISK_AXES) {
        const { risk, prob } = uc.risk[axis];
        expect(risk).toBeGreaterThanOrEqual(1);
        expect(risk).toBeLessThanOrEqual(5);
        expect(prob).toBeGreaterThanOrEqual(1);
        expect(prob).toBeLessThanOrEqual(5);
      }
    }
  });

  it("não tem texto com placeholder não resolvido ([[)", () => {
    for (const uc of NEBULOZ_USE_CASES) {
      expect(uc.title).not.toContain("[[");
      expect(uc.objective).not.toContain("[[");
      expect(uc.approvalPath).not.toContain("[[");
    }
  });

  it("title, objective e approvalPath nunca são vazios", () => {
    for (const uc of NEBULOZ_USE_CASES) {
      expect(uc.title.trim().length).toBeGreaterThan(0);
      expect(uc.objective.trim().length).toBeGreaterThan(0);
      expect(uc.approvalPath.trim().length).toBeGreaterThan(0);
    }
  });

  it("só UC-01 e UC-07 têm fornecedor nomeado pelo runbook", () => {
    const withVendor = NEBULOZ_USE_CASES.filter((uc) => uc.vendorCode).map(
      (uc) => uc.code
    );
    expect(withVendor.sort()).toEqual(["UC-01", "UC-07"]);
  });
});
