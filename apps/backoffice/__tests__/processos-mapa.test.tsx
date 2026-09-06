/** @vitest-environment jsdom */
// processos-mapa.test.tsx — Task 5, spec §4. Prova a raiz cliente (`mapa.tsx`)
// e o painel do nó (`painel.tsx`) juntos, do jeito que o operador realmente
// usa: busca filtra o grafo e mostra a contagem, filtro de domínio esconde
// nó, clique num nó abre o painel, clique numa ligação do painel troca a
// seleção, `podeEscrever=false` esconde os três botões de escrita (mas não o
// `.canvas`, que é leitura) e "Excluir" pede confirmação em duas etapas — o
// padrão de `components/confirmar-acao.tsx`.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DadosMapa } from "@/app/(staff)/ferramentas/processos/mapa";
import { Mapa } from "@/app/(staff)/ferramentas/processos/mapa";
import type { ProcessoRow } from "@/app/actions/processos";

const { listarProcessosMock, excluirProcessoMock, excluirLigacaoMock } =
  vi.hoisted(() => ({
    excluirLigacaoMock: vi.fn(),
    excluirProcessoMock: vi.fn(),
    listarProcessosMock: vi.fn(),
  }));

vi.mock("@/app/actions/processos", () => ({
  excluirLigacao: excluirLigacaoMock,
  excluirProcesso: excluirProcessoMock,
  listarProcessos: listarProcessosMock,
}));

function processoFactory(over: Partial<ProcessoRow>): ProcessoRow {
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

const PROCESSO_A = processoFactory({
  codigo: "PZ-01",
  descricao: "Capta e qualifica leads comerciais.",
  diagram: { id: "d1", name: "Funil BPMN", slug: "funil-bpmn" },
  diagramId: "d1",
  dominio: "COMERCIAL",
  donoNome: "Ana",
  id: "a",
  nivel: 2,
  nome: "Funil de leads",
});
const PROCESSO_B = processoFactory({
  codigo: "PZ-02",
  descricao: "Aprova a passagem de fase do engajamento.",
  dominio: "DELIVERY",
  id: "b",
  nivel: 3,
  nome: "Gate de fase",
});
const PROCESSO_C = processoFactory({
  codigo: "PZ-03",
  descricao: "Calcula o custo de aquisição por canal.",
  dominio: "MEDICAO",
  id: "c",
  nivel: 1,
  nome: "Medição de CAC",
  tipo: "APOIO",
});

const DADOS: DadosMapa = {
  diagramas: [],
  ligacoes: [{ deId: "a", id: "e1", paraId: "b", rotulo: "converte em" }],
  processos: [PROCESSO_A, PROCESSO_B, PROCESSO_C],
};

beforeEach(() => {
  listarProcessosMock.mockReset().mockResolvedValue({ data: DADOS, ok: true });
  excluirProcessoMock
    .mockReset()
    .mockResolvedValue({ data: { id: "a" }, ok: true });
  excluirLigacaoMock
    .mockReset()
    .mockResolvedValue({ data: { id: "e1" }, ok: true });
});

describe("Mapa", () => {
  it("busca por um termo que só bate em um processo deixa o grafo com um nó", () => {
    render(<Mapa inicial={DADOS} podeEscrever={true} />);

    fireEvent.change(screen.getByRole("textbox", { name: /buscar/i }), {
      target: { value: "funil" },
    });

    expect(screen.getByLabelText("PZ-01 Funil de leads")).toBeTruthy();
    expect(screen.queryByLabelText("PZ-02 Gate de fase")).toBeNull();
    expect(screen.queryByLabelText("PZ-03 Medição de CAC")).toBeNull();
    expect(screen.getByText("1 processo para “funil”")).toBeTruthy();
  });

  it("filtrar por domínio esconde os nós dos outros domínios", () => {
    render(<Mapa inicial={DADOS} podeEscrever={true} />);

    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));

    expect(screen.getByLabelText("PZ-01 Funil de leads")).toBeTruthy();
    expect(screen.queryByLabelText("PZ-02 Gate de fase")).toBeNull();
    expect(screen.queryByLabelText("PZ-03 Medição de CAC")).toBeNull();
  });

  it("selecionar um nó abre o painel com nome, código e contagem de ligações", () => {
    render(<Mapa inicial={DADOS} podeEscrever={true} />);

    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));

    expect(
      screen.getByRole("heading", { name: "Funil de leads" })
    ).toBeTruthy();
    expect(screen.getByText(/PZ-01/)).toBeTruthy();
    expect(screen.getByText(/Ligações · 1/)).toBeTruthy();
  });

  it("clicar numa ligação do painel seleciona o outro nó", () => {
    render(<Mapa inicial={DADOS} podeEscrever={true} />);

    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));
    fireEvent.click(screen.getByRole("button", { name: /^Gate de fase/ }));

    expect(screen.getByRole("heading", { name: "Gate de fase" })).toBeTruthy();
  });

  it("sem permissão de escrita esconde Novo processo, Editar e Excluir, mas mantém .canvas", () => {
    render(<Mapa inicial={DADOS} podeEscrever={false} />);

    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));

    expect(screen.queryByText("Novo processo")).toBeNull();
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.queryByText("Excluir")).toBeNull();
    expect(screen.getByRole("button", { name: /\.canvas/i })).toBeTruthy();
  });

  it("excluir pede confirmação: o primeiro clique não chama a action, o segundo chama", () => {
    render(<Mapa inicial={DADOS} podeEscrever={true} />);

    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(excluirProcessoMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(excluirProcessoMock).toHaveBeenCalledWith({ id: "a" });
  });
});
