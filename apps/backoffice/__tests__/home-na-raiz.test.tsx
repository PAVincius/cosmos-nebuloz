/** @vitest-environment jsdom */
// home-na-raiz.test.tsx — decisão do dono na crítica rodada 5: `/` é a Home
// e a carteira mora em `/clientes`. Antes o painel abria na carteira e a Home
// vivia em `/home`, e todo link "para a casa" precisava lembrar qual das duas
// era a casa. `/home` continua existindo como redirect, com a query junto,
// porque há link velho colado em ticket e link da outra frente apontando para
// lá.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  replaceStateMock,
  zerarRoteador,
} from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  listClients: vi.fn(),
  listPlatformApprovals: vi.fn(),
  listPlatformHealth: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", async () => ({
  ...(await import("../vitest-mocks/next-navigation")),
  redirect: mocks.redirect,
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@repo/auth/client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/app/actions/clients", () => ({ listClients: mocks.listClients }));
vi.mock("@/app/actions/access", () => ({
  listPlatformHealth: mocks.listPlatformHealth,
}));
vi.mock("@/app/actions/approvals", () => ({
  listPlatformApprovals: mocks.listPlatformApprovals,
}));

// Importar uma página puxa o painel dela inteiro; com a suíte em paralelo o
// import passa dos 5s padrão.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/");
  mocks.listClients.mockResolvedValue({
    data: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "t1",
        memberCount: 2,
        modules: [],
        name: "Acme",
        plan: "ORBIT",
        slug: "acme",
      },
    ],
    ok: true,
  });
  mocks.listPlatformHealth.mockResolvedValue({
    data: { integracoes: [], recusas: 0, tenants: 1, ultimosEventos: [] },
    ok: true,
  });
  mocks.listPlatformApprovals.mockResolvedValue({ data: [], ok: true });
});

describe("rotas", () => {
  it("/ renderiza a Home", async () => {
    const { default: Page } = await import("@/app/(staff)/page");
    render(await Page());

    expect(
      screen.getByRole("heading", { level: 1, name: "Home" })
    ).toBeTruthy();
    expect(mocks.listPlatformHealth).toHaveBeenCalledTimes(1);
    expect(mocks.listClients).not.toHaveBeenCalled();
  });

  it("/clientes renderiza a carteira, com a busca", async () => {
    const { default: Page } = await import("@/app/(staff)/clientes/page");
    render(await Page());

    expect(
      screen.getByRole("heading", { level: 1, name: "Carteira de clientes" })
    ).toBeTruthy();
    expect(
      screen.getByRole("searchbox", { name: "Buscar cliente" })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Acme/ }).getAttribute("href")
    ).toBe("/clientes/acme");
  });

  it("/home redireciona para /, levando a query junto", async () => {
    const { default: Page } = await import("@/app/(staff)/home/page");
    await Page({ searchParams: Promise.resolve({ atencao: "1", q: "acme" }) });

    expect(mocks.redirect).toHaveBeenCalledWith("/?atencao=1&q=acme");
  });

  it("/home sem query redireciona para / limpo", async () => {
    const { default: Page } = await import("@/app/(staff)/home/page");
    await Page({ searchParams: Promise.resolve({}) });

    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });
});

describe("nav.ts", () => {
  it("Home é /, Clientes é /clientes, os dois em Plataforma", async () => {
    const { itemDaRota, secaoDaRota, tituloDaAba } = await import(
      "@/components/nav"
    );

    expect(itemDaRota("/")?.label).toBe("Home");
    expect(itemDaRota("/clientes")?.label).toBe("Clientes");
    expect(itemDaRota("/home")).toBeUndefined();
    expect(secaoDaRota("/")).toBe("Plataforma");
    expect(secaoDaRota("/clientes")).toBe("Plataforma");
    expect(tituloDaAba("/")).toBe("Home — Back-office Nebuloz");
    expect(tituloDaAba("/clientes")).toBe("Clientes — Back-office Nebuloz");
  });
});

describe("um só aria-current na sidebar", () => {
  async function ativos(rota: string): Promise<string[]> {
    zerarRoteador(rota);
    const { ShellChrome } = await import("@/components/chrome");
    const { unmount } = render(
      <ShellChrome
        staff={{ canWrite: true, email: "ana@nebuloz.ai", name: "Ana" }}
      >
        x
      </ShellChrome>
    );
    const nav = screen.getByRole("navigation");
    const rotulos = within(nav)
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page")
      .map((l) => l.textContent ?? "");
    unmount();
    return rotulos;
  }

  it.each([
    ["/", "Home"],
    ["/clientes", "Clientes"],
    ["/clientes/acme", "Clientes"],
    ["/clientes/novo", "Provisionar cliente"],
    ["/audit", "Trilha de auditoria"],
  ])("em %s acende só %s", async (rota, rotulo) => {
    expect(await ativos(rota)).toEqual([rotulo]);
  });

  it("wordmark leva para /", async () => {
    const { ShellChrome } = await import("@/components/chrome");
    render(
      <ShellChrome
        staff={{ canWrite: true, email: "ana@nebuloz.ai", name: "Ana" }}
      >
        x
      </ShellChrome>
    );

    expect(
      screen
        .getByRole("link", { name: "Nebuloz — ir para a Home" })
        .getAttribute("href")
    ).toBe("/");
  });
});

describe("detalhe do cliente — ?criado=1 some da URL depois da frase", () => {
  it("mostra a frase e tira só o criado da URL", async () => {
    zerarRoteador("/clientes/acme", "criado=1&aba=usuarios");
    const { ConfirmacaoDeUmaVez } = await import(
      "@/components/confirmacao-de-uma-vez"
    );
    render(
      <ConfirmacaoDeUmaVez param="criado">
        Cliente Acme provisionado.
      </ConfirmacaoDeUmaVez>
    );

    expect(screen.getByText("Cliente Acme provisionado.")).toBeTruthy();
    expect(replaceStateMock).toHaveBeenCalledWith(
      null,
      "",
      "/clientes/acme?aba=usuarios"
    );
    // A frase fica: some da URL (F5 não repete), não da tela.
    expect(screen.getByText("Cliente Acme provisionado.")).toBeTruthy();
  });

  it("sem o param na URL, não toca na URL", async () => {
    zerarRoteador("/clientes/acme", "aba=usuarios");
    const { ConfirmacaoDeUmaVez } = await import(
      "@/components/confirmacao-de-uma-vez"
    );
    render(
      <ConfirmacaoDeUmaVez param="criado">
        Cliente Acme provisionado.
      </ConfirmacaoDeUmaVez>
    );

    expect(replaceStateMock).not.toHaveBeenCalled();
  });
});
