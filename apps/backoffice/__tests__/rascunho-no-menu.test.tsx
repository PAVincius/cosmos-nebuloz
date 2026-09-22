/** @vitest-environment jsdom */
// rascunho-no-menu.test.tsx — crítica rodada 5: `useAvisoAoSair` só cobria o
// `beforeunload`. Fechar a aba perguntava; clicar num item do menu lateral
// jogava a edição fora calado, porque navegação do App Router não descarrega
// a página. Agora o hook registra o rascunho sujo, e o menu, o wordmark (e a
// paleta) consultam o registro antes de navegar — sem nenhuma tela mudar a
// chamada que já faz.
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAvisoAoSair } from "@/lib/rascunho-sujo";
import { pushMock, zerarRoteador } from "../vitest-mocks/next-navigation";

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@repo/auth/client", () => ({ authClient: { signOut: vi.fn() } }));
// O `<Link>` do Next navega pelo roteador interno dele, que o teste não tem.
// Aqui ele faz o que faz de verdade: roda o `onClick` de quem o usa e, se
// ninguém segurou o clique, navega.
vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    children,
    ...resto
  }: {
    href: string;
    onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
    children: ReactNode;
  }) => (
    <a
      href={href}
      {...resto}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          e.preventDefault();
          pushMock(href);
        }
      }}
    >
      {children}
    </a>
  ),
}));

vi.setConfig({ testTimeout: 20_000 });

function TelaComRascunho({ sujo }: { sujo: boolean }) {
  useAvisoAoSair(sujo);
  return <p>tela</p>;
}

const STAFF = { canWrite: true, email: "ana@nebuloz.ai", name: "Ana" };

async function montar(sujo: boolean) {
  const { ShellChrome } = await import("@/components/chrome");
  return render(
    <ShellChrome staff={STAFF}>
      <TelaComRascunho sujo={sujo} />
    </ShellChrome>
  );
}

function itemDoMenu(nome: string): HTMLElement {
  return within(screen.getByRole("navigation")).getByRole("link", {
    name: nome,
  });
}

beforeEach(() => {
  zerarRoteador("/ip");
});

describe("menu lateral com rascunho sujo", () => {
  it("não navega e pergunta, nomeando a tela", async () => {
    await montar(true);

    fireEvent.click(itemDoMenu("Trilha de auditoria"));

    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Descartar alterações em «Biblioteca de IP»?")
    ).toBeTruthy();
    // Voltar antes de Descartar — a saída primeiro.
    const botoes = within(
      screen.getByRole("group", {
        name: "Descartar alterações em «Biblioteca de IP»?",
      })
    ).getAllByRole("button");
    expect(botoes.map((b) => b.textContent)).toEqual(["Voltar", "Descartar"]);
  });

  it("Descartar navega para o item clicado", async () => {
    await montar(true);

    fireEvent.click(itemDoMenu("Trilha de auditoria"));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(pushMock).toHaveBeenCalledWith("/audit");
    expect(screen.queryByText(/Descartar alterações/)).toBeNull();
  });

  it("Voltar fica na tela e some com a pergunta", async () => {
    await montar(true);

    fireEvent.click(itemDoMenu("Trilha de auditoria"));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Descartar alterações/)).toBeNull();
  });

  it("o wordmark também pergunta", async () => {
    await montar(true);

    fireEvent.click(
      screen.getByRole("link", { name: "Nebuloz — ir para a Home" })
    );

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Descartar alterações em/)).toBeTruthy();
  });

  it("ctrl/⌘+clique abre outra aba — nada se perde, não pergunta", async () => {
    await montar(true);

    fireEvent.click(itemDoMenu("Trilha de auditoria"), { ctrlKey: true });

    expect(screen.queryByText(/Descartar alterações/)).toBeNull();
  });
});

describe("sem rascunho sujo", () => {
  it("useAvisoAoSair(false): o menu navega direto", async () => {
    await montar(false);

    fireEvent.click(itemDoMenu("Trilha de auditoria"));

    expect(pushMock).toHaveBeenCalledWith("/audit");
    expect(screen.queryByText(/Descartar alterações/)).toBeNull();
  });

  it("o rascunho que deixou de estar sujo sai do registro", async () => {
    const { rerender } = await montar(true);
    const { ShellChrome } = await import("@/components/chrome");
    rerender(
      <ShellChrome staff={STAFF}>
        <TelaComRascunho sujo={false} />
      </ShellChrome>
    );

    fireEvent.click(itemDoMenu("Trilha de auditoria"));

    expect(pushMock).toHaveBeenCalledWith("/audit");
  });

  it("a tela que saiu leva o rascunho junto", async () => {
    const { rerender } = await montar(true);
    const { ShellChrome } = await import("@/components/chrome");
    rerender(<ShellChrome staff={STAFF}>outra tela</ShellChrome>);

    fireEvent.click(itemDoMenu("Trilha de auditoria"));

    expect(pushMock).toHaveBeenCalledWith("/audit");
  });
});

describe("menu do perfil com rascunho sujo (onda 9b)", () => {
  // O "Aplicativo autenticador" é um `<Link>` do shell como os do menu
  // lateral, e pulava a guarda: a edição sumia calada no caminho de /seguranca.
  async function abrirAutenticador() {
    fireEvent.click(screen.getByRole("button", { name: "Conta de Ana" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Aplicativo autenticador" })
    );
  }

  it("não navega e pergunta", async () => {
    await montar(true);
    await abrirAutenticador();

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Descartar alterações em/)).toBeTruthy();
  });

  it("Descartar leva a /seguranca", async () => {
    await montar(true);
    await abrirAutenticador();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(pushMock).toHaveBeenCalledWith("/seguranca");
  });

  it("sem rascunho, navega direto", async () => {
    await montar(false);
    await abrirAutenticador();

    expect(pushMock).toHaveBeenCalledWith("/seguranca");
    expect(screen.queryByText(/Descartar alterações/)).toBeNull();
  });
});
