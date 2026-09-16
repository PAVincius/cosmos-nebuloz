/** @vitest-environment jsdom */
// recuperacao-de-erro.test.tsx — heurística 9 (recuperação): erro e
// não-encontrado dentro da casca, com saída.
//
// Antes não havia error.tsx nem not-found.tsx em (staff): um throw mostrava o
// erro do Next em inglês fora do shell, e notFound() caía no 404 genérico. A
// carteira (/) e o gerador de proposta viravam um parágrafo vermelho solto
// dizendo "recarregue a página" — sem botão. E a Home engolia a falha de
// aprovações e dizia "Nada exige atenção".
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPropostaParaEdicao: vi.fn(),
  listClients: vi.fn(),
  listPlatformApprovals: vi.fn(),
  listPlatformHealth: vi.fn(),
  listServices: vi.fn(),
  listarCatalogoComercial: vi.fn(),
  refresh: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/clients", () => ({
  listClients: mocks.listClients,
}));
vi.mock("@/app/actions/access", () => ({
  listPlatformHealth: mocks.listPlatformHealth,
}));
vi.mock("@/app/actions/approvals", () => ({
  listPlatformApprovals: mocks.listPlatformApprovals,
}));
vi.mock("@/app/actions/catalogo-comercial", () => ({
  listarCatalogoComercial: mocks.listarCatalogoComercial,
}));
vi.mock("@/app/actions/proposta-escopo", () => ({
  getPropostaParaEdicao: mocks.getPropostaParaEdicao,
}));
vi.mock("@/app/actions/services", () => ({
  listServices: mocks.listServices,
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
// O gerador puxa o editor inteiro; aqui só a falha de leitura interessa.
vi.mock("@/app/(staff)/propostas/[id]/gerador", () => ({
  Gerador: () => null,
}));

// Importar uma página puxa o painel dela inteiro — é o import, não o render,
// que pesa; com a suíte em paralelo isso passa dos 5s padrão.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePlatformStaff.mockResolvedValue({ canWrite: true });
});

describe("error.tsx do grupo (staff)", () => {
  it("nomeia a falha, mostra a mensagem em mono e Tentar de novo chama reset", async () => {
    const { default: Erro } = await import("@/app/(staff)/error");
    const reset = vi.fn();
    render(<Erro error={new Error("ECONNREFUSED 5432")} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: "Não deu para carregar esta tela" })
    ).toBeTruthy();
    const mensagem = screen.getByText("ECONNREFUSED 5432");
    expect(mensagem.className).toContain("mono");

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(reset).toHaveBeenCalledTimes(1);
    // Re-renderizar sem rebuscar repetiria a mesma falha do servidor.
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("link", { name: "Voltar para Clientes" })
        .getAttribute("href")
    ).toBe("/");
  });

  it("sem mensagem no erro, não inventa uma", async () => {
    const { default: Erro } = await import("@/app/(staff)/error");
    const semMensagem = new Error("placeholder");
    semMensagem.message = "";
    render(<Erro error={semMensagem} reset={vi.fn()} />);

    // O bloco mono da mensagem não aparece (o eyebrow do cabeçalho também é
    // mono, por isso o seletor é o parágrafo).
    expect(document.querySelector("p.mono")).toBeNull();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });
});

describe("not-found.tsx do grupo (staff)", () => {
  it("diz que não encontrou, o que pode ter acontecido, e leva para /", async () => {
    const { default: NaoEncontrado } = await import("@/app/(staff)/not-found");
    render(<NaoEncontrado />);

    expect(
      screen.getByRole("heading", { name: "Não encontrado" })
    ).toBeTruthy();
    expect(screen.getByText(/O link é antigo/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Voltar para Clientes" })
        .getAttribute("href")
    ).toBe("/");
  });
});

describe("carteira de clientes (/) com falha de leitura", () => {
  it("mantém o cabeçalho, nomeia o erro com role=alert e oferece Tentar de novo", async () => {
    mocks.listClients.mockResolvedValue({
      error: "Banco indisponível.",
      ok: false,
    });
    const { default: Page } = await import("@/app/(staff)/page");
    render(await Page());

    expect(
      screen.getByRole("heading", { level: 1, name: "Carteira de clientes" })
    ).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Banco indisponível."
    );

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("gerador de proposta com falha de leitura", () => {
  it("mantém o cabeçalho, nomeia o erro e oferece Tentar de novo em vez de prosa", async () => {
    mocks.listarCatalogoComercial.mockResolvedValue({
      error: "Catálogo comercial não semeado.",
      ok: false,
    });
    mocks.listServices.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import("@/app/(staff)/propostas/[id]/page");
    render(await Page({ params: Promise.resolve({ id: "nova" }) }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Gerador de proposta" })
    ).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Catálogo comercial não semeado."
    );
    expect(screen.queryByText(/recarregue a página/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("Home com a leitura de aprovações rejeitada", () => {
  it("avisa que aprovações não carregaram e ainda renderiza o resto", async () => {
    mocks.listPlatformHealth.mockResolvedValue({
      data: { integracoes: [], recusas: 0, tenants: 3, ultimosEventos: [] },
      ok: true,
    });
    mocks.listPlatformApprovals.mockResolvedValue({
      error: "Fila indisponível.",
      ok: false,
    });
    const { default: Page } = await import("@/app/(staff)/home/page");
    render(await Page());

    const aviso = screen.getByRole("alert");
    expect(aviso.textContent).toContain("Não foi possível carregar aprovações");
    expect(aviso.textContent).toContain("Fila indisponível.");
    // Não pode dizer que está tudo bem quando não sabe.
    expect(screen.queryByText("Nada exige atenção")).toBeNull();
    // O resto da Home continua de pé.
    expect(screen.getByText("Eventos de auditoria")).toBeTruthy();
    expect(screen.getByText("Clientes")).toBeTruthy();
  });
});
