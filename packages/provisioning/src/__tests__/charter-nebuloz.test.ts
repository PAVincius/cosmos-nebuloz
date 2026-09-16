import { describe, expect, it } from "vitest";
import {
  NEBULOZ_USE_CASES,
  NEBULOZ_VENDORS,
  type NebulozUseCaseSeed,
} from "../charter-nebuloz";

// Dataset puro do Charter interno da Nebuloz (runbook §5 e §6) — sem banco.
// Prova as decisões de proveniência documentadas no cabeçalho do módulo: quem
// tem tier, quem tem fornecedor nomeado, como o `objective` é montado, e que os
// valores "congelados" de caminho/SLA/HITL batem com as quatro regras do
// Charter — o script de seed grava sem rodar `recommendPath()` de novo.

const RISK_AXES = [
  "privacy",
  "regulatory",
  "security",
  "bias",
  "ip",
  "operational",
  "reputational",
] as const;

const codigo = (prefixo: string, n: number) =>
  `${prefixo}-${String(n).padStart(2, "0")}`;

describe("NEBULOZ_VENDORS", () => {
  it("são V-01..V-18, em ordem, sem repetição", () => {
    expect(NEBULOZ_VENDORS.map((v) => v.code)).toEqual(
      Array.from({ length: 18 }, (_, i) => codigo("V", i + 1))
    );
  });

  it("V-01..V-11 (processam dado de cliente) têm tier; V-12..V-18 não", () => {
    for (const v of NEBULOZ_VENDORS) {
      const n = Number(v.code.slice(2));
      if (n <= 11) {
        expect(v.tier, v.code).toBeDefined();
      } else {
        // O default do schema (REVIEW) vale na criação; o seed não escreve o
        // campo para não sobrescrever numa reexecução.
        expect(v, v.code).not.toHaveProperty("tier");
      }
    }
  });

  it("todo tier informado é um CharterVendorTier válido e BLOCKED não aparece", () => {
    const validos = new Set(["APPROVED", "RESTRICTED", "REVIEW"]);
    for (const v of NEBULOZ_VENDORS) {
      if (v.tier !== undefined) {
        expect(validos.has(v.tier), `${v.code}: ${v.tier}`).toBe(true);
      }
    }
  });

  it("quem tem tier APPROVED condicionado ao DPA carrega a condição em notes", () => {
    // O runbook escreve "APPROVED após DPA confirmado"; a condição não tem
    // coluna no schema e é preservada como frase ao fim de `notes`.
    for (const code of ["V-05", "V-06", "V-07", "V-10"]) {
      const v = NEBULOZ_VENDORS.find((x) => x.code === code);
      expect(v?.tier, code).toBe("APPROVED");
      expect(v?.notes, code).toMatch(/após DPA confirmado\.$/);
    }
  });

  it("só V-13 fica sem notes — o runbook não escreveu nada ali", () => {
    const semNotes = NEBULOZ_VENDORS.filter((v) => !v.notes).map((v) => v.code);
    expect(semNotes).toEqual(["V-13"]);
  });

  it("nenhum campo contratual entra no seed — ficam no default do schema", () => {
    for (const v of NEBULOZ_VENDORS) {
      for (const campo of [
        "dpa",
        "retention",
        "subprocessors",
        "renewalAt",
        "region",
        "score",
      ]) {
        expect(v, `${v.code}.${campo}`).not.toHaveProperty(campo);
      }
    }
  });

  it("name e category nunca são vazios nem carregam placeholder", () => {
    for (const v of NEBULOZ_VENDORS) {
      expect(v.name.trim().length).toBeGreaterThan(0);
      expect(v.category.trim().length).toBeGreaterThan(0);
      expect(`${v.name}${v.category}${v.notes ?? ""}`).not.toContain("[[");
    }
  });
});

