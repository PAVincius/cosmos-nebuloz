import { describe, expect, it } from "vitest";
import {
  type ExportableCase,
  toSignalV1,
  toSignalV2,
} from "@/lib/scaffold/signal-export";

// S-06 / SC-004 — o contrato de saída para o Signal.
//
// O Scaffold é a FONTE DA VERDADE: emite o artefato assinado, e o Signal apura
// contra ele por meses sem nunca editá-lo. O Signal ainda não existe no
// repositório (research §R10), então o que se testa aqui é o que o Scaffold
// EMITE — não uma integração.
//
// A fixture é o BC-104 do protótipo. SC-004 diz que ele valida contra o schema
// e importa "sem transformação": se este teste precisar de um adaptador para
// passar, o contrato está errado, não o teste.

const BC104: ExportableCase = {
  id: "clx00000000000000000bc001",
  code: "BC-104",
  tenantId: "tenant-vanta",
  trackId: "clx000000000000000000t104",
  processName: "Triagem de autorizações prévias",
  signalInitiativeRef: "IN-014",
  windowStart: new Date("2026-07-01T00:00:00Z"),
  windowMonths: 12,
  cadence: "monthly",
  benefitKind: "COST_AVOIDED",
  benefitHard: true,
  benefitAnnualCents: 140_000_000,
  benefitBasis: "6 FTE × custo hora × horas liberadas",
  financeReviewedAt: new Date("2026-06-17T00:00:00Z"),
  signedVersion: {
    label: "v2",
    contentHash: "a7f3c2e9",
    signedAt: new Date("2026-06-18T14:32:00Z"),
    signedById: "clx000000000000000000u001",
    signedByLabel: "Otto Braga",
    metrics: [
      {
        key: "cycle",
        label: "Cycle time da triagem",
        unit: "min",
        baseValue: "46",
        targetValue: "34",
        direction: "DOWN",
        confidence: "MEASURED",
        sourceLabel: "Vanta Core · export semanal",
        sampleLabel: "4 semanas · 1.360 casos",
      },
      {
        key: "error",
        label: "Taxa de retrabalho",
        unit: "%",
        baseValue: "8.2",
        targetValue: "4",
        direction: "DOWN",
        confidence: "MEASURED",
        sourceLabel: "Vanta Core · auditoria interna",
        sampleLabel: "4 semanas",
      },
      {
        key: "volume",
        label: "Casos por analista/semana",
        unit: "casos",
        baseValue: "57",
        targetValue: "80",
        direction: "UP",
        confidence: "ESTIMATED",
        sourceLabel: "planilha do time",
        sampleLabel: "média de 3 meses",
      },
    ],
  },
};

describe("toSignalV2 — o que atravessa a fronteira", () => {
  it("carrega o schema versionado", () => {
    expect(toSignalV2(BC104).schema).toBe("nebuloz.signal.baseline/2");
  });

  it("carrega o contentHash como chave de idempotência", () => {
    // O Signal reimportando o mesmo hash não cria leitura nova. Sem isto, uma
    // reexecução do job duplicaria a série de apuração.
    expect(toSignalV2(BC104).content_hash).toBe("a7f3c2e9");
  });

  it("emite N métricas, não três fixas", () => {
    // O SRD §3 esboçou três métricas fixas. Três não descrevem "casos por
    // analista/semana" — ver research §R3.
    expect(toSignalV2(BC104).metrics).toHaveLength(3);
  });

  it("cada métrica carrega o nível de confiança", () => {
    // `measured` e `estimated` sobre os mesmos números são promessas
    // diferentes. Achatar isso faria toda promessa parecer medida.
    const m = toSignalV2(BC104).metrics;
    expect(m.map((x) => x.confidence)).toEqual([
      "measured",
      "measured",
      "estimated",
    ]);
  });

  it("normaliza enum para minúsculas — o contrato é JSON, não Prisma", () => {
    const v2 = toSignalV2(BC104);
    expect(v2.metrics[0]?.direction).toBe("down");
    expect(v2.benefit.kind).toBe("cost_avoided");
  });

  it("dinheiro em centavos inteiros, com moeda explícita", () => {
    const b = toSignalV2(BC104).benefit;
    expect(b.annual_cents).toBe(140_000_000);
    expect(Number.isInteger(b.annual_cents)).toBe(true);
    expect(b.currency).toBe("BRL");
  });

  it("datas em ISO, e a janela com a primeira leitura calculada", () => {
    const v2 = toSignalV2(BC104);
    expect(v2.window.start).toBe("2026-07-01");
    expect(v2.window.months).toBe(12);
    expect(v2.window.cadence).toBe("monthly");
    // Primeira leitura = fim do primeiro período. Deixar o Signal calcular
    // significaria as duas pontas implementarem a mesma regra de calendário.
    expect(v2.window.first_read).toBe("2026-07-31");
  });

  it("NENHUM artefato atravessa — o contrato é numérico", () => {
    const serialized = JSON.stringify(toSignalV2(BC104));
    expect(serialized).not.toMatch(/objectKey|artefact|filename/i);
  });

  it("carrega quem assinou, por id e por nome", () => {
    const v2 = toSignalV2(BC104);
    expect(v2.signed_by).toBe("clx000000000000000000u001");
    expect(v2.signed_by_label).toBe("Otto Braga");
  });
});

describe("toSignalV1 — compat com o SRD §6", () => {
  it("achata para as três métricas canônicas", () => {
    const v1 = toSignalV1(BC104);
    expect(v1.metrics.cycle_time_minutes).toBe(46);
    expect(v1.metrics.volume_per_period).toBe(57);
  });

  it("converte taxa de erro de percentual para fração", () => {
    // O v2 guarda 8.2 (por cento); o SRD §6 pede 0–1. É a única conversão de
    // unidade do contrato, e ela vive aqui — não no consumidor.
    expect(toSignalV1(BC104).metrics.error_rate).toBeCloseTo(0.082, 5);
  });

  it("métrica ausente vira null e NÃO falha", () => {
    const semErro: ExportableCase = {
      ...BC104,
      signedVersion: {
        ...BC104.signedVersion,
        metrics: BC104.signedVersion.metrics.filter((m) => m.key !== "error"),
      },
    };
    const v1 = toSignalV1(semErro);
    expect(v1.metrics.error_rate).toBeNull();
    expect(v1.metrics.cycle_time_minutes).toBe(46);
  });

  it("deriva o período da cadência", () => {
    expect(toSignalV1(BC104).metrics.period).toBe("month");
    expect(toSignalV1({ ...BC104, cadence: "quarterly" }).metrics.period).toBe(
      "month"
    );
  });

  it("carrega captured_at da assinatura, não do agora", () => {
    // O baseline foi capturado quando foi assinado. Usar `now` faria o mesmo
    // artefato exportar datas diferentes a cada chamada.
    expect(toSignalV1(BC104).captured_at).toBe("2026-06-18T14:32:00.000Z");
  });
});

describe("SC-004 — importa sem transformação", () => {
  it("o v2 é JSON puro, serializável e sem Date solta", () => {
    const v2 = toSignalV2(BC104);
    const round = JSON.parse(JSON.stringify(v2));
    expect(round).toEqual(v2);
  });

  it("o v1 também", () => {
    const v1 = toSignalV1(BC104);
    expect(JSON.parse(JSON.stringify(v1))).toEqual(v1);
  });
});
