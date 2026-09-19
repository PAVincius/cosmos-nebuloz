/** @vitest-environment jsdom */
// processos-mapa-url.test.tsx — processo selecionado e filtro de domínio do
// mapa vivem em `?processo=` e `?dominio=`. Abrir a URL com o param já mostra
// o painel/filtro; clicar escreve na URL preservando os demais params; id ou
// domínio inexistente cai no estado padrão sem erro.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DadosMapa } from "@/app/(staff)/ferramentas/processos/mapa";
import { Mapa } from "@/app/(staff)/ferramentas/processos/mapa";
import type { ProcessoRow } from "@/app/actions/processos";
import {
  replaceStateMock,
  zerarRoteador,
} from "../vitest-mocks/next-navigation";

const { listarProcessosMock } = vi.hoisted(() => ({
  listarProcessosMock: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.mock("@/app/actions/processos", () => ({
  atualizarProcesso: vi.fn(),
  criarLigacao: vi.fn(),
  criarProcesso: vi.fn(),
  excluirLigacao: vi.fn(),
  excluirProcesso: vi.fn(),
  listarProcessos: listarProcessosMock,
}));

function processo(over: Partial<ProcessoRow>): ProcessoRow {
  return {
    codigo: "PZ-01",
    descricao: "",
    diagram: null,
    diagramId: null,
    docUrl: null,
    dominio: "COMERCIAL",
    donoNome: null,
    id: "a",
    nivel: 2,
    nome: "Processo",
    revisadoEm: null,
    tags: [],
    tipo: "CORE",
    ...over,
  };
}

const DADOS: DadosMapa = {
  diagramas: [],
  ligacoes: [],
  processos: [
    processo({ codigo: "PZ-01", id: "a", nome: "Funil de leads" }),
    processo({
      codigo: "PZ-02",
      dominio: "DELIVERY",
      id: "b",
      nome: "Gate de fase",
    }),
  ],
};

const ROTA = "/ferramentas/processos";

function montar() {
  return render(<Mapa inicial={DADOS} podeEscrever={false} />);
}

beforeEach(() => {
  zerarRoteador(ROTA);
  listarProcessosMock.mockReset().mockResolvedValue({ data: DADOS, ok: true });
});

describe("Mapa — processo e domínio na URL", () => {
  it("?processo=a já abre o painel do processo a", () => {
    zerarRoteador(ROTA, "processo=a");
    montar();
    expect(
      screen.getByRole("heading", { name: "Funil de leads" })
    ).toBeTruthy();
  });

  it("?processo= com id inexistente não abre painel nenhum, sem erro", () => {
    zerarRoteador(ROTA, "processo=nao-existe");
    montar();
    expect(
      screen.queryByRole("heading", { name: "Funil de leads" })
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: "Gate de fase" })).toBeNull();
  });

  it("selecionar um nó escreve ?processo= preservando os outros params, e o painel abre", () => {
    zerarRoteador(ROTA, "dominio=COMERCIAL");
    montar();

    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));

    expect(replaceStateMock).toHaveBeenCalledWith(
      null,
      "",
      `${ROTA}?dominio=COMERCIAL&processo=a`
    );
    expect(
      screen.getByRole("heading", { name: "Funil de leads" })
    ).toBeTruthy();
  });

  it("?dominio=DELIVERY já entra filtrado, com o chip marcado", () => {
    zerarRoteador(ROTA, "dominio=DELIVERY");
    montar();

    expect(screen.queryByLabelText("PZ-01 Funil de leads")).toBeNull();
    expect(screen.getByLabelText("PZ-02 Gate de fase")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Delivery" })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("domínio desconhecido no param vale como Todos", () => {
    zerarRoteador(ROTA, "dominio=nao-existe");
    montar();

    expect(screen.getByLabelText("PZ-01 Funil de leads")).toBeTruthy();
    expect(screen.getByLabelText("PZ-02 Gate de fase")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Todos domínios" })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("clicar num chip de domínio escreve ?dominio= preservando o processo", () => {
    zerarRoteador(ROTA, "processo=a");
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Delivery" }));

    expect(replaceStateMock).toHaveBeenCalledWith(
      null,
      "",
      `${ROTA}?processo=a&dominio=DELIVERY`
    );
    expect(screen.queryByLabelText("PZ-01 Funil de leads")).toBeNull();
  });

  it("chip Todos domínios remove o param", () => {
    zerarRoteador(ROTA, "processo=a&dominio=DELIVERY");
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Todos domínios" }));

    expect(replaceStateMock).toHaveBeenCalledWith(
      null,
      "",
      `${ROTA}?processo=a`
    );
  });
});
