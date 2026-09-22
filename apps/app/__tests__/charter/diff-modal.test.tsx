/** @vitest-environment jsdom */
// DiffModal — a tela onde o auditor lê o que mudou entre duas versões de
// política. Antes desta onda ela desenhava `r.before` e `r.after`, dois
// excertos de 180 caracteres lado a lado; com mudança em parágrafo distante os
// dois eram idênticos. Agora desenha os segmentos do `lib/charter/diff`.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VersionDiff } from "@/app/(charter)/actions/policy";
import { diffTexto } from "@/lib/charter/diff";
import { DiffModal } from "../../components/charter/modals/diff";

const noop = () => {
  // sem efeito no teste
};

const VINTE = Array.from({ length: 20 }, (_, i) => `Cláusula ${i + 1}.`);
const ANTES = VINTE.join("\n");
const DEPOIS = ANTES.replace("Cláusula 10.", "Cláusula 10 revisada.");

const linha = (
  field: string,
  antes: string,
  depois: string,
  nova = false
): VersionDiff["rows"][number] => {
  const d = diffTexto(antes, depois);
  return {
    field,
    segmentos: d.segmentos,
    nova,
    truncado: d.truncado,
    linhasOmitidas: d.linhasOmitidas,
  };
};

const montar = (rows: VersionDiff["rows"]) =>
  render(
    <DiffModal
      diff={{ version: "v1.1", previous: "v1.0", rows }}
      onClose={noop}
      publishedAt="2026-09-01T00:00:00.000Z"
      publishedBy="Marina"
      summary="Seção 4 muda."
    />
  );

describe("DiffModal", () => {
  it("mostra a linha mudada dos dois lados, sem repetir o mesmo texto", () => {
    montar([linha("S01 · Escopo", ANTES, DEPOIS)]);

    expect(screen.getByText("Cláusula 10.")).toBeTruthy();
    expect(screen.getByText("Cláusula 10 revisada.")).toBeTruthy();
    expect(screen.getByText("S01 · Escopo")).toBeTruthy();
  });

  it("colapsa o trecho inalterado com a contagem de linhas", () => {
    montar([linha("S01 · Escopo", ANTES, DEPOIS)]);

    expect(
      screen.getByRole("button", { name: /7 linhas sem alteração/ })
    ).toBeTruthy();
    expect(screen.queryByText("Cláusula 3.")).toBeNull();
  });

  it("abrir o bloco colapsado revela as linhas escondidas", () => {
    montar([linha("S01 · Escopo", ANTES, DEPOIS)]);

    fireEvent.click(
      screen.getByRole("button", { name: /7 linhas sem alteração/ })
    );

    expect(screen.getByText("Cláusula 3.")).toBeTruthy();
  });

  it("em linha longa reescrita, a parte que não mudou aparece separada", () => {
    const antes =
      "O fornecedor deve manter registro de todas as inferências do modelo por prazo não inferior a vinte e quatro meses.";
    const depois =
      "O fornecedor deve manter registro de todas as inferências do modelo por prazo não inferior a trinta e seis meses.";

    montar([linha("S02 · Retenção", antes, depois)]);

    // Trecho intocado da linha: aparece como elemento próprio dos dois lados,
    // em vez de a linha inteira se declarar reescrita.
    expect(
      screen.getAllByText(
        "O fornecedor deve manter registro de todas as inferências do modelo por prazo não inferior a"
      )
    ).toHaveLength(2);
    expect(screen.getByText("vinte")).toBeTruthy();
    expect(screen.getByText("trinta")).toBeTruthy();
  });

  it("marca a seção nova em vez de fingir que havia texto antes", () => {
    montar([linha("S03 · Fornecedores", "", "Cláusula inédita.", true)]);

    expect(screen.getByText("seção nova")).toBeTruthy();
    expect(screen.getByText("Cláusula inédita.")).toBeTruthy();
  });

  it("declara quando parte do texto ficou fora da comparação", () => {
    const gigante = Array.from({ length: 2100 }, (_, i) => `l${i}`).join("\n");
    const row = linha("S04 · Anexo", gigante, `${gigante}\nnova`);

    expect(row.truncado).toBe(true);
    montar([row]);

    expect(
      screen.getByText(
        new RegExp(`${row.linhasOmitidas} linhas não comparadas`)
      )
    ).toBeTruthy();
  });

  it("diff vazio mantém o estado sem alterações", () => {
    montar([]);

    expect(
      screen.getByText(
        "Nenhuma diferença de conteúdo entre esta versão e a anterior."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sem alteração/ })).toBeNull();
  });

  it("a região que rola é focável pelo teclado", () => {
    const { container } = montar([linha("S01 · Escopo", ANTES, DEPOIS)]);

    expect(container.querySelector('[tabindex="0"]')).toBeTruthy();
  });

  it("mantém o atalho de fechar no rodapé", () => {
    montar([linha("S01 · Escopo", ANTES, DEPOIS)]);

    expect(screen.getByText("esc")).toBeTruthy();
  });
});
