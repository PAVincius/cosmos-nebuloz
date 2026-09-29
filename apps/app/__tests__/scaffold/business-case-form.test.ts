import { describe, expect, it } from "vitest";
import {
  blankMetric,
  type CaseForm,
  fromDetail,
  toSaveDraftInput,
} from "@/lib/scaffold/business-case-form";

// Formulário do caso de negócio — S-06, SB-01. Converte o que a pessoa digita
// (texto, reais, vírgula decimal) no que `saveDraft` aceita, e recusa antes de
// o servidor recusar. A regra de fundo: a promessa que o Signal apura precisa
// apontar para o lado certo, e o número que sai daqui é o que vai ser assinado.

const metric = (over = {}) => ({
  ...blankMetric(),
  label: "Cycle time da triagem",
  unit: "min",
  baseValue: "46",
  targetValue: "34",
  sourceLabel: "Log do sistema de fila",
  sampleLabel: "4 semanas, 1.200 pedidos",
  ...over,
});

const form = (over: Partial<CaseForm> = {}): CaseForm => ({
  metrics: [metric()],
  windowMonths: "6",
  cadence: "monthly",
  benefitKind: "COST_AVOIDED",
  benefitHard: false,
  benefitAnnual: "",
  benefitBasis: "Horas de triagem evitadas por mês.",
  ...over,
});

