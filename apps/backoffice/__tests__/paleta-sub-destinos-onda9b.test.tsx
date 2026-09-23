/** @vitest-environment jsdom */
// paleta-sub-destinos-onda9b.test.tsx — crítica R6, H7: o Ctrl+K só sabia
// ir aonde o menu ia. As sete abas do Financeiro e as abas do cliente eram
// dois cliques depois do salto; e a paleta abria sempre do zero, sem lembrar
// para onde a pessoa acabou de ir. Agora: sub-destinos como itens filhos e
// os últimos 5 destinos em `localStorage` — que, se lançar, não quebra nada.
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushMock, zerarRoteador } from "../vitest-mocks/next-navigation";

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.setConfig({ testTimeout: 20_000 });

const buscarClientes = vi.fn();

async function montar() {
  const { Paleta } = await import("@/components/paleta");
  return render(
    <Paleta buscarClientes={buscarClientes} telaAtual="Biblioteca de IP" />
  );
}

async function abrir() {
  fireEvent.keyDown(document, { ctrlKey: true, key: "k" });
  await screen.findByRole("dialog");
}

function campo(): HTMLElement {
  return screen.getByRole("combobox");
}

function opcoes(): string[] {
  return within(screen.getByRole("listbox"))
    .queryAllByRole("option")
    .map((o) => o.getAttribute("data-rotulo") ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/ip");
  window.localStorage.clear();
  buscarClientes.mockResolvedValue({ data: [], ok: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sub-destinos do Financeiro", () => {
  it("digitar 'títulos' mostra a aba do Financeiro e Enter vai direto nela", async () => {
    await montar();
    await abrir();

    fireEvent.change(campo(), { target: { value: "títulos" } });

    const titulos = screen.getByRole("option", { name: /Títulos/ });
    expect(titulos.textContent).toContain("Financeiro");
    fireEvent.keyDown(campo(), { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/empresa/financeiro?aba=titulos");
  });

  it("'financeiro' traz a tela e as sete abas logo abaixo dela", async () => {
    await montar();
    await abrir();

    fireEvent.change(campo(), { target: { value: "financeiro" } });

    const lista = opcoes();
    const i = lista.indexOf("Financeiro");
    expect(lista.slice(i + 1, i + 8)).toEqual([
      "DRE mensal",
      "Lançamentos",
      "Títulos",
      "Orçado × realizado",
      "Receita recorrente",
      "Caixa",
      "Plano de contas",
    ]);
  });

  it("sem texto, as abas não inflam a lista", async () => {
    await montar();
    await abrir();
    expect(opcoes()).not.toContain("Receita recorrente");
  });
});

describe("abas do cliente achado", () => {
  it("o cliente vem com as abas dele como filhos", async () => {
    buscarClientes.mockResolvedValue({
      data: [{ name: "Acme Ltda", slug: "acme" }],
      ok: true,
    });
    await montar();
    await abrir();

    fireEvent.change(campo(), { target: { value: "acme" } });
    await waitFor(() => expect(opcoes()).toContain("Acme Ltda"));

    const lista = opcoes();
    const i = lista.indexOf("Acme Ltda");
    expect(lista.slice(i + 1, i + 4)).toEqual([
      "Usuários",
      "Integrações",
      "Trilha de auditoria",
    ]);

    fireEvent.click(
      within(screen.getByRole("listbox")).getAllByRole("option")[i + 1]
    );
    expect(pushMock).toHaveBeenCalledWith("/clientes/acme?aba=usuarios");
  });
});

describe("recentes", () => {
  it("abrir vazio mostra os destinos escolhidos antes, o último primeiro", async () => {
    await montar();
    await abrir();
    fireEvent.change(campo(), { target: { value: "títulos" } });
    fireEvent.keyDown(campo(), { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await abrir();
    fireEvent.change(campo(), { target: { value: "auditoria" } });
    fireEvent.keyDown(campo(), { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await abrir();
    const recentes = screen.getByRole("group", { name: "Recentes" });
    expect(
      within(recentes)
        .getAllByRole("option")
        .map((o) => o.getAttribute("data-rotulo"))
    ).toEqual(["Trilha de auditoria", "Títulos"]);
  });

  it("guarda no máximo cinco", async () => {
    window.localStorage.setItem(
      "bo:paleta:recentes",
      JSON.stringify(
        Array.from({ length: 8 }, (_, i) => ({
          detalhe: "Plataforma",
          href: `/x${i}`,
          icone: "home",
          rotulo: `Tela ${i}`,
        }))
      )
    );
    await montar();
    await abrir();

    const recentes = screen.getByRole("group", { name: "Recentes" });
    expect(within(recentes).getAllByRole("option")).toHaveLength(5);
  });

  it("lixo no storage é ignorado, não quebra", async () => {
    window.localStorage.setItem("bo:paleta:recentes", "{não é json");
    await montar();
    await abrir();
    expect(screen.queryByRole("group", { name: "Recentes" })).toBeNull();
    expect(opcoes().length).toBeGreaterThan(0);
  });

  it("storage que lança: a paleta abre, lista e navega igual", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    await montar();
    await abrir();

    expect(opcoes().length).toBeGreaterThan(0);
    fireEvent.change(campo(), { target: { value: "auditoria" } });
    fireEvent.keyDown(campo(), { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/audit");
  });
});
