/** @vitest-environment jsdom */
// copy-sobras.test.tsx — heurísticas 2 (mundo real) e 4 (consistência): as
// sobras de copy e IA que o #214 não pôde tocar.
//
// Um nome por coisa: a trilha da topbar dizia "Tenant" enquanto o menu diz
// "Clientes"; o menu dizia "Criar tenant" e a tela "+ Provisionar cliente";
// "Health e renovação" em inglês pela metade. O eyebrow do Scaffold era
// string solta em vez da seção do menu. O nível de um sinal de saúde vinha só
// por cor. O status por módulo era um botão tri-state com aria-pressed
// booleano. A barreira de rejeitar mostrava o id do pedido, não o pedido. E
// "(s)" no lugar de plural.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewClientForm } from "@/app/(staff)/clientes/novo/form";
import type { ContaComSaude } from "@/app/actions/accounts";
import type { PlatformApprovalRow } from "@/app/actions/approvals";
import { ShellChrome } from "@/components/chrome";
import { itemDaRota, secaoDaRota } from "@/components/nav";

const mocks = vi.hoisted(() => ({
  listAccountHealth: vi.fn(),
  listClients: vi.fn(),
  listGateQueue: vi.fn(),
  listPlatformApprovals: vi.fn(),
  listPlatformHealth: vi.fn(),
  pathname: "/",
  provisionTenantAction: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@repo/auth/client", () => ({
  authClient: { signOut: vi.fn() },
}));
vi.mock("@/app/actions/agregados", () => import("../vitest-mocks/agregados"));
vi.mock("@/app/actions/accounts", () => ({
  listAccountHealth: mocks.listAccountHealth,
}));
vi.mock("@/app/actions/clients", () => ({
  listClients: mocks.listClients,
}));
vi.mock("@/app/actions/access", () => ({
  listPlatformHealth: mocks.listPlatformHealth,
}));
vi.mock("@/app/actions/approvals", () => ({
  decidePlatformApprovalAction: vi.fn(),
  listPlatformApprovals: mocks.listPlatformApprovals,
}));
vi.mock("@/app/actions/scaffold-supervision", () => ({
  enterTenantContext: vi.fn(),
  listGateQueue: mocks.listGateQueue,
}));
vi.mock("@/app/actions/provisioning", () => ({
  provisionTenantAction: mocks.provisionTenantAction,
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));

vi.setConfig({ testTimeout: 20_000 });

const STAFF = { canWrite: true, email: "ana@nebuloz.ai", name: "Ana" };

const CONTA: ContaComSaude = {
  diasParaRenovar: 12,
  modulos: [{ module: "COSMOS", status: "ACTIVE" }],
  nome: "Atlas",
  plano: "scale",
  renovaEm: "2026-09-28",
  saude: "RISCO",
  sinais: [
    { nivel: "RISCO", texto: "Módulo COSMOS suspenso." },
    { nivel: "ATENCAO", texto: "Renova em 12 dias." },
  ],
  slug: "atlas",
  ultimaAtividade: null,
};

const PEDIDO: PlatformApprovalRow = {
  acao: "enviar_proposta_com_desconto",
  alvoLabel: "P-0042 · Diagnóstico Atlas",
  alvoTipo: "proposal",
  criadoEm: "2026-09-10T12:00:00.000Z",
  decididoEm: null,
  decisorNome: null,
  id: "apr-1",
  impacto: "20% sobre a proposta.",
  motivo: "Desconto de 20% em P-0042, acima do limite.",
  nota: null,
  solicitanteNome: "Bia",
  status: "PENDING_APPROVAL",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/";
  mocks.requirePlatformStaff.mockResolvedValue({ canWrite: true });
});