describe("toSaveDraftInput", () => {
  it("converte o formulário no que saveDraft aceita", () => {
    const r = toSaveDraftInput(form());
    expect(r).toEqual({
      ok: true,
      input: {
        metrics: [
          {
            key: "cycle-time-da-triagem",
            label: "Cycle time da triagem",
            unit: "min",
            baseValue: "46",
            targetValue: "34",
            direction: "DOWN",
            confidence: "DECLARED",
            sourceLabel: "Log do sistema de fila",
            sampleLabel: "4 semanas, 1.200 pedidos",
          },
        ],
        windowMonths: 6,
        cadence: "monthly",
        benefitKind: "COST_AVOIDED",
        benefitHard: false,
        benefitBasis: "Horas de triagem evitadas por mês.",
      },
    });
  });

  it("aceita vírgula decimal e devolve ponto (o servidor exige ponto)", () => {
    const r = toSaveDraftInput(
      form({ metrics: [metric({ baseValue: "4,5", targetValue: "2,25" })] })
    );
    expect(r.ok && r.input.metrics[0]).toMatchObject({
      baseValue: "4.5",
      targetValue: "2.25",
    });
  });

  it("converte reais em centavos, sem erro de ponto flutuante", () => {
    const r = toSaveDraftInput(form({ benefitAnnual: "1.234,56" }));
    expect(r.ok && r.input.benefitAnnualCents).toBe(123_456);
    const r2 = toSaveDraftInput(form({ benefitAnnual: "0,29" }));
    expect(r2.ok && r2.input.benefitAnnualCents).toBe(29);
  });

  it("benefício anual em branco não vai no payload", () => {
    const r = toSaveDraftInput(form({ benefitAnnual: "  " }));
    expect(r.ok && "benefitAnnualCents" in r.input).toBe(false);
  });

  it("chaves únicas: rótulos iguais ganham sufixo, e a chave é estável", () => {
    const r = toSaveDraftInput(
      form({ metrics: [metric(), metric({ baseValue: "50" })] })
    );
    expect(r.ok && r.input.metrics.map((m) => m.key)).toEqual([
      "cycle-time-da-triagem",
      "cycle-time-da-triagem-2",
    ]);
  });

  it("chave sem acento nem símbolo", () => {
    const r = toSaveDraftInput(
      form({ metrics: [metric({ label: "Taxa de reencaminhamento (%)" })] })
    );
    expect(r.ok && r.input.metrics[0]?.key).toBe("taxa-de-reencaminhamento");
  });

  it.each([
    ["sem métrica", { metrics: [] }, /ao menos uma métrica/i],
    ["janela zero", { windowMonths: "0" }, /janela/i],
    ["janela 37", { windowMonths: "37" }, /janela/i],
    ["janela fracionária", { windowMonths: "2.5" }, /janela/i],
    ["janela vazia", { windowMonths: "" }, /janela/i],
    ["base do benefício vazia", { benefitBasis: "  " }, /base do benefício/i],
    [
      "benefício anual inválido",
      { benefitAnnual: "muito" },
      /benefício anual/i,
    ],
  ])("recusa %s", (_n, over, msg) => {
    const r = toSaveDraftInput(form(over as Partial<CaseForm>));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join(" ")).toMatch(msg);
    }
  });

  it("recusa mais de 20 métricas", () => {
    const many = Array.from({ length: 21 }, (_, i) =>
      metric({ label: `Métrica ${i}` })
    );
    expect(toSaveDraftInput(form({ metrics: many })).ok).toBe(false);
  });

  it.each([
    ["rótulo", { label: " " }],
    ["unidade", { unit: "" }],
    ["fonte", { sourceLabel: "" }],
    ["amostra", { sampleLabel: "" }],
    ["linha de base", { baseValue: "" }],
    ["meta", { targetValue: "abc" }],
  ])("recusa métrica sem %s, dizendo qual", (_n, over) => {
    const r = toSaveDraftInput(form({ metrics: [metric(over)] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatch(/métrica 1/i);
    }
  });

  it("meta tem de ir para o lado da direção: cair exige meta menor que a base", () => {
    const r = toSaveDraftInput(
      form({
        metrics: [
          metric({ direction: "DOWN", baseValue: "10", targetValue: "12" }),
        ],
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatch(/menor/i);
    }
  });

  it("subir exige meta maior que a base", () => {
    const bad = toSaveDraftInput(
      form({
        metrics: [
          metric({ direction: "UP", baseValue: "10", targetValue: "8" }),
        ],
      })
    );
    expect(bad.ok).toBe(false);
    const good = toSaveDraftInput(
      form({
        metrics: [
          metric({ direction: "UP", baseValue: "10", targetValue: "12" }),
        ],
      })
    );
    expect(good.ok).toBe(true);
  });

  it("meta igual à base não é promessa", () => {
    const r = toSaveDraftInput(
      form({ metrics: [metric({ baseValue: "10", targetValue: "10" })] })
    );
    expect(r.ok).toBe(false);
  });

  it("junta os erros de tudo, para a pessoa corrigir de uma vez", () => {
    const r = toSaveDraftInput(
      form({
        windowMonths: "",
        benefitBasis: "",
        metrics: [metric({ unit: "" })],
      })
    );
    expect(!r.ok && r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("fromDetail", () => {
  it("carrega o caso salvo no formulário, centavos de volta em reais", () => {
    const f = fromDetail({
      metrics: [
        {
          key: "cycle",
          label: "Cycle",
          unit: "min",
          baseValue: "46.0000",
          targetValue: "34.0000",
          direction: "DOWN",
          confidence: "MEASURED",
          sourceLabel: "s",
          sampleLabel: "a",
        },
      ],
      windowMonths: 6,
      cadence: "quarterly",
      benefitKind: "REVENUE_NEW",
      benefitHard: true,
      benefitAnnualCents: 123_456,
      benefitBasis: "base",
    });
    expect(f).toMatchObject({
      windowMonths: "6",
      cadence: "quarterly",
      benefitKind: "REVENUE_NEW",
      benefitHard: true,
      benefitAnnual: "1234,56",
      benefitBasis: "base",
    });
    // Decimal do Postgres vem com zeros de escala; o campo mostra o número.
    expect(f.metrics[0]).toMatchObject({ baseValue: "46", targetValue: "34" });
  });

  it("caso novo, sem janela nem cadência: cai nos padrões", () => {
    const f = fromDetail({
      metrics: [],
      windowMonths: null,
      cadence: null,
      benefitKind: "COST_AVOIDED",
      benefitHard: false,
      benefitAnnualCents: null,
      benefitBasis: "",
    });
    expect(f).toMatchObject({
      windowMonths: "6",
      cadence: "monthly",
      benefitAnnual: "",
    });
    expect(f.metrics).toHaveLength(1);
  });

  it("ida e volta: o que sai do detalhe volta igual no payload", () => {
    const f = fromDetail({
      metrics: [
        {
          key: "cycle-time",
          label: "Cycle time",
          unit: "min",
          baseValue: "46.0000",
          targetValue: "34.5000",
          direction: "DOWN",
          confidence: "ESTIMATED",
          sourceLabel: "s",
          sampleLabel: "a",
        },
      ],
      windowMonths: 12,
      cadence: "monthly",
      benefitKind: "COST_AVOIDED",
      benefitHard: false,
      benefitAnnualCents: 50_000,
      benefitBasis: "b",
    });
    const r = toSaveDraftInput(f);
    expect(r.ok && r.input.metrics[0]).toMatchObject({
      baseValue: "46",
      targetValue: "34.5",
      confidence: "ESTIMATED",
    });
    expect(r.ok && r.input.benefitAnnualCents).toBe(50_000);
  });
});
