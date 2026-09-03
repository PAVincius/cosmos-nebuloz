import { describe, expect, it } from "vitest";
import {
  canTransition,
  type InitiativeStatus,
  isTerminal,
  REQUIRED_BASELINE_KEYS,
  requiresReason,
  requiresSignedBaseline,
  TRANSITIONS,
} from "@/lib/signal/lifecycle";

const ALL: InitiativeStatus[] = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "CLOSED",
  "CANCELLED",
];

describe("máquina de estados da iniciativa", () => {
  it("permite o caminho feliz: rascunho → ativa → pausada → ativa → encerrada", () => {
    expect(canTransition("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "PAUSED")).toBe(true);
    expect(canTransition("PAUSED", "ACTIVE")).toBe(true);
    expect(canTransition("PAUSED", "CLOSED")).toBe(true);
    expect(canTransition("ACTIVE", "CLOSED")).toBe(true);
  });

  it("não deixa pular o rascunho direto para pausada ou encerrada", () => {
    expect(canTransition("DRAFT", "PAUSED")).toBe(false);
    expect(canTransition("DRAFT", "CLOSED")).toBe(false);
  });

  it("encerrada e cancelada são terminais — não reabrem", () => {
    // Reabrir apagaria o motivo do encerramento da história do portfólio.
    // Quem quer tentar de novo cria iniciativa nova, e o comitê vê as duas.
    for (const to of ALL) {
      expect(canTransition("CLOSED", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
    expect(isTerminal("CLOSED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("ACTIVE")).toBe(false);
  });

  it("cancelar é possível de qualquer estado não terminal", () => {
    expect(canTransition("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransition("ACTIVE", "CANCELLED")).toBe(true);
    expect(canTransition("PAUSED", "CANCELLED")).toBe(true);
  });

  it("nenhum estado transiciona para si mesmo", () => {
    for (const s of ALL) {
      expect(TRANSITIONS[s]).not.toContain(s);
    }
  });

  it("todo destino declarado é um estado válido", () => {
    for (const s of ALL) {
      for (const to of TRANSITIONS[s]) {
        expect(ALL).toContain(to);
      }
    }
  });
});

describe("pré-condições de transição", () => {
  it("só ativar exige baseline assinado", () => {
    expect(requiresSignedBaseline("ACTIVE")).toBe(true);
    for (const s of ["PAUSED", "CLOSED", "CANCELLED", "DRAFT"] as const) {
      expect(requiresSignedBaseline(s)).toBe(false);
    }
  });

  it("encerrar e cancelar exigem motivo escrito", () => {
    expect(requiresReason("CLOSED")).toBe(true);
    expect(requiresReason("CANCELLED")).toBe(true);
    // Pausar é reversível e não precisa de justificativa formal.
    expect(requiresReason("PAUSED")).toBe(false);
    expect(requiresReason("ACTIVE")).toBe(false);
  });
});

describe("dimensões obrigatórias do baseline", () => {
  it("são as cinco de FR-5", () => {
    expect([...REQUIRED_BASELINE_KEYS]).toEqual([
      "TIME",
      "COST",
      "THROUGHPUT",
      "QUALITY",
      "USER_BASE",
    ]);
  });
});
