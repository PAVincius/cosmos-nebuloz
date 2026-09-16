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

  // fix-wave C1: `desabilitado` (formulário incompleto) e `executando` (ação
  // em andamento) são estados diferentes — misturá-los mostrava "Executando…"
  // sem nada rodando sempre que o formulário ficava inválido de novo depois
  // de já ter aberto a confirmação.
  it("desabilitado desliga o botão sem trocar o rótulo para 'Executando…'", () => {
    const onConfirmar = vi.fn();
    const props = {
      alvo: "vanta-saude",
      consequencia: "O cliente perde acesso ao módulo imediatamente.",
      onConfirmar,
      rotulo: "Cancelar COSMOS",
    };
    const { rerender } = render(<ConfirmarAcao {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Cancelar COSMOS/ }));
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();

    rerender(<ConfirmarAcao {...props} desabilitado />);

    const confirmar = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmar.hasAttribute("disabled")).toBe(true);
    fireEvent.click(confirmar);
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  // Onda P0/P1: a barreira passa a valer também para ações sem volta que não
  // são destrutivas (enviar proposta, provisionar tenant). Vermelho é a cor do
  // que apaga; o resto usa o accent — e o `--red-border` que a moldura pedia
  // não existia no tema.
  describe("tom", () => {
    it("tom=red pinta gatilho e moldura com os tokens de vermelho do tema", () => {
      montar({ tom: "red" });

      const gatilho = screen.getByRole("button", { name: /Cancelar COSMOS/ });
      expect(gatilho.style.color).toBe("var(--red-text)");

      fireEvent.click(gatilho);
      const moldura = screen.getByText(/perde acesso ao módulo/)
        .parentElement as HTMLElement;
      expect(moldura.style.border).toContain("var(--red-rgb)");
      expect(moldura.style.border).not.toContain("--red-border");
      expect(moldura.style.background).toBe("var(--red-soft)");
    });

    it("tom=accent usa o accent, e é a ação primária da tela", () => {
      montar({ tom: "accent" });

      const gatilho = screen.getByRole("button", { name: /Cancelar COSMOS/ });
      expect(gatilho.style.background).toBe("var(--accent)");
      expect(gatilho.style.color).toBe("var(--accent-fg)");

      fireEvent.click(gatilho);
      const moldura = screen.getByText(/perde acesso ao módulo/)
        .parentElement as HTMLElement;
      expect(moldura.style.border).toContain("var(--accent-rgb)");
      expect(moldura.style.background).toBe("var(--accent-soft)");
    });

    it("sem tom, continua vermelho — os cinco usos existentes são destrutivos", () => {
      montar();

      const gatilho = screen.getByRole("button", { name: /Cancelar COSMOS/ });
      expect(gatilho.style.color).toBe("var(--red-text)");
    });
  });

  // `aberto`: quando o gatilho já aconteceu fora do componente (um <select>
  // que mudou, um chip que foi clicado), a pergunta aparece de saída — sem um
  // segundo botão só para chegar nela. `onVoltar` devolve o controle a quem
  // precisa restaurar o valor anterior.
  describe("aberto / onVoltar", () => {
    it("aberto mostra o alvo e a consequência sem clique no gatilho", () => {
      const { onConfirmar } = montar({ aberto: true });

      expect(screen.getByText(/vanta-saude/)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
      expect(onConfirmar).not.toHaveBeenCalled();
    });

    it("Voltar avisa quem montou, para restaurar o valor anterior", () => {
      const onVoltar = vi.fn();
      const { onConfirmar } = montar({ aberto: true, onVoltar });

      fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));

      expect(onVoltar).toHaveBeenCalledTimes(1);
      expect(onConfirmar).not.toHaveBeenCalled();
    });
  });
});
