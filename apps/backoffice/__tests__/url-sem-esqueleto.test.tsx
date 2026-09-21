/** @vitest-environment jsdom */
// url-sem-esqueleto.test.tsx — [P1] trocar filtro ou abrir edição não deve
// passar pelo esqueleto da rota.
//
// Audit: o filtro muda o que o servidor lê, então a navegação continua — mas
// dentro de `startTransition`, com `isPending` no controle (`aria-busy`), e
// com um "Limpar filtros" que zera a URL. Serviço: `?editar=1` é estado de
// tela, não de servidor — vira raso (`history.replaceState`), e o botão do
// cabeçalho some enquanto edita (o do formulário é o que pergunta).
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Filtros } from "@/app/(staff)/audit/filtros";
import { BotaoEditar } from "@/app/(staff)/servicos/[codigo]/editar";

const { pushMock, transicao, url } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  transicao: { pendente: false, iniciar: vi.fn((fn: () => void) => fn()) },
  url: { pathname: "/audit", search: "" },
}));

// Importar a tela puxa a action, e a action puxa o env de servidor.
vi.mock("@/app/actions/audit", () => ({}));
vi.mock("@/app/actions/services", () => ({ updateServiceAction: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => url.pathname,
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(url.search),
}));

vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    useTransition: () => [transicao.pendente, transicao.iniciar] as const,
  };
});

const replaceState = vi.spyOn(window.history, "replaceState");

beforeEach(() => {
  pushMock.mockReset();
  transicao.iniciar.mockClear();
  transicao.pendente = false;
  replaceState.mockClear();
  url.pathname = "/audit";
  url.search = "";
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("Audit — filtros sem esqueleto", () => {
  it("trocar um filtro navega dentro de startTransition", () => {
    url.search = "acao=create&pagina=3";
    render(<Filtros tenants={[{ id: "t-1", name: "Atlas", slug: "atlas" }]} />);

    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "t-1" },
    });

    expect(transicao.iniciar).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/audit?acao=create&tenant=t-1");
  });

  it("'Limpar filtros' zera os params", () => {
    url.search = "acao=create&tenant=t-1&de=2026-09-01";
    render(<Filtros tenants={[{ id: "t-1", name: "Atlas", slug: "atlas" }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(pushMock).toHaveBeenCalledWith("/audit");
  });

  it("sem filtro ativo, 'Limpar filtros' fica desabilitado", () => {
    render(<Filtros tenants={[]} />);

    expect(
      screen
        .getByRole("button", { name: "Limpar filtros" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("enquanto a navegação está pendente, o bloco de filtros diz aria-busy", () => {
    transicao.pendente = true;
    render(<Filtros tenants={[]} />);

    expect(
      screen.getByLabelText("Cliente").closest('[aria-busy="true"]')
    ).toBeTruthy();
  });
});

describe("Serviço — Editar é raso", () => {
  beforeEach(() => {
    url.pathname = "/servicos/SV-09";
  });

  it("clicar em Editar põe ?editar=1 por history.replaceState, sem navegar", () => {
    render(<BotaoEditar canWrite />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/servicos/SV-09?editar=1"
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("editando, o botão do cabeçalho não aparece (o do formulário é o que pergunta)", () => {
    url.search = "editar=1";
    render(<BotaoEditar canWrite />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("sem permissão, é o botão desabilitado com motivo", () => {
    render(<BotaoEditar canWrite={false} />);

    // `WriteButton` bloqueado fica no Tab: `aria-disabled`, não `disabled`.
    expect(
      screen
        .getByRole("button", { name: "Editar" })
        .getAttribute("aria-disabled")
    ).toBe("true");
  });
});
