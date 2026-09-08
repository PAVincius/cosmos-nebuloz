/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  encerrarTodasAsSessoes: vi.fn(),
}));

vi.mock("@repo/auth/client", () => ({
  authClient: { signOut: h.signOut },
}));

// Avatar e Icon são cromo: não participam de nenhum comportamento afirmado
// aqui. Mocá-los também tira o teste da dependência de como o monorepo resolve
// o auto-import do `@repo/design-system` — o kit importa os próprios ícones
// pelo nome do pacote, e nenhum teste da casa havia esbarrado nisso ainda.
vi.mock("@repo/design-system/cosmos/kit", () => ({
  Avatar: ({ name }: { name: string }) => <span>{name}</span>,
}));
vi.mock("@repo/design-system/cosmos/icons", () => ({
  Icon: ({ name }: { name: string }) => <i data-icone={name} />,
}));

import { MenuDoPerfil } from "../components/menu-do-perfil";

const STAFF = { name: "Ana Souza", email: "ana@nebuloz.ai" };

/** O menu usa `window.location.assign` para forçar o servidor a reler o cookie.
 *  Em jsdom a implementação real lança "not implemented". */
const irPara = vi.fn();

const oBotao = () => screen.getByRole("button", { name: /Conta de Ana Souza/ });

function abrir() {
  render(<MenuDoPerfil staff={STAFF} />);
  fireEvent.click(oBotao());
}

beforeEach(() => {
  h.signOut.mockReset().mockResolvedValue(undefined);
  h.encerrarTodasAsSessoes.mockReset();
  irPara.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign: irPara },
  });
});

describe("MenuDoPerfil", () => {
  it("mantém o menu fechado até alguém pedir", () => {
    render(<MenuDoPerfil staff={STAFF} />);

    expect(oBotao().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
    // `aria-controls` some junto com o menu: apontar para um id inexistente é
    // ARIA quebrada, e leitor de tela anuncia um alvo que não está lá.
    expect(oBotao().hasAttribute("aria-controls")).toBe(false);
  });

  it("abre com as duas saídas que a conta tem", () => {
    abrir();

    const menu = screen.getByRole("menu");
    expect(oBotao().getAttribute("aria-controls")).toBe(menu.id);
    expect(
      screen
        .getByRole("menuitem", { name: /Aplicativo autenticador/ })
        .getAttribute("href")
    ).toBe("/seguranca");
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeTruthy();
  });

  it("repete nome e e-mail dentro do menu", () => {
    // Não é redundância: abaixo de 1024px a topbar esconde os dois, e aberto o
    // menu vira o único lugar onde a identidade aparece por extenso.
    abrir();

    const menu = screen.getByRole("menu");
    expect(menu.textContent).toContain("Ana Souza");
    expect(menu.textContent).toContain("ana@nebuloz.ai");
  });

  it("encerra só esta sessão e manda para o login", async () => {
    // O escopo importa: a varredura de todas as sessões existe em /seguranca,
    // onde o cadastro do segundo fator precisa derrubar o que veio antes dele.
    // Sair do painel não pode derrubar o celular da pessoa junto.
    abrir();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sair" }));

    await waitFor(() => expect(irPara).toHaveBeenCalledWith("/sign-in"));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.encerrarTodasAsSessoes).not.toHaveBeenCalled();
  });

  it("não navega quando o logout falha", async () => {
    // Navegar mesmo assim levaria a pessoa a /sign-in com o cookie válido, o
    // guard a traria de volta ao painel, e ela leria isso como "o botão de sair
    // não funciona" — sem nada explicando.
    h.signOut.mockRejectedValue(new Error("rede caiu"));
    abrir();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sair" }));

    expect(await screen.findByText(/Não foi possível sair/)).toBeTruthy();
    expect(irPara).not.toHaveBeenCalled();
    const sair = screen.getByRole("menuitem", {
      name: "Sair",
    }) as HTMLButtonElement;
    expect(sair.disabled).toBe(false);
  });

  it("fecha no Escape e devolve o foco ao botão", () => {
    abrir();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(oBotao().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(oBotao());
  });
});
