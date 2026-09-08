import { describe, expect, it } from "vitest";
import { rotearDocumento } from "../rotear-documento.mts";

describe("rotearDocumento", () => {
  it("nome explícito vence menção no corpo: meridian no nome, charter no corpo → meridian", () => {
    const r = rotearDocumento(
      "2026-08-28-meridian-diagnose.md",
      "Meridian Diagnose",
      "…integra com o Charter e o Cosmos…"
    );
    expect(r.destino).toBe("meridian");
  });

  it("nome e título neutros: o corpo decide (ADR que só nomeia o produto no contexto)", () => {
    const r = rotearDocumento(
      "0003-derivacao-classe-maxima-fornecedor.md",
      "Derivação da classe máxima do fornecedor",
      "Contexto de origem: SRD-Charter.md §9"
    );
    expect(r.destino).toBe("charter");
  });

  it("nada casa em lugar nenhum → compartilhado", () => {
    const r = rotearDocumento(
      "2026-06-10-ci-green-step-c.md",
      "CI Green Step C",
      "pipeline verde depois do passo C"
    );
    expect(r).toEqual({
      destino: "compartilhado",
      motivo: "sem palavra-chave",
    });
  });

  it("só os primeiros 600 caracteres do corpo contam", () => {
    const corpo = `${"x".repeat(700)} charter`;
    const r = rotearDocumento("2026-01-01-nota.md", "Nota", corpo);
    expect(r.destino).toBe("compartilhado");
  });
});