describe("NEBULOZ_USE_CASES", () => {
  it("são UC-01..UC-09, em ordem, sem repetição", () => {
    expect(NEBULOZ_USE_CASES.map((u) => u.code)).toEqual(
      Array.from({ length: 9 }, (_, i) => codigo("UC", i + 1))
    );
  });

  it("objective é o título mais a citação literal do caminho de origem", () => {
    for (const u of NEBULOZ_USE_CASES) {
      expect(u.objective, u.code).toMatch(
        new RegExp(
          `^${u.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\. Origem no código \\(runbook §6\\): \`[^\`]+\`\\.$`
        )
      );
    }
    expect(NEBULOZ_USE_CASES[0]?.objective).toBe(
      "Geração de rascunho de política. Origem no código (runbook §6): `(charter)/actions/policy-generate.ts`."
    );
  });

  it("só UC-01 → V-01 e UC-07 → V-11 têm fornecedor nomeado pelo runbook", () => {
    const comFornecedor = NEBULOZ_USE_CASES.filter((u) => u.vendorCode).map(
      (u) => [u.code, u.vendorCode]
    );
    expect(comFornecedor).toEqual([
      ["UC-01", "V-01"],
      ["UC-07", "V-11"],
    ]);
  });

  it("todo vendorCode existe em NEBULOZ_VENDORS", () => {
    const codes = new Set(NEBULOZ_VENDORS.map((v) => v.code));
    for (const u of NEBULOZ_USE_CASES) {
      if (u.vendorCode) {
        expect(codes.has(u.vendorCode), u.code).toBe(true);
      }
    }
  });

  it("os sete eixos de risco têm impacto e probabilidade inteiros em 1..5", () => {
    for (const u of NEBULOZ_USE_CASES) {
      expect(Object.keys(u.risk).sort()).toEqual([...RISK_AXES].sort());
      for (const eixo of RISK_AXES) {
        const { risk, prob } = u.risk[eixo];
        for (const valor of [risk, prob]) {
          expect(Number.isInteger(valor), `${u.code}.${eixo}`).toBe(true);
          expect(valor, `${u.code}.${eixo}`).toBeGreaterThanOrEqual(1);
          expect(valor, `${u.code}.${eixo}`).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it("approvalPath, slaTotal e hitl congelados batem com as quatro regras do Charter", () => {
    // A escada de recommendPath(): primeira condição que casa vence.
    const esperado = (
      u: NebulozUseCaseSeed
    ): Pick<NebulozUseCaseSeed, "approvalPath" | "slaTotal" | "hitl"> => {
      const externaAlta = u.exposure === "EXTERNAL" && u.criticality === "HIGH";
      if (u.dataClass === "RESTRICTED" || externaAlta) {
        return {
          approvalPath: "Legal + Segurança + Comitê de IA",
          slaTotal: 10,
          hitl: "FULL_REVIEW",
        };
      }
      if (u.dataClass === "CONFIDENTIAL" || u.criticality === "HIGH") {
        return {
          approvalPath: "Segurança + Legal",
          slaTotal: 5,
          hitl: "FULL_REVIEW",
        };
      }
      if (u.dataClass === "INTERNAL" || u.exposure === "EXTERNAL") {
        return { approvalPath: "Segurança", slaTotal: 3, hitl: "SAMPLING" };
      }
      return {
        approvalPath: "Via rápida — aprovação automática com registro",
        slaTotal: 1,
        hitl: "PASSIVE",
      };
    };

    for (const u of NEBULOZ_USE_CASES) {
      expect(
        { approvalPath: u.approvalPath, slaTotal: u.slaTotal, hitl: u.hitl },
        u.code
      ).toEqual(esperado(u));
    }
  });

  it("nenhum caso nasce decidido: dono, status e restrições ficam no default", () => {
    for (const u of NEBULOZ_USE_CASES) {
      for (const campo of [
        "department",
        "ownerId",
        "ownerName",
        "status",
        "restrictions",
        "blockReason",
        "changeRequest",
      ]) {
        expect(u, `${u.code}.${campo}`).not.toHaveProperty(campo);
      }
    }
  });
});
