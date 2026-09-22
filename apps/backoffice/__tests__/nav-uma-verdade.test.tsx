/** @vitest-environment jsdom */
// nav-uma-verdade.test.tsx — heurística 4 (consistência): o menu é a única
// fonte do lugar de cada tela no painel.
//
// Três coisas se provam aqui. Nenhuma rota aparece duas vezes no menu (o
// /scaffold acendia "Fila de gates" em Delivery e "Scaffold" em Comercial ao
// mesmo tempo). O eyebrow das telas desta onda vem da seção do `nav.ts`, não
// de string solta — "Compliance" e "Governança" eram seções que não existem
// no menu. E o título da tela é o rótulo do menu.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BO_NAV, itemDaRota, secaoDaRota } from "@/components/nav";

const mocks = vi.hoisted(() => ({
  falha: vi.fn(),
  listClients: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("@/app/actions/clients", () => ({
  listClients: mocks.listClients,
}));
vi.mock("@/app/actions/empresa/consentimento", () => ({
  lerConsentimento: mocks.falha,
  marcarParecer: vi.fn(),
  responderPergunta: vi.fn(),
  salvarDecisao: vi.fn(),
}));
vi.mock("@/app/actions/empresa/cac", () => ({
  lerCac: mocks.falha,
  salvarAlocacao: vi.fn(),
  salvarConversao: vi.fn(),
  salvarParcelas: vi.fn(),
}));
vi.mock("@/app/actions/empresa/fornecedores", () => ({
  aplicarAcaoDpa: vi.fn(),
  exportarAoCharter: vi.fn(),
  listarFornecedoresDpa: mocks.falha,
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
// A carteira (`/`) guarda busca e filtro na URL (`lib/url-state.ts`), então
// o mock precisa dos três hooks que o `useParamState` lê.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// /empresa/financeiro: as abas são de outra onda e cada uma puxa as próprias
// actions — viram stub, e a página só precisa das leituras que ela mesma faz.
vi.mock("@/app/actions/empresa/financeiro", () => ({
  lerCaixa: mocks.falha,
  lerDre: mocks.falha,
  listarPlanoDeContas: mocks.falha,
}));
vi.mock("@/app/actions/empresa/livro", () => ({
  listarLancamentos: mocks.falha,
}));
vi.mock("@/app/actions/empresa/orcamento", () => ({ lerOrcado: mocks.falha }));
vi.mock("@/app/actions/empresa/recorrente", () => ({
  listarRecorrente: mocks.falha,
}));
vi.mock("@/app/actions/empresa/titulos", () => ({
  listarTitulos: mocks.falha,
}));
const stub = () => null;
vi.mock("@/app/(staff)/empresa/financeiro/caixa", () => ({ Caixa: stub }));
vi.mock("@/app/(staff)/empresa/financeiro/dre", () => ({ Dre: stub }));
vi.mock("@/app/(staff)/empresa/financeiro/lancamentos", () => ({
  Lancamentos: stub,
}));
vi.mock("@/app/(staff)/empresa/financeiro/orcado", () => ({ Orcado: stub }));
vi.mock("@/app/(staff)/empresa/financeiro/plano", () => ({ Plano: stub }));
vi.mock("@/app/(staff)/empresa/financeiro/recorrente", () => ({
  Recorrente: stub,
  SeletorCompetenciaRecorrente: stub,
}));
vi.mock("@/app/(staff)/empresa/financeiro/seletor", () => ({
  SeletorDaAba: stub,
}));
vi.mock("@/app/(staff)/empresa/financeiro/titulos", () => ({
  Titulos: stub,
}));

// Importar uma página puxa o painel dela inteiro — é o import, não o render,
// que pesa; com a suíte em paralelo isso passa dos 5s padrão.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePlatformStaff.mockResolvedValue({ canWrite: false });
  // O painel de cada tela é de outra onda; basta o cabeçalho renderizar.
  mocks.falha.mockResolvedValue({ ok: false, error: "indisponível" });
  mocks.listClients.mockResolvedValue({ ok: true, data: [] });
});

describe("menu", () => {
  it("nenhum href aparece duas vezes", () => {
    const hrefs = BO_NAV.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("/scaffold é a fila de gates de Delivery — a tela monta FilaDeGates", () => {
    expect(itemDaRota("/scaffold")?.label).toBe("Fila de gates");
    expect(secaoDaRota("/scaffold")).toBe("Delivery");
  });

  it("/ se chama Clientes, que é o que a carteira é", () => {
    expect(itemDaRota("/")?.label).toBe("Clientes");
  });

  it("secaoDaRota devolve a seção do menu; rota fora do menu cai no nome do painel", () => {
    expect(secaoDaRota("/")).toBe("Plataforma");
    expect(secaoDaRota("/empresa/financeiro")).toBe("Empresa");
    expect(secaoDaRota("/contas")).toBe("Comercial");
    expect(secaoDaRota("/nao-existe")).toBe("Nebuloz");
  });
});

describe("eyebrow = seção do menu", () => {
  const paginas: [string, () => Promise<{ default: unknown }>][] = [
    ["/", () => import("@/app/(staff)/page")],
    [
      "/empresa/consentimento",
      () => import("@/app/(staff)/empresa/consentimento/page"),
    ],
    ["/empresa/cac", () => import("@/app/(staff)/empresa/cac/page")],
    [
      "/empresa/fornecedores",
      () => import("@/app/(staff)/empresa/fornecedores/page"),
    ],
  ];

  it.each(paginas)("%s abre com a seção do nav.ts", async (rota, carregar) => {
    const { default: Page } = (await carregar()) as {
      default: (props: {
        searchParams: Promise<Record<string, string>>;
      }) => Promise<React.ReactElement>;
    };
    const { unmount } = render(
      await Page({ searchParams: Promise.resolve({}) })
    );

    const secao = secaoDaRota(rota);
    expect(screen.getByText(new RegExp(`^${secao} · `))).toBeTruthy();
    expect(screen.queryByText(/^(Compliance|Governança|Tenant) · /)).toBeNull();
    unmount();
  });
});

describe("título = rótulo do menu", () => {
  it("/empresa/financeiro se intitula como o item do menu", async () => {
    const { default: Page } = await import(
      "@/app/(staff)/empresa/financeiro/page"
    );
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: itemDaRota("/empresa/financeiro")?.label,
      })
    ).toBeTruthy();
    expect(screen.queryByText("DRE e caixa")).toBeNull();
  });
});
