/** @vitest-environment jsdom */
// entrada-de-data.test.tsx — ArrowUp/ArrowDown em mês/ano nunca produzem uma
// data que não existe (Fix round 1, achado 1). Antes do fix, incrementar o
// mês ou o ano só mexia nesse campo e deixava o dia como estava: de 31/01,
// ArrowUp no mês virava "2026-02-31" — um ISO que `onChange` propagava e que
// `ultimoValido` guardava, então nem o blur conseguia desfazer.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntradaDeData } from "@/components/entrada-de-data";

describe("EntradaDeData", () => {
  it("ArrowUp no mês clampa o dia para o último dia do mês resultante", () => {
    const onChange = vi.fn();
    render(
      <EntradaDeData onChange={onChange} rotulo="Início" valor="2026-01-31" />
    );
    fireEvent.keyDown(screen.getByLabelText("Início — mês"), {
      key: "ArrowUp",
    });
    expect(onChange).toHaveBeenCalledWith("2026-02-28");
  });

  it("ArrowDown no ano clampa 29/02 (bissexto) para 28/02 num ano comum", () => {
    const onChange = vi.fn();
    render(
      <EntradaDeData onChange={onChange} rotulo="Início" valor="2024-02-29" />
    );
    fireEvent.keyDown(screen.getByLabelText("Início — ano"), {
      key: "ArrowDown",
    });
    expect(onChange).toHaveBeenCalledWith("2023-02-28");
  });

  it("dia 31 seguido de mês 02 nunca chama onChange com um ISO inválido", () => {
    const chamadas: string[] = [];
    render(
      <EntradaDeData
        onChange={(iso) => chamadas.push(iso)}
        rotulo="Início"
        valor="2026-07-01"
      />
    );
    fireEvent.change(screen.getByLabelText("Início — dia"), {
      target: { value: "31" },
    });
    fireEvent.change(screen.getByLabelText("Início — mês"), {
      target: { value: "02" },
    });
    expect(chamadas).not.toContain("2026-02-31");
    for (const c of chamadas) {
      expect(c).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
