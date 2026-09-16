import { describe, expect, it } from "vitest";
import {
  CLAUSE_LABEL,
  deriveVendorMaxClass,
  type VendorPosture,
} from "../charter-rules";

// A escada de teto contratual (ADR-0003): cada degrau exige o anterior mais um
// conjunto de cláusulas. O teste percorre degrau a degrau, provando não só a
// classe devolvida mas o `reasoning` — é o texto que o CISO lê no painel de
// postura para entender por que o teto é aquele.

const TODAS = ["CL-01", "CL-02", "CL-03", "CL-04", "CL-05", "CL-08"];

function posture(overrides: Partial<VendorPosture> = {}): VendorPosture {
  return { tier: "APPROVED", dpa: true, clauseCodes: TODAS, ...overrides };
}

describe("deriveVendorMaxClass", () => {
  it("BLOCKED → teto nulo, com um único degrau de raciocínio", () => {
    const r = deriveVendorMaxClass(posture({ tier: "BLOCKED" }));

    expect(r.maxClass).toBeNull();
    expect(r.reasoning).toEqual([
      "Bloqueado por decisão de governança — nenhum dado permitido.",
    ]);
  });

  it("BLOCKED vence mesmo com DPA e todas as cláusulas", () => {
    // A ordem importa: o bloqueio é avaliado antes de qualquer cláusula.
    const r = deriveVendorMaxClass(
      posture({ tier: "BLOCKED", dpa: true, clauseCodes: TODAS })
    );
    expect(r.maxClass).toBeNull();
  });

  it("sem DPA → PUBLIC, e o motivo nomeia o DPA", () => {
    const r = deriveVendorMaxClass(posture({ dpa: false }));

    expect(r.maxClass).toBe("PUBLIC");
    expect(r.reasoning).toEqual(["Teto Público: DPA não assinado."]);
  });

  it("com DPA mas sem CL-01 → PUBLIC, e o motivo nomeia a cláusula", () => {
    const r = deriveVendorMaxClass(
      posture({ dpa: true, clauseCodes: ["CL-02", "CL-03", "CL-04", "CL-08"] })
    );

    expect(r.maxClass).toBe("PUBLIC");
    expect(r.reasoning).toEqual([
      "Teto Público: falta CL-01 (proibição de treinamento com dados do cliente).",
    ]);
  });

  it("DPA + CL-01 sem nenhuma das três de confidencial → INTERNAL, listando as três lacunas", () => {
    const r = deriveVendorMaxClass(posture({ clauseCodes: ["CL-01"] }));

    expect(r.maxClass).toBe("INTERNAL");
    expect(r.reasoning).toEqual([
      "DPA assinado e CL-01 presente → permite dado Interno.",
      `Teto Interno: falta CL-02 (${CLAUSE_LABEL["CL-02"]}), CL-03 (${CLAUSE_LABEL["CL-03"]}), CL-04 (${CLAUSE_LABEL["CL-04"]}).`,
    ]);
  });

  it("falta só uma das três → INTERNAL, listando apenas a que falta", () => {
    const r = deriveVendorMaxClass(
      posture({ clauseCodes: ["CL-01", "CL-02", "CL-04", "CL-08"] })
    );

    expect(r.maxClass).toBe("INTERNAL");
    expect(r.reasoning[1]).toBe(
      `Teto Interno: falta CL-03 (${CLAUSE_LABEL["CL-03"]}).`
    );
  });

  it("CL-01..CL-04 sem CL-08 → CONFIDENTIAL, exigindo o BAA para subir", () => {
    const r = deriveVendorMaxClass(
      posture({ clauseCodes: ["CL-01", "CL-02", "CL-03", "CL-04"] })
    );

    expect(r.maxClass).toBe("CONFIDENTIAL");
    expect(r.reasoning).toEqual([
      "DPA assinado e CL-01 presente → permite dado Interno.",
      "CL-02, CL-03 e CL-04 presentes → permite dado Confidencial.",
      `Teto Confidencial: falta CL-08 (${CLAUSE_LABEL["CL-08"]}), exigida para PII/PHI.`,
    ]);
  });

  it("todas as cláusulas críticas → RESTRICTED, com os quatro degraus", () => {
    const r = deriveVendorMaxClass(posture());

    expect(r.maxClass).toBe("RESTRICTED");
    expect(r.reasoning).toEqual([
      "DPA assinado e CL-01 presente → permite dado Interno.",
      "CL-02, CL-03 e CL-04 presentes → permite dado Confidencial.",
      "CL-08 presente → permite dado Restrito (PII/PHI).",
    ]);
  });

  it("CL-05, CL-06 e CL-07 não mudam o teto — só as críticas contam", () => {
    const semOpcionais = deriveVendorMaxClass(
      posture({ clauseCodes: ["CL-01", "CL-02", "CL-03", "CL-04", "CL-08"] })
    );
    const comOpcionais = deriveVendorMaxClass(
      posture({ clauseCodes: [...TODAS, "CL-06", "CL-07"] })
    );

    expect(semOpcionais).toEqual(comOpcionais);
  });

  it("tier fora de BLOCKED não influencia: APPROVED, REVIEW e RESTRICTED dão o mesmo teto", () => {
    const clauseCodes = ["CL-01", "CL-02", "CL-03", "CL-04"];
    const tetos = (["APPROVED", "REVIEW", "RESTRICTED"] as const).map(
      (tier) => deriveVendorMaxClass(posture({ tier, clauseCodes })).maxClass
    );

    expect(tetos).toEqual(["CONFIDENTIAL", "CONFIDENTIAL", "CONFIDENTIAL"]);
  });

  it("é pura: não muta a postura recebida", () => {
    const input = posture({ clauseCodes: ["CL-01"] });
    const snapshot = structuredClone(input);

    deriveVendorMaxClass(input);

    expect(input).toEqual(snapshot);
  });
});

describe("CLAUSE_LABEL", () => {
  it("rotula CL-01..CL-08 com texto não vazio", () => {
    const codigos = Array.from(
      { length: 8 },
      (_, i) => `CL-${String(i + 1).padStart(2, "0")}`
    );
    expect(Object.keys(CLAUSE_LABEL).sort()).toEqual(codigos);
    for (const codigo of codigos) {
      expect(CLAUSE_LABEL[codigo]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("as cinco cláusulas críticas da escada têm rótulo", () => {
    for (const codigo of ["CL-01", "CL-02", "CL-03", "CL-04", "CL-08"]) {
      expect(CLAUSE_LABEL[codigo]).toBeDefined();
    }
  });
});
