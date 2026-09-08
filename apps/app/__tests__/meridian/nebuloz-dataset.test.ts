import { existsSync } from "node:fs";
import path from "node:path";
import {
  NEBULOZ_GAPS,
  NEBULOZ_PLAN,
} from "@repo/provisioning/src/meridian-nebuloz";
import { describe, expect, it } from "vitest";

// Dataset puro do Meridian da própria Nebuloz — sem banco, sem mock. Garante
// que cada lacuna aponta para um documento real e que o plano só referencia
// lacunas que existem, antes de qualquer seed tocar o banco.

const VALID_AXES = [
  "DATA",
  "PROCESS",
  "PEOPLE",
  "GOVERNANCE",
  "INFRASTRUCTURE",
];
const VALID_EFFORTS = ["S", "M", "L"];

// __tests__/meridian/ → __tests__ → app → apps → raiz do monorepo.
const REPO_ROOT = path.resolve(__dirname, "../../../../");

describe("dataset Meridian Nebuloz", () => {
  it("tem códigos de lacuna únicos", () => {
    const codes = NEBULOZ_GAPS.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("fixa a contagem de lacunas em 29", () => {
    expect(NEBULOZ_GAPS.length).toBe(29);
  });

  it("usa só eixo válido", () => {
    for (const gap of NEBULOZ_GAPS) {
      expect(VALID_AXES).toContain(gap.axis);
    }
  });

  it("usa só esforço S, M ou L", () => {
    for (const gap of NEBULOZ_GAPS) {
      expect(VALID_EFFORTS).toContain(gap.effort);
    }
  });

  it("mantém costOfDelay entre 0 e 100", () => {
    for (const gap of NEBULOZ_GAPS) {
      expect(gap.costOfDelay).toBeGreaterThanOrEqual(0);
      expect(gap.costOfDelay).toBeLessThanOrEqual(100);
    }
  });

  it("declara confiança DECLARED em toda lacuna — nenhuma foi medida por bateria", () => {
    for (const gap of NEBULOZ_GAPS) {
      expect(gap.confidence).toBe("DECLARED");
    }
  });

  it("não deixa placeholder [[ ]] em nenhum texto", () => {
    for (const gap of NEBULOZ_GAPS) {
      expect(gap.statement).not.toContain("[[");
      expect(gap.ownerLabel).not.toContain("[[");
    }
    for (const item of NEBULOZ_PLAN) {
      expect(item.capacityNote).not.toContain("[[");
    }
  });

  it("aponta `fonte` para um arquivo que existe no repositório", () => {
    for (const gap of NEBULOZ_GAPS) {
      const fullPath = path.join(REPO_ROOT, gap.fonte);
      expect(
        existsSync(fullPath),
        `fonte ausente: ${gap.fonte} (${gap.code})`
      ).toBe(true);
    }
  });

  it("todo item de plano aponta para uma lacuna que existe no dataset", () => {
    const codes = new Set(NEBULOZ_GAPS.map((g) => g.code));
    for (const item of NEBULOZ_PLAN) {
      expect(
        codes.has(item.gapCode),
        `plano referencia lacuna inexistente: ${item.gapCode}`
      ).toBe(true);
    }
  });

  it("mantém quarter do plano entre 1 e 4", () => {
    for (const item of NEBULOZ_PLAN) {
      expect(item.quarter).toBeGreaterThanOrEqual(1);
      expect(item.quarter).toBeLessThanOrEqual(4);
    }
  });

  it("não repete gapCode no plano — uma lacuna, no máximo um item", () => {
    const gapCodes = NEBULOZ_PLAN.map((item) => item.gapCode);
    expect(new Set(gapCodes).size).toBe(gapCodes.length);
  });
});
