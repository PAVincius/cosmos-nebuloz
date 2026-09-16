/** @vitest-environment jsdom */
// processos-painel-dominio.test.tsx — o domínio do processo no painel é um
// ponto de cor ao lado do rótulo, não uma borda grossa.
//
// `borderLeft: 3px solid` era o warning do detector, e o DESIGN.backoffice.md
// é explícito: "cartões são superfícies elevadas por hairline e sombra baixa,
// nunca por borda grossa". A cor do domínio já vinha no eyebrow; o ponto ao
// lado dele mantém o sinal sem a borda.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Painel } from "@/app/(staff)/ferramentas/processos/painel";
import type { ProcessoRow } from "@/app/actions/processos";

const PROCESSO: ProcessoRow = {
  codigo: "PZ-01",
  descricao: "",
  diagram: null,
  diagramId: null,
  docUrl: null,
  dominio: "COMERCIAL",
  donoNome: null,
  id: "a",
  nivel: 2,
  nome: "Funil de leads",
  revisadoEm: null,
  tags: [],
  tipo: "CORE",
};

describe("Painel — domínio sem borda grossa", () => {
  it("o aside tem só a hairline; o domínio é um ponto de cor junto do eyebrow", () => {
    render(
      <Painel
        executando={false}
        ligacoes={[]}
        onCriarLigacao={vi.fn()}
        onEditar={vi.fn()}
        onExcluirLigacao={vi.fn()}
        onExcluirProcesso={vi.fn()}
        onSelecionar={vi.fn()}
        podeEscrever={false}
        processo={PROCESSO}
        processos={[PROCESSO]}
      />
    );

    const aside = screen.getByRole("complementary");
    expect(aside.style.borderLeft).toBe("");
    expect(aside.style.border).toBe("1px solid var(--hairline)");

    const eyebrow = screen.getByText(/PZ-01 · Comercial/);
    const ponto = eyebrow.querySelector("[data-ponto-dominio]") as HTMLElement;
    expect(ponto).toBeTruthy();
    expect(ponto.style.background).toContain("var(--");
    expect(ponto.getAttribute("aria-hidden")).toBe("true");
  });
});
