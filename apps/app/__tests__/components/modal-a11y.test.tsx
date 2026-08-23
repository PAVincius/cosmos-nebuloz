// modal-a11y.test.tsx — teclado e semântica do sistema de modal.
//
// Isto vive no provider, não em cada tela: são dezenas de modais, e um
// ModalCard novo precisa herdar Escape, foco e ARIA sem que quem o escreveu
// tenha lembrado disso. Cada caso aqui é uma regressão que a tela inteira
// sofreria em silêncio — ninguém percebe um focus trap quebrado olhando.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ModalCard,
  ModalProvider,
  useModal,
} from "../../components/cosmos/modal";

function AbrirBotao({ children }: { children: React.ReactNode }) {
  const { open } = useModal();
  return (
    <button onClick={() => open(children)} type="button">
      abrir
    </button>
  );
}

function montar(conteudo?: React.ReactNode) {
  render(
    <ModalProvider>
      <AbrirBotao>
        <ModalCard subtitle="Aposta de investimento" title="Novo tema">
          {conteudo ?? (
            <>
              <input aria-label="Nome" />
              <button type="button">Criar</button>
            </>
          )}
        </ModalCard>
      </AbrirBotao>
    </ModalProvider>
  );
  fireEvent.click(screen.getByText("abrir"));
}

describe("ModalProvider — teclado", () => {
  it("Escape fecha o modal", () => {
    montar();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Tab no último elemento volta para o primeiro — o foco não escapa", () => {
    montar();
    const campo = screen.getByLabelText("Nome");
    const criar = screen.getByText("Criar");
    criar.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    // Fechar é o último do DOM, então o ciclo volta ao campo — o importante
    // é não vazar para a página atrás do backdrop.
    expect(document.activeElement).not.toBe(document.body);
    expect([campo, criar, screen.getByLabelText("Fechar")]).toContain(
      document.activeElement
    );
  });

  it("Shift+Tab no primeiro elemento vai para o último", () => {
    montar();
    // O primeiro do DOM é o × do cabeçalho — ele não recebe o foco inicial,
    // mas é onde o ciclo começa.
    screen.getByLabelText("Fechar").focus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByText("Criar"));
  });

  it("foca o primeiro campo ao abrir, não o botão de fechar", () => {
    // Abrir e já poder digitar é o que faz o teclado valer a pena.
    montar();
    expect(document.activeElement).toBe(screen.getByLabelText("Nome"));
  });

  it("devolve o foco a quem abriu, ao fechar", () => {
    montar();
    // jsdom não move o foco no clique como o navegador faz, então o estado
    // de origem é montado à mão — é o que o browser real teria.
    screen.getByText("abrir").focus();
    fireEvent.click(screen.getByText("abrir"));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(screen.getByText("abrir"));
  });

  it("trava a rolagem da página enquanto aberto e devolve ao fechar", () => {
    montar();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("ModalProvider — mouse", () => {
  it("clique no backdrop fecha", () => {
    montar();
    const dialog = screen.getByRole("dialog");
    // O backdrop é o avô do card (card → wrapper de stopPropagation → backdrop).
    const backdrop = dialog.parentElement?.parentElement;
    if (!backdrop) {
      throw new Error("backdrop não encontrado");
    }

    fireEvent.click(backdrop);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clique dentro do card não fecha", () => {
    montar();

    fireEvent.click(screen.getByLabelText("Nome"));

    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("ModalCard — semântica", () => {
  it("é um dialog modal rotulado pelo próprio título", () => {
    montar();
    const dialog = screen.getByRole("dialog");

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const rotuloId = dialog.getAttribute("aria-labelledby");
    expect(rotuloId).toBeTruthy();
    expect(document.getElementById(rotuloId ?? "")?.textContent).toBe(
      "Novo tema"
    );
  });

  it("descreve o diálogo pelo subtítulo", () => {
    montar();
    const dialog = screen.getByRole("dialog");
    const descId = dialog.getAttribute("aria-describedby");

    expect(document.getElementById(descId ?? "")?.textContent).toBe(
      "Aposta de investimento"
    );
  });

  it("o botão de fechar tem nome acessível — não só o glifo ×", () => {
    montar();
    expect(screen.getByLabelText("Fechar")).toBeTruthy();
  });
});

describe("useModalSubmitShortcut", () => {
  it("⌘↵ dispara a ação principal de dentro do campo", async () => {
    const onSubmit = vi.fn();
    const { useModalSubmitShortcut } = await import(
      "../../components/cosmos/modal"
    );

    function Corpo() {
      useModalSubmitShortcut(onSubmit);
      return <input aria-label="Nome" />;
    }

    render(
      <ModalProvider>
        <AbrirBotao>
          <ModalCard title="Novo tema">
            <Corpo />
          </ModalCard>
        </AbrirBotao>
      </ModalProvider>
    );
    fireEvent.click(screen.getByText("abrir"));

    fireEvent.keyDown(document, { key: "Enter", metaKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Enter sozinho não dispara — em textarea ele quebra linha", async () => {
    const onSubmit = vi.fn();
    const { useModalSubmitShortcut } = await import(
      "../../components/cosmos/modal"
    );

    function Corpo() {
      useModalSubmitShortcut(onSubmit);
      return <textarea aria-label="Descrição" />;
    }

    render(
      <ModalProvider>
        <AbrirBotao>
          <ModalCard title="Novo tema">
            <Corpo />
          </ModalCard>
        </AbrirBotao>
      </ModalProvider>
    );
    fireEvent.click(screen.getByText("abrir"));

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
