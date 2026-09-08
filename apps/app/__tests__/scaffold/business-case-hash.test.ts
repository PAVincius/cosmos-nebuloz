import { describe, expect, it } from "vitest";
import {
  businessCaseHash,
  type SignablePayload,
} from "@/lib/scaffold/business-case-hash";

// O `ref` do artefato assinado (`a7f3c2e9` no protótipo).
//
// É prova, não identificador: meses depois da assinatura, alguém precisa poder
// mostrar que os números contra os quais o Signal apura são os mesmos que o
// patrocinador aprovou. Um hash que muda sozinho não prova nada; um hash que
// NÃO muda quando uma meta muda prova o contrário do que deveria.

const BASE: SignablePayload = {
  businessCaseCode: "BC-104",
  versionLabel: "v2",
  window: { start: "2026-07-01", months: 12, cadence: "monthly" },
  benefit: {
    kind: "COST_AVOIDED",
    hard: true,
    annualCents: 140_000_000,
    basis: "6 FTE × custo hora × horas liberadas",
  },
  metrics: [
    {
      key: "cycle",
      unit: "min",
      baseValue: "46",
      targetValue: "34",
      direction: "DOWN",
      confidence: "MEASURED",
    },
    {
      key: "error",
      unit: "%",
      baseValue: "8.2",
      targetValue: "4",
      direction: "DOWN",
      confidence: "MEASURED",
    },
  ],
};

const clone = (over: Partial<SignablePayload> = {}): SignablePayload => ({
  ...BASE,
  ...over,
  metrics: over.metrics ?? BASE.metrics.map((m) => ({ ...m })),
});

describe("businessCaseHash — estabilidade", () => {
  it("é determinístico para o mesmo payload", () => {
    expect(businessCaseHash(BASE)).toBe(businessCaseHash(clone()));
  });

  it("tem o formato curto do protótipo — 8 hex", () => {
    expect(businessCaseHash(BASE)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("não depende da ordem das métricas", () => {
    // Duas leituras do banco podem devolver ordens diferentes. Se o hash
    // dependesse da ordem, o mesmo artefato assinado teria dois `ref`.
    const invertido = clone({ metrics: [...BASE.metrics].reverse() });
    expect(businessCaseHash(invertido)).toBe(businessCaseHash(BASE));
  });
});

describe("businessCaseHash — sensibilidade", () => {
  it("muda quando uma meta muda", () => {
    const outro = clone();
    outro.metrics[0].targetValue = "30";
    expect(businessCaseHash(outro)).not.toBe(businessCaseHash(BASE));
  });

  it("muda quando a linha de base muda", () => {
    const outro = clone();
    outro.metrics[0].baseValue = "47";
    expect(businessCaseHash(outro)).not.toBe(businessCaseHash(BASE));
  });

  it("muda quando o nível de confiança muda", () => {
    // `measured` e `declared` sobre os mesmos números são promessas diferentes:
    // é exatamente a distinção sobre a qual o patrocinador de BC-105 contesta.
    const outro = clone();
    outro.metrics[0].confidence = "DECLARED";
    expect(businessCaseHash(outro)).not.toBe(businessCaseHash(BASE));
  });

  it("muda quando uma métrica é removida", () => {
    expect(
      businessCaseHash(clone({ metrics: [BASE.metrics[0] as never] }))
    ).not.toBe(businessCaseHash(BASE));
  });

  it("muda quando a janela de apuração muda", () => {
    expect(
      businessCaseHash(
        clone({
          window: { start: "2026-07-01", months: 18, cadence: "monthly" },
        })
      )
    ).not.toBe(businessCaseHash(BASE));
  });

  it("muda quando o benefício declarado muda", () => {
    expect(
      businessCaseHash(clone({ benefit: { ...BASE.benefit, annualCents: 1 } }))
    ).not.toBe(businessCaseHash(BASE));
  });

  it("muda entre versões do mesmo caso", () => {
    expect(businessCaseHash(clone({ versionLabel: "v3" }))).not.toBe(
      businessCaseHash(BASE)
    );
  });

  it("distingue casos de negócio diferentes com números idênticos", () => {
    expect(businessCaseHash(clone({ businessCaseCode: "BC-105" }))).not.toBe(
      businessCaseHash(BASE)
    );
  });
});

describe("businessCaseHash — o que NÃO entra", () => {
  it("rótulo e fonte da métrica não mudam o hash", () => {
    // O hash cobre a PROMESSA, não a prosa em volta. Corrigir um typo em
    // "Cycle time da triagem" não pode invalidar uma assinatura — e permitir
    // essa correção é o que impede alguém de deixar o texto errado por medo.
    const outro = clone();
    (outro.metrics[0] as Record<string, unknown>).label = "outro rótulo";
    (outro.metrics[0] as Record<string, unknown>).sourceLabel = "outra fonte";
    expect(businessCaseHash(outro)).toBe(businessCaseHash(BASE));
  });
});