describe("um nome por coisa", () => {
  it("menu: Provisionar cliente e Saúde e renovação", () => {
    expect(itemDaRota("/clientes/novo")?.label).toBe("Provisionar cliente");
    expect(itemDaRota("/contas")?.label).toBe("Saúde e renovação");
  });

  it("a trilha da topbar diz Cliente e Provisionar cliente, nunca Tenant", () => {
    mocks.pathname = "/clientes/atlas";
    const { unmount } = render(<ShellChrome staff={STAFF}>x</ShellChrome>);
    // A trilha é o único `.bo-so-largo` da topbar com o separador "›".
    const trilha = () =>
      Array.from(document.querySelectorAll("header .bo-so-largo"))
        .map((el) => el.textContent ?? "")
        .find((t) => t.includes("›")) ?? "";
    expect(trilha()).toContain("Cliente");
    expect(trilha()).not.toMatch(/Tenant/);
    unmount();

    mocks.pathname = "/clientes/novo";
    render(<ShellChrome staff={STAFF}>x</ShellChrome>);
    expect(trilha()).toContain("Provisionar cliente");
    expect(document.body.textContent).not.toMatch(/Criar tenant/);
  });

  it("a tela de Saúde e renovação se intitula como o menu", async () => {
    mocks.listAccountHealth.mockResolvedValue({
      data: { itens: [], temMais: false },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/contas/page");
    render(await Page());

    expect(
      screen.getByRole("heading", { level: 1, name: "Saúde e renovação" })
    ).toBeTruthy();
    expect(screen.queryByText(/Health/)).toBeNull();
  });

  it("a carteira vazia manda para Provisionar cliente", async () => {
    mocks.listClients.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import("@/app/(staff)/clientes/page");
    render(await Page());

    expect(
      screen
        .getByRole("link", { name: "Provisionar cliente" })
        .getAttribute("href")
    ).toBe("/clientes/novo");
    expect(screen.queryByText(/Criar tenant/)).toBeNull();
  });

  it("a Home diz Clientes, não Tenants", async () => {
    mocks.listPlatformHealth.mockResolvedValue({
      data: { integracoes: [], recusas: 0, tenants: 1, ultimosEventos: [] },
      ok: true,
    });
    mocks.listPlatformApprovals.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import("@/app/(staff)/page");
    render(await Page());

    expect(screen.queryByText(/Tenants/)).toBeNull();
    expect(screen.getByText(/fica em Clientes/)).toBeTruthy();
  });
});

describe("plural real, não (s)", () => {
  it("Home: 1 integração com erro, 2 acessos recusados", async () => {
    mocks.listPlatformHealth.mockResolvedValue({
      data: {
        integracoes: [{ id: "i1" }],
        recusas: 2,
        tenants: 1,
        ultimosEventos: [],
      },
      ok: true,
    });
    mocks.listPlatformApprovals.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import("@/app/(staff)/page");
    render(await Page());

    expect(screen.getByText("1 integração com erro")).toBeTruthy();
    expect(screen.getByText("2 acessos recusados")).toBeTruthy();
    expect(screen.queryByText(/\(s\)|\(ões\)/)).toBeNull();
  });
});

describe("eyebrow do Scaffold = seção do menu", () => {
  it("/scaffold abre com a seção do nav.ts", async () => {
    mocks.listGateQueue.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import("@/app/(staff)/scaffold/page");
    render(await Page());

    expect(
      screen.getByText(new RegExp(`^${secaoDaRota("/scaffold")} · `))
    ).toBeTruthy();
    expect(screen.queryByText(/^Scaffold · /)).toBeNull();
  });
});

describe("sinal de saúde com palavra, não só cor", () => {
  it("cada sinal diz o nível em texto", async () => {
    mocks.listAccountHealth.mockResolvedValue({
      data: { itens: [CONTA], temMais: false },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/contas/page");
    render(await Page());

    const critico = screen.getByText("Crítico");
    expect(critico.closest("li")?.textContent).toContain(
      "Módulo COSMOS suspenso."
    );
    const atencao = screen
      .getAllByText("Atenção")
      .find((el) => el.closest("li")?.textContent?.includes("Renova em"));
    expect(atencao).toBeTruthy();
  });
});

describe("status inicial por módulo é um grupo de rádio", () => {
  it("três opções por módulo, uma marcada, com o estado em texto", () => {
    render(<NewClientForm canWrite modulos={["COSMOS", "CHARTER"]} />);

    expect(
      screen.getAllByRole("radio", { name: /Ativo|Trial|Fora/ })
    ).toHaveLength(6);
    // Um marcado por grupo: COSMOS nasce Ativo (default histórico), CHARTER
    // nasce Fora — e "Fora" também é uma escolha com nome, não ausência.
    const cosmos = within(screen.getByRole("radiogroup", { name: /Cosmos/ }));
    expect(cosmos.getByRole("radio", { checked: true })).toBe(
      cosmos.getByRole("radio", { name: "Ativo" })
    );
    const charter = within(screen.getByRole("radiogroup", { name: /Charter/ }));
    expect(charter.getByRole("radio", { checked: true })).toBe(
      charter.getByRole("radio", { name: "Fora" })
    );
    expect(screen.queryByRole("button", { pressed: true })).toBeNull();
  });

  it("marcar Trial muda o payload; Fora tira o módulo", async () => {
    mocks.provisionTenantAction.mockResolvedValue({
      data: { ownerLinked: true, slug: "atlas" },
      ok: true,
    });
    render(<NewClientForm canWrite modulos={["COSMOS", "CHARTER"]} />);
    fireEvent.change(screen.getByLabelText("Nome da organização"), {
      target: { value: "Atlas" },
    });
    fireEvent.change(screen.getByLabelText("E-mail do responsável"), {
      target: { value: "dono@atlas.com" },
    });

    const cosmos = screen.getByRole("radiogroup", { name: /Cosmos/ });
    const charter = screen.getByRole("radiogroup", { name: /Charter/ });
    fireEvent.click(
      Array.from(cosmos.querySelectorAll("input")).find(
        (i) => i.value === "TRIAL"
      ) as HTMLInputElement
    );
    fireEvent.click(
      Array.from(charter.querySelectorAll("input")).find(
        (i) => i.value === "ACTIVE"
      ) as HTMLInputElement
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Provisionar cliente" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await vi.waitFor(() =>
      expect(mocks.provisionTenantAction).toHaveBeenCalledWith({
        modules: [
          { module: "COSMOS", status: "TRIAL" },
          { module: "CHARTER", status: "ACTIVE" },
        ],
        name: "Atlas",
        ownerEmail: "dono@atlas.com",
      })
    );
  });
});

describe("a barreira de rejeitar mostra o pedido, não o id", () => {
  it("passa o alvo da lista para a decisão", async () => {
    mocks.listPlatformApprovals.mockResolvedValue({ data: [PEDIDO], ok: true });
    const { default: Page } = await import("@/app/(staff)/aprovacoes/page");
    render(await Page());

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));

    expect(
      screen.getAllByText(/P-0042 · Diagnóstico Atlas/).length
    ).toBeGreaterThan(1);
    expect(screen.queryByText(/pedido apr-1/)).toBeNull();
  });
});
