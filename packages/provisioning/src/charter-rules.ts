import type { CharterDataClass, CharterVendorTier } from "@repo/database";

// Derivação do teto contratual de um fornecedor (ADR-0003).
//
// Morava em apps/app/lib/charter/rules.ts. Saiu para cá porque o back-office
// também muda `dpa` (exportação da tela Fornecedores e DPA) e precisa
// recomputar `maxClass` na mesma escrita — e o back-office não importa de
// apps/app. `rules.ts` reexporta daqui: nada no app mudou de import.
//
// Sem `server-only`, sem I/O, sem Prisma: o intake do Charter recalcula isto
// no cliente a cada tecla.

export const CLAUSE_LABEL: Record<string, string> = {
  "CL-01": "Proibição de treinamento com dados do cliente",
  "CL-02": "Retenção zero de prompt e resposta",
  "CL-03": "Notificação de incidente em 24h",
  "CL-04": "Lista de sub-processadores e direito de objeção",
  "CL-05": "Localidade de processamento definida contratualmente",
  "CL-06": "Direito de auditoria anual",
  "CL-07": "Indenização por violação de PI",
  "CL-08": "BAA / adendo de dado de saúde",
};

export type VendorPosture = {
  tier: CharterVendorTier;
  dpa: boolean;
  clauseCodes: string[];
};

export type MaxClassDerivation = {
  maxClass: CharterDataClass | null;
  /** Um degrau por linha, na ordem em que foi avaliado. Alimenta o painel de
   *  postura contratual — o CISO precisa ver por que o teto é aquele. */
  reasoning: string[];
};

export function deriveVendorMaxClass(
  vendor: VendorPosture
): MaxClassDerivation {
  const has = (code: string) => vendor.clauseCodes.includes(code);
  const reasoning: string[] = [];

  if (vendor.tier === "BLOCKED") {
    return {
      maxClass: null,
      reasoning: [
        "Bloqueado por decisão de governança — nenhum dado permitido.",
      ],
    };
  }

  if (!(vendor.dpa && has("CL-01"))) {
    reasoning.push(
      vendor.dpa
        ? "Teto Público: falta CL-01 (proibição de treinamento com dados do cliente)."
        : "Teto Público: DPA não assinado."
    );
    return { maxClass: "PUBLIC", reasoning };
  }
  reasoning.push("DPA assinado e CL-01 presente → permite dado Interno.");

  const confidentialGaps = ["CL-02", "CL-03", "CL-04"].filter((c) => !has(c));
  if (confidentialGaps.length > 0) {
    reasoning.push(
      `Teto Interno: falta ${confidentialGaps
        .map((c) => `${c} (${CLAUSE_LABEL[c]})`)
        .join(", ")}.`
    );
    return { maxClass: "INTERNAL", reasoning };
  }
  reasoning.push("CL-02, CL-03 e CL-04 presentes → permite dado Confidencial.");

  if (!has("CL-08")) {
    reasoning.push(
      `Teto Confidencial: falta CL-08 (${CLAUSE_LABEL["CL-08"]}), exigida para PII/PHI.`
    );
    return { maxClass: "CONFIDENTIAL", reasoning };
  }
  reasoning.push("CL-08 presente → permite dado Restrito (PII/PHI).");

  return { maxClass: "RESTRICTED", reasoning };
}
