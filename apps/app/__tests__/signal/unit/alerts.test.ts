import { describe, expect, it } from "vitest";

// Regras de alerta — US5.
//
// O que estes testes protegem: que a fila só receba coisa em que se pode agir.
// Um alerta que dispara com um mês ruim, ou que acusa "não rende" sem ter
// medido retorno, ensina o time a ignorar a fila inteira — e aí os três param
// de funcionar juntos.

import {
  type AlertRuleInput,
  type AlertThresholds,
  evaluateAlertRules,
} from "@/lib/signal/alerts";

const NOW = new Date("2026-09-02T12:00:00Z");
const WEEK = 7 * 24 * 60 * 60 * 1000;

const T: AlertThresholds = {
  adoptionBar: 60,
  lowAdoptionPct: 40,
  lowAdoptionWeeks: 8,
  weakRoi: 1.0,
};

/** Série semanal terminando hoje, do mais recente para o mais antigo. */
function series(pcts: number[]) {
  return pcts.map((pct, i) => ({
    periodStart: new Date(NOW.getTime() - (i + 1) * WEEK),
    periodEnd: new Date(NOW.getTime() - i * WEEK),
    pct,
  }));
}

const input = (over: Partial<AlertRuleInput> = {}): AlertRuleInput => ({
  initiativeName: "Copiloto de atendimento",
  adoption: series([70, 72, 68]),
  multiple: 2.3,
  sources: [{ code: "CN-01", name: "Jira", health: "HEALTHY" }],
  ...over,
});

const kinds = (i: AlertRuleInput) =>
  evaluateAlertRules(i, T, NOW).map((f) => f.kind);

describe("LOW — compramos e ninguém usa", () => {
  it("dispara quando a adoção fica abaixo da barra a janela inteira", () => {
    const adoption = series([22, 25, 19, 30, 28, 24, 26, 21, 23]);
    expect(kinds(input({ adoption, multiple: null }))).toContain("LOW");
  });

  it("não dispara com um mês ruim dentro de uma série boa", () => {
    const adoption = series([22, 25, 19, 65, 68, 70, 66, 64, 62]);
    expect(kinds(input({ adoption, multiple: null }))).not.toContain("LOW");
  });

  it("não dispara em iniciativa nova demais para cobrir a janela", () => {
    // Três semanas de dado não sustentam uma acusação de oito.
    const adoption = series([15, 18, 12]);
    expect(kinds(input({ adoption, multiple: null }))).not.toContain("LOW");
  });

  it("não dispara sem nenhuma medição de adoção", () => {
    expect(kinds(input({ adoption: [], multiple: null }))).not.toContain("LOW");
  });

  it("ignora medições velhas demais para valerem hoje", () => {
    // Série toda baixa, mas parada há meio ano: o problema é a medição.
    const old = series([20, 22, 18, 21, 19, 23, 20, 22, 21]).map((s) => ({
      periodStart: new Date(s.periodStart.getTime() - 26 * WEEK),
      periodEnd: new Date(s.periodEnd.getTime() - 26 * WEEK),
      pct: s.pct,
    }));
    expect(kinds(input({ adoption: old, multiple: null }))).not.toContain(
      "LOW"
    );
  });
});

describe("WEAK — usam e não rende", () => {
  it("dispara com adoção acima da barra e múltiplo abaixo do break-even", () => {
    expect(kinds(input({ multiple: 0.6 }))).toContain("WEAK");
  });

  it("não dispara sem múltiplo medido", () => {
    // Sem retorno medido não há acusação: "não rende" precisa de conta, e é
    // exatamente isso que o Signal existe para exigir.
    expect(kinds(input({ multiple: null }))).not.toContain("WEAK");
  });

  it("não dispara quando ninguém adotou — aí o problema é LOW, não WEAK", () => {
    const adoption = series([18, 20, 17, 19, 21, 16, 18, 20, 19]);
    const out = kinds(input({ adoption, multiple: 0.4 }));
    expect(out).toContain("LOW");
    expect(out).not.toContain("WEAK");
  });

  it("não dispara exatamente no break-even", () => {
    // `weakRoi` é o piso do aceitável, não o teto do inaceitável.
    expect(kinds(input({ multiple: 1.0 }))).not.toContain("WEAK");
  });

  it("diz o múltiplo e a barra no texto, não só que está ruim", () => {
    const [finding] = evaluateAlertRules(input({ multiple: 0.6 }), T, NOW);
    expect(finding.what).toContain("0.6×");
    expect(finding.what).toContain("60%");
  });
});

describe("STALE — não sei mais se o número vale", () => {
  it("dispara com fonte caída", () => {
    const sources = [
      { code: "CN-02", name: "Zendesk", health: "DOWN" as const },
    ];
    expect(kinds(input({ sources }))).toContain("STALE");
  });

  it("dispara com fonte atrasada", () => {
    const sources = [
      { code: "CN-02", name: "Zendesk", health: "STALE" as const },
    ];
    expect(kinds(input({ sources }))).toContain("STALE");
  });

  it("nomeia a fonte e o código no conserto", () => {
    const sources = [
      { code: "CN-02", name: "Zendesk", health: "DOWN" as const },
    ];
    const [finding] = evaluateAlertRules(input({ sources }), T, NOW);
    expect(finding.what).toContain("Zendesk");
    expect(finding.nextStep).toContain("CN-02");
  });

  it("não acusa o número de errado — só de velho", () => {
    const sources = [
      { code: "CN-02", name: "Zendesk", health: "DOWN" as const },
    ];
    const [finding] = evaluateAlertRules(input({ sources }), T, NOW);
    expect(finding.nextStep).toContain("desatualizado");
  });
});

describe("a fila", () => {
  it("põe decisão antes de atenção", () => {
    const adoption = series([70, 72, 68]);
    const sources = [
      { code: "CN-02", name: "Zendesk", health: "DOWN" as const },
    ];
    expect(kinds(input({ adoption, multiple: 0.5, sources }))).toEqual([
      "WEAK",
      "STALE",
    ]);
  });

  it("fica vazia quando está tudo em ordem", () => {
    expect(evaluateAlertRules(input(), T, NOW)).toEqual([]);
  });

  it("todo achado carrega próximo passo, nunca só o diagnóstico", () => {
    const adoption = series([20, 22, 18, 21, 19, 23, 20, 22, 21]);
    const sources = [
      { code: "CN-02", name: "Zendesk", health: "DOWN" as const },
    ];
    const found = evaluateAlertRules(input({ adoption, sources }), T, NOW);
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) {
      expect(f.nextStep.trim().length).toBeGreaterThan(20);
    }
  });
});
