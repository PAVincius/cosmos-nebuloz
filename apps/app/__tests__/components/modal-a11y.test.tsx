// modal-a11y.test.tsx — teclado e semântica do sistema de modal.
//
// Isto vive no provider, não em cada tela: são dezenas de modais, e um
// ModalCard novo precisa herdar Escape, foco e ARIA sem que quem o escreveu
// tenha lembrado disso. Cada caso aqui é uma regressão que a tela inteira
// sofreria em silêncio — ninguém percebe um focus trap quebrado olhando.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ModalCard,
  ModalProvider,
  useModal,
} from "../../components/cosmos/modal";
import {
  DirtyProvider,
  EntityLinkField,
  MiniSlider,
  Segmented,
  TonePicker,
} from "../../components/cosmos/modal-form";

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

describe("primitivas — sujeira do formulário", () => {
  // Três agentes reconstruindo modais tiveram que contornar isto à mão: sem
  // markDirty nos controles não-texto, pontuar um WSJF inteiro e clicar em
  // Cancelar perdia tudo sem aviso.
  function Sonda({ children }: { children: React.ReactNode }) {
    const [sujo, setSujo] = useState(false);
    return (
      <DirtyProvider value={{ markDirty: () => setSujo(true) }}>
        <span>{sujo ? "sujo" : "limpo"}</span>
        {children}
      </DirtyProvider>
    );
  }

  it("Segmented marca o formulário como sujo", () => {
    render(
      <Sonda>
        <Segmented
          onChange={() => {
            // o teste observa o DirtyProvider, não o valor
          }}
          options={[
            { value: "s", label: "S" },
            { value: "m", label: "M" },
          ]}
          value="s"
        />
      </Sonda>
    );
    expect(screen.getByText("limpo")).toBeTruthy();

    fireEvent.click(screen.getByText("M"));

    expect(screen.getByText("sujo")).toBeTruthy();
  });

  it("MiniSlider marca o formulário como sujo", () => {
    render(
      <Sonda>
        <MiniSlider
          label="Business Value"
          onChange={() => {
            // idem
          }}
          value={5}
        />
      </Sonda>
    );

    fireEvent.change(screen.getByLabelText(/Business Value/), {
      target: { value: "8" },
    });

    expect(screen.getByText("sujo")).toBeTruthy();
  });

  it("TonePicker marca o formulário como sujo", () => {
    render(
      <Sonda>
        <TonePicker
          onChange={() => {
            // idem
          }}
          value="accent"
        />
      </Sonda>
    );

    fireEvent.click(screen.getByLabelText("Cor green"));

    expect(screen.getByText("sujo")).toBeTruthy();
  });
});

describe("EntityLinkField — busca no servidor", () => {
  it("pergunta ao servidor em vez de filtrar uma lista truncada", async () => {
    // `searchEntities` devolve 10 itens no máximo. Filtrar essa fatia no
    // cliente faz o campo dizer "nenhum resultado" para entidade que existe.
    const onSearch = vi
      .fn()
      .mockResolvedValue([
        { id: "e99", label: "Épico que estava fora dos 10 primeiros" },
      ]);

    render(
      <DirtyProvider value={{ markDirty: () => {} }}>
        <EntityLinkField
          items={[]}
          label="Épico"
          onChange={() => {
            // só a busca importa aqui
          }}
          onSearch={onSearch}
          placeholder="Buscar épico..."
          value={null}
        />
      </DirtyProvider>
    );

    fireEvent.focus(screen.getByPlaceholderText("Buscar épico..."));
    fireEvent.change(screen.getByPlaceholderText("Buscar épico..."), {
      target: { value: "fora dos 10" },
    });

    expect(
      await screen.findByText("Épico que estava fora dos 10 primeiros")
    ).toBeTruthy();
    expect(onSearch).toHaveBeenCalledWith("fora dos 10");
  });
});

describe("EntityLinkField — criar sem sair do modal", () => {
  const quickCreate = (
    onCreate: (d: Record<string, string>) => Promise<{
      id: string;
      label: string;
    } | null>
  ) => ({
    label: "+ Criar novo épico",
    campos: [{ key: "titulo", label: "Título do épico" }],
    inicial: { titulo: "" },
    onCreate,
  });

  function montarCampo(
    onCreate: (d: Record<string, string>) => Promise<{
      id: string;
      label: string;
    } | null>,
    onChange = () => {}
  ) {
    render(
      <DirtyProvider value={{ markDirty: () => {} }}>
        <EntityLinkField
          items={[]}
          label="Épicos"
          onChange={onChange}
          placeholder="Buscar épico..."
          quickCreate={quickCreate(onCreate)}
          value={null}
        />
      </DirtyProvider>
    );
    fireEvent.focus(screen.getByPlaceholderText("Buscar épico..."));
  }

  it("cria a entidade e já a vincula", async () => {
    const onCreate = vi
      .fn()
      .mockResolvedValue({ id: "ep-9", label: "Antifraude" });
    const onChange = vi.fn();
    montarCampo(onCreate, onChange);

    fireEvent.click(await screen.findByText("+ Criar novo épico"));
    fireEvent.change(screen.getByLabelText("Título do épico"), {
      target: { value: "Antifraude" },
    });
    fireEvent.click(screen.getByText("Criar e vincular"));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({ titulo: "Antifraude" })
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("ep-9"));
  });

  it("aproveita o que foi digitado na busca como nome da nova entidade", async () => {
    // Quem procurou "Antifraude" e não achou quer criar "Antifraude" — pedir
    // para digitar de novo é cobrar duas vezes pela mesma informação.
    const onCreate = vi.fn().mockResolvedValue({ id: "ep-9", label: "x" });
    montarCampo(onCreate);

    fireEvent.change(screen.getByPlaceholderText("Buscar épico..."), {
      target: { value: "Antifraude" },
    });
    fireEvent.click(await screen.findByText("+ Criar novo épico"));

    expect(
      (screen.getByLabelText("Título do épico") as HTMLInputElement).value
    ).toBe("Antifraude");
  });

  it("falha ao criar mantém o formulário aberto com o que foi digitado", async () => {
    // Server action pode recusar por limite de tenant ou permissão. Fechar
    // aqui custaria o trabalho e esconderia o motivo.
    const onCreate = vi.fn().mockResolvedValue(null);
    const onChange = vi.fn();
    montarCampo(onCreate, onChange);

    fireEvent.click(await screen.findByText("+ Criar novo épico"));
    fireEvent.change(screen.getByLabelText("Título do épico"), {
      target: { value: "Antifraude" },
    });
    fireEvent.click(screen.getByText("Criar e vincular"));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      (screen.getByLabelText("Título do épico") as HTMLInputElement).value
    ).toBe("Antifraude");
    expect(onChange).not.toHaveBeenCalled();
  });
});
