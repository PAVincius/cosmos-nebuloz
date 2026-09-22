/** @vitest-environment jsdom */
// paleta.test.tsx — crítica rodada 5: H7 (flexibilidade e eficiência) em 2
// há cinco rodadas. Quem sabe para onde quer ir atravessava a sidebar de 25
// itens ou a carteira inteira. Ctrl/⌘+K abre uma paleta de salto: as telas
// do menu e, a partir de 2 letras, clientes por nome ou slug — só teclado,
// e passando pela mesma guarda de rascunho do menu.
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAvisoAoSair } from "@/lib/rascunho-sujo";
import { pushMock, zerarRoteador } from "../vitest-mocks/next-navigation";

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@repo/auth/client", () => ({ authClient: { signOut: vi.fn() } }));

vi.setConfig({ testTimeout: 20_000 });

const buscarClientes = vi.fn();

async function montar(extra?: React.ReactNode) {
  const { Paleta } = await import("@/components/paleta");
  return render(
    <>
      {extra}
      <Paleta buscarClientes={buscarClientes} telaAtual="Biblioteca de IP" />
    </>
  );
}

function gatilho(): HTMLElement {
  return screen.getByRole("button", { name: /Ir para/ });
}

function apertarCtrlK(alvo: Element | Document = document, meta = false) {
  fireEvent.keyDown(alvo, {
    ctrlKey: !meta,
    key: "k",
    metaKey: meta,
  });
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
  buscarClientes.mockResolvedValue({
    data: [{ name: "Acme Ltda", slug: "acme" }],
    ok: true,
  });
});

describe("abrir", () => {
  it("Ctrl+K abre a paleta com o foco na busca", async () => {
    await montar();
    expect(screen.queryByRole("dialog")).toBeNull();

    apertarCtrlK();

    expect(await screen.findByRole("dialog")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(campo()));
  });

  it("⌘+K também abre", async () => {
    await montar();

    apertarCtrlK(document, true);

    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("o gatilho visível escreve o atalho e abre no clique", async () => {
    await montar();

    expect(gatilho().textContent).toMatch(/K/);
    expect(gatilho().getAttribute("aria-keyshortcuts")).toContain("Control+K");
    fireEvent.click(gatilho());

    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("dentro de <input> ou <textarea> o atalho não dispara", async () => {
    await montar(
      <>
        <input aria-label="nome" />
        <textarea aria-label="nota" />
      </>
    );

    apertarCtrlK(screen.getByLabelText("nome"));
    apertarCtrlK(screen.getByLabelText("nota"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("filtrar e ir", () => {
  // Sem cliente nenhum: aqui a lista é só de telas, e a posição de cada
  // opção não depende de quando a busca de clientes responde.
  beforeEach(() => {
    buscarClientes.mockResolvedValue({ data: [], ok: true });
  });

  it("sem texto lista todas as telas do menu; digitar filtra", async () => {
    const { BO_NAV } = await import("@/components/nav");
    await montar();
    apertarCtrlK();
    await screen.findByRole("dialog");

    expect(opcoes()).toHaveLength(BO_NAV.flatMap((g) => g.items).length);

    fireEvent.change(campo(), { target: { value: "auditoria" } });

    expect(opcoes()).toContain("Trilha de auditoria");
    expect(opcoes()).not.toContain("Home");
  });

  it("setas movem a opção ativa (aria-activedescendant) e Enter vai", async () => {
    await montar();
    apertarCtrlK();
    await screen.findByRole("dialog");
    fireEvent.change(campo(), { target: { value: "empresa" } });

    const lista = opcoes();
    expect(lista[0]).toBe("Fornecedores e DPA");
    fireEvent.keyDown(campo(), { key: "ArrowDown" });

    const ativa = document.getElementById(
      campo().getAttribute("aria-activedescendant") ?? ""
    );
    expect(ativa?.getAttribute("data-rotulo")).toBe(lista[1]);
    expect(ativa?.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(campo(), { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/empresa/consentimento");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("ArrowUp no topo dá a volta para o fim", async () => {
    await montar();
    apertarCtrlK();
    await screen.findByRole("dialog");
    fireEvent.change(campo(), { target: { value: "empresa" } });

    fireEvent.keyDown(campo(), { key: "ArrowUp" });
    fireEvent.keyDown(campo(), { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/empresa/financeiro");
  });

  it("Esc fecha e devolve o foco ao gatilho", async () => {
    await montar();
    fireEvent.click(gatilho());
    await screen.findByRole("dialog");

    fireEvent.keyDown(campo(), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(gatilho()));
  });
});

describe("clientes", () => {
  it("a partir de 2 letras busca clientes por nome/slug e Enter abre o detalhe", async () => {
    await montar();
    apertarCtrlK();
    await screen.findByRole("dialog");

    fireEvent.change(campo(), { target: { value: "acm" } });

    await waitFor(() => expect(opcoes()).toContain("Acme Ltda"));
    expect(buscarClientes).toHaveBeenCalledWith("acm");

    // "acm" não casa com tela nenhuma — o cliente é a primeira opção.
    const acme = screen.getByRole("option", { name: /Acme Ltda/ });
    expect(acme.textContent).toContain("acme");
    fireEvent.keyDown(campo(), { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/clientes/acme");
  });

  it("com 1 letra não busca cliente", async () => {
    await montar();
    apertarCtrlK();
    await screen.findByRole("dialog");

    fireEvent.change(campo(), { target: { value: "a" } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    expect(buscarClientes).not.toHaveBeenCalled();
  });

  it("a busca que falha diz o motivo, não 'nenhum cliente'", async () => {
    buscarClientes.mockResolvedValue({ error: "Banco fora.", ok: false });
    await montar();
    apertarCtrlK();
    await screen.findByRole("dialog");

    fireEvent.change(campo(), { target: { value: "acme" } });

    expect(await screen.findByText(/Banco fora\./)).toBeTruthy();
    expect(screen.queryByText(/Nenhum cliente/)).toBeNull();
  });
});

describe("guarda de rascunho", () => {
  function Sujo() {
    useAvisoAoSair(true);
    return null;
  }

  it("com rascunho sujo, Enter pergunta em vez de navegar; Descartar vai", async () => {
    await montar(<Sujo />);
    apertarCtrlK();
    await screen.findByRole("dialog");
    fireEvent.change(campo(), { target: { value: "auditoria" } });

    fireEvent.keyDown(campo(), { key: "Enter" });

    expect(pushMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Descartar alterações em «Biblioteca de IP»?")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(pushMock).toHaveBeenCalledWith("/audit");
  });
});

describe("no shell", () => {
  it("o gatilho mora na topbar", async () => {
    const { ShellChrome } = await import("@/components/chrome");
    render(
      <ShellChrome
        buscarClientes={buscarClientes}
        staff={{ canWrite: true, email: "ana@nebuloz.ai", name: "Ana" }}
      >
        x
      </ShellChrome>
    );

    expect(
      within(screen.getByRole("banner")).getByRole("button", {
        name: /Ir para/,
      })
    ).toBeTruthy();
  });
});
