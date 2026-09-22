/** @vitest-environment jsdom */
// paginacao-em-links.test.tsx — as páginas do servidor viram `?pagina=` em
// link, não `<button>`: meio-clique abre em nova aba, a seta de voltar
// desfaz, e o link se cola num ticket. Saúde e renovação e Benchmark leem a
// página da URL; a próxima só aparece quando a action diz que há mais.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContaComSaude } from "@/app/actions/accounts";
import type { Benchmark } from "@/app/actions/benchmark";
import { PaginacaoEmLinks } from "@/components/paginacao-em-links";
import { TETO_DA_LISTA } from "@/lib/paginacao";

const mocks = vi.hoisted(() => ({
  listAccountHealth: vi.fn(),
  listBenchmark: vi.fn(),
}));

vi.mock("@/app/actions/accounts", () => ({
  listAccountHealth: mocks.listAccountHealth,
}));
vi.mock("@/app/actions/benchmark", () => ({
  listBenchmark: mocks.listBenchmark,
}));

const CONTA: ContaComSaude = {
  diasParaRenovar: null,
  modulos: [],
  nome: "Atlas",
  plano: "ORBIT",
  renovaEm: null,
  saude: "OK",
  sinais: [],
  slug: "atlas",
  ultimaAtividade: null,
};

const BENCH: Benchmark = {
  clientes: [
    {
      descontoMedio: 0,
      engajamentos: 1,
      nome: "Atlas",
      receitaCentavos: 100,
      slug: "atlas",
      ticketCentavos: 100,
    },
  ],
  servicos: [],
  temMaisClientes: true,
};

const PROXIMA = new RegExp(`Próxima · ${TETO_DA_LISTA}`);

beforeEach(() => {
  mocks.listAccountHealth.mockReset();
  mocks.listBenchmark.mockReset();
});

describe("PaginacaoEmLinks", () => {
  it("na primeira página sem mais nada, não renderiza nada", () => {
    const { container } = render(
      <PaginacaoEmLinks caminho="/contas" pagina={1} temMais={false} />
    );
    expect(container.textContent).toBe("");
  });

  it("próxima e anterior são links com ?pagina=, preservando os outros params", () => {
    render(
      <PaginacaoEmLinks
        caminho="/contas"
        pagina={2}
        params={{ q: "atlas" }}
        temMais
      />
    );
    expect(
      screen.getByRole("link", { name: PROXIMA }).getAttribute("href")
    ).toBe("/contas?q=atlas&pagina=3");
    expect(
      screen.getByRole("link", { name: /Anterior/ }).getAttribute("href")
    ).toBe("/contas?q=atlas&pagina=1");
    expect(screen.getByText(/página 2/)).toBeTruthy();
  });

  it("na última página, só o link de anteriores", () => {
    render(<PaginacaoEmLinks caminho="/contas" pagina={3} temMais={false} />);
    expect(screen.queryByRole("link", { name: PROXIMA })).toBeNull();
    expect(screen.getByRole("link", { name: /Anterior/ })).toBeTruthy();
  });
});

describe("Saúde e renovação — ?pagina=", () => {
  it("lê a página da URL e oferece a próxima em link", async () => {
    mocks.listAccountHealth.mockResolvedValue({
      data: { itens: [CONTA], temMais: true },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/contas/page");
    render(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));

    expect(mocks.listAccountHealth).toHaveBeenCalledWith(undefined, {
      pagina: 2,
    });
    expect(
      screen.getByRole("link", { name: PROXIMA }).getAttribute("href")
    ).toBe("/contas?pagina=3");
  });

  it("sem searchParams é a primeira página, e sem mais nada não há link", async () => {
    mocks.listAccountHealth.mockResolvedValue({
      data: { itens: [CONTA], temMais: false },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/contas/page");
    render(await Page());

    expect(mocks.listAccountHealth).toHaveBeenCalledWith(undefined, {
      pagina: 1,
    });
    expect(screen.queryByRole("link", { name: PROXIMA })).toBeNull();
  });
});

describe("Benchmark — ?pagina=", () => {
  it("lê a página da URL, oferece a próxima e diz que a comparação é parcial", async () => {
    mocks.listBenchmark.mockResolvedValue({ data: BENCH, ok: true });
    const { default: Page } = await import("@/app/(staff)/benchmark/page");
    render(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));

    expect(mocks.listBenchmark).toHaveBeenCalledWith({ pagina: 2 });
    expect(
      screen.getByRole("link", { name: PROXIMA }).getAttribute("href")
    ).toBe("/benchmark?pagina=3");
    // As duas tabelas dizem que descrevem os clientes desta página.
    expect(screen.getAllByText(/desta página/)).toHaveLength(2);
  });
});
