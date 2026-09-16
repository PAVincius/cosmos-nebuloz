/** @vitest-environment jsdom */
// write-button.test.tsx — SRD FR-0.4. O que se prova aqui é a metade de UI da
// regra: MEMBER vê o controle, não consegue acionar, e enxerga o motivo. A
// outra metade — o servidor recusar de novo — é do guard e já está coberta em
// packages/provisioning e no assertCanWrite; nenhuma das duas substitui a outra.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MOTIVO_SOMENTE_LEITURA,
  WriteButton,
} from "../components/write-button";

describe("WriteButton", () => {
  it("aciona normalmente quem pode escrever", () => {
    const onClick = vi.fn();
    render(
      <WriteButton canWrite onClick={onClick}>
        Contratar módulo
      </WriteButton>
    );

    const botao = screen.getByRole("button", { name: "Contratar módulo" });
    expect(botao.hasAttribute("disabled")).toBe(false);
    botao.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("desabilita para MEMBER e não dispara o handler", () => {
    const onClick = vi.fn();
    render(
      <WriteButton canWrite={false} onClick={onClick}>
        Contratar módulo
      </WriteButton>
    );

    const botao = screen.getByRole("button", { name: /Contratar módulo/ });
    expect(botao.hasAttribute("disabled")).toBe(true);
    botao.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("mostra o motivo — desabilitar em silêncio parece tela quebrada", () => {
    render(<WriteButton canWrite={false}>Contratar módulo</WriteButton>);

    // No DOM, não só no title: title não é lido por leitor de tela em todo
    // navegador, e a regra é "desabilita COM motivo".
    expect(screen.getByText(MOTIVO_SOMENTE_LEITURA)).toBeTruthy();
    // Nomeia o papel que a pessoa tem e quem precisa agir — não a função do
    // servidor, que é nome de código e não diz a quem pedir.
    expect(MOTIVO_SOMENTE_LEITURA).toContain("MEMBER");
    expect(MOTIVO_SOMENTE_LEITURA).toContain("ADMIN");
    expect(MOTIVO_SOMENTE_LEITURA).not.toContain("assertCanWrite");
  });
});
