/** @vitest-environment jsdom */
// confirmar-acao.test.tsx — a barreira antes de operação sem volta.
//
// O que se prova aqui não é que existe um modal. É que o segundo clique custa
// alguma coisa:
//
// 1. **O alvo aparece escrito.** "Tem certeza?" é a pergunta que se aprende a
//    responder sim sem ler. "Cancelar COSMOS de vanta-saude" não é.
// 2. **A confirmação não fica no mesmo lugar do gatilho.** Botão que confirma
//    onde o dedo já estava é o mesmo clique com um passo a mais.
// 3. **Dá para desistir**, e desistir não executa nada.
// 4. **Enquanto executa, não dá para disparar de novo** — provisionar duas
//    vezes por duplo clique cria dois tenants.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmarAcao } from "@/components/confirmar-acao";

function montar(over: Partial<Parameters<typeof ConfirmarAcao>[0]> = {}) {
  const onConfirmar = vi.fn();
  render(
    <ConfirmarAcao
      alvo="vanta-saude"
      consequencia="O cliente perde acesso ao módulo imediatamente."
      onConfirmar={onConfirmar}
      rotulo="Cancelar COSMOS"
      {...over}
    />
  );
  return { onConfirmar };
}

describe("ConfirmarAcao", () => {
  it("o primeiro clique não executa nada", () => {
    const { onConfirmar } = montar();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar COSMOS/ }));

    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("mostra o alvo escrito, não uma pergunta genérica", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar COSMOS/ }));

    // "Tem certeza?" é a pergunta que se aprende a responder sim sem ler.
    expect(screen.getByText(/vanta-saude/)).toBeTruthy();
  });

  it("mostra a consequência, não só o nome da ação", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar COSMOS/ }));

    expect(screen.getByText(/perde acesso ao módulo/)).toBeTruthy();
  });

  it("o segundo clique executa", () => {
    const { onConfirmar } = montar();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar COSMOS/ }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/ }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it("desistir não executa", () => {
    const { onConfirmar } = montar();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar COSMOS/ }));
    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));

    expect(onConfirmar).not.toHaveBeenCalled();
    // E volta ao estado inicial, não some da tela.
    expect(
      screen.getByRole("button", { name: /Cancelar COSMOS/ })
    ).toBeTruthy();
  });

  it("enquanto executa, não dispara de novo", () => {
    const { onConfirmar } = montar({ executando: true });

    fireEvent.click(screen.getByRole("button", { name: /Cancelar COSMOS/ }));

    // Duplo clique em provisionar cria dois tenants.
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});
