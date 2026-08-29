import { describe, expect, it } from "vitest";
import {
  computeAxisScore,
  normalizeAnswer,
  type ScoringAnswer,
  type ScoringQuestion,
} from "@/lib/meridian/scoring";

// O motor é a peça onde erro é silencioso: um score errado parece um score.
// Estes testes fixam as três propriedades que o produto vende — determinismo,
// normalização declarada e confidence que cai por motivo nomeável.

const likert = (code: string, weight = 1): ScoringQuestion => ({
  code,
  ordinal: Number(code.slice(-1)),
  type: "LIKERT",
  weight,
  inverted: false,
  scaleLabels: [],
});

const answer = (
  respondentId: string,
  questionCode: string,
  rawValue: number
): ScoringAnswer => ({ respondentId, questionCode, rawValue });

describe("normalizeAnswer", () => {
  it("mapeia likert de 5 pontos para 0..1", () => {
    const q = likert("Q1");
    expect(normalizeAnswer(q, 0)).toBe(0);
    expect(normalizeAnswer(q, 2)).toBe(0.5);
    expect(normalizeAnswer(q, 4)).toBe(1);
  });

  it("mapeia sim/não com sim = 1", () => {
    const q: ScoringQuestion = {
      code: "Q2",
      ordinal: 2,
      type: "YES_NO",
      weight: 1,
      inverted: false,
      scaleLabels: [],
    };
    expect(normalizeAnswer(q, 0)).toBe(1);
    expect(normalizeAnswer(q, 1)).toBe(0);
  });

  it("inverte a escala quando a faixa alta é a pior resposta", () => {
    const q: ScoringQuestion = {
      code: "Q3",
      ordinal: 3,
      type: "SCALE",
      weight: 1,
      inverted: true,
      scaleLabels: ["0–10%", "10–25%", "25–50%", "50%+"],
    };
    // "0–10% fora do ambiente governado" é a melhor resposta.
    expect(normalizeAnswer(q, 0)).toBe(1);
    expect(normalizeAnswer(q, 3)).toBe(0);
  });

  it("não inverte quando a faixa alta é a melhor resposta", () => {
    const q: ScoringQuestion = {
      code: "Q4",
      ordinal: 4,
      type: "SCALE",
      weight: 1,
      inverted: false,
      scaleLabels: ["baixo", "médio", "alto"],
    };
    expect(normalizeAnswer(q, 0)).toBe(0);
    expect(normalizeAnswer(q, 2)).toBe(1);
  });
});

describe("computeAxisScore", () => {
  const questions = [likert("Q1"), likert("Q2"), likert("Q3")];

  it("é determinístico: duas execuções sobre a mesma entrada são idênticas", () => {
    const answers = [
      answer("r1", "Q1", 3),
      answer("r1", "Q2", 2),
      answer("r1", "Q3", 4),
      answer("r2", "Q1", 1),
      answer("r2", "Q2", 2),
      answer("r2", "Q3", 0),
    ];
    const a = computeAxisScore(questions, answers, 25);
    const b = computeAxisScore(questions, [...answers].reverse(), 25);
    expect(a).toEqual(b);
  });

  it("pondera pelo peso da pergunta", () => {
    const weighted = [likert("Q1", 3), likert("Q2", 1)];
    const answers = [answer("r1", "Q1", 4), answer("r1", "Q2", 0)];
    // (3×1 + 1×0) / 4 = 0.75
    expect(computeAxisScore(weighted, answers, 25).score).toBe(75);
  });

  it("penaliza a confidence quando há um só respondente", () => {
    const one = computeAxisScore(
      questions,
      [answer("r1", "Q1", 4), answer("r1", "Q2", 4), answer("r1", "Q3", 4)],
      25
    );
    const two = computeAxisScore(
      questions,
      [
        answer("r1", "Q1", 4),
        answer("r1", "Q2", 4),
        answer("r1", "Q3", 4),
        answer("r2", "Q1", 4),
        answer("r2", "Q2", 4),
        answer("r2", "Q3", 4),
      ],
      25
    );
    expect(one.confidence).toBeLessThan(two.confidence);
    expect(one.spread).toBe(0);
  });

  it("penaliza a confidence quando faltam respostas", () => {
    const full = computeAxisScore(
      questions,
      [answer("r1", "Q1", 4), answer("r1", "Q2", 4), answer("r1", "Q3", 4)],
      25
    );
    const partial = computeAxisScore(
      questions,
      [answer("r1", "Q1", 4), answer("r1", "Q2", 4)],
      25
    );
    expect(partial.confidence).toBeLessThan(full.confidence);
  });

  it("marca CONTESTED quando o spread cruza o limiar do template", () => {
    // r1 responde tudo no topo, r2 tudo no fundo → spread 100.
    const answers = [
      answer("r1", "Q1", 4),
      answer("r1", "Q2", 4),
      answer("r1", "Q3", 4),
      answer("r2", "Q1", 0),
      answer("r2", "Q2", 0),
      answer("r2", "Q3", 0),
    ];
    const result = computeAxisScore(questions, answers, 25);
    expect(result.spread).toBe(100);
    expect(result.status).toBe("CONTESTED");
    expect(result.note).toBeTruthy();
  });

  it("mantém COMPUTED quando o spread fica abaixo do limiar", () => {
    const answers = [
      answer("r1", "Q1", 3),
      answer("r1", "Q2", 3),
      answer("r1", "Q3", 3),
      answer("r2", "Q1", 3),
      answer("r2", "Q2", 3),
      answer("r2", "Q3", 2),
    ];
    const result = computeAxisScore(questions, answers, 25);
    expect(result.spread).toBeLessThan(25);
    expect(result.status).toBe("COMPUTED");
  });

  it("devolve score 0 e confidence 0 quando ninguém respondeu", () => {
    const result = computeAxisScore(questions, [], 25);
    expect(result).toMatchObject({
      score: 0,
      confidence: 0,
      respondentCount: 0,
      spread: 0,
      status: "COMPUTED",
    });
  });

  it("mantém score, confidence e spread nos domínios declarados", () => {
    const answers = [
      answer("r1", "Q1", 0),
      answer("r2", "Q2", 4),
      answer("r3", "Q3", 2),
    ];
    const r = computeAxisScore(questions, answers, 25);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.spread).toBeGreaterThanOrEqual(0);
    expect(r.spread).toBeLessThanOrEqual(100);
  });

  it("ignora resposta a pergunta fora do eixo", () => {
    const answers = [answer("r1", "Q1", 4), answer("r1", "Q-OUTRO", 0)];
    const r = computeAxisScore([likert("Q1")], answers, 25);
    expect(r.score).toBe(100);
  });
});
