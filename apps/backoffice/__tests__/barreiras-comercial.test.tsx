/** @vitest-environment jsdom */
// barreiras-comercial.test.tsx — [P1] ações sem volta que eram um clique:
// tirar serviço do catálogo e cancelar engajamento. O que se prova, por
// item: clicar no gatilho NÃO chama a action; o alvo aparece escrito;
// "Confirmar" chama com o payload certo; "Voltar" não chama.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import { Catalogo } from "@/app/(staff)/servicos/catalogo";
import type { EngagementRow } from "@/app/actions/engagements";
import type { ServiceRow } from "@/app/actions/services";

const { setAtivoMock, criarServicoMock, setStatusMock, criarEngMock } =
  vi.hoisted(() => ({
    criarEngMock: vi.fn(),
    criarServicoMock: vi.fn(),
    setAtivoMock: vi.fn(),
    setStatusMock: vi.fn(),
  }));

vi.mock("@/app/actions/services", () => ({
  createServiceAction: criarServicoMock,
  setServiceAtivoAction: setAtivoMock,
}));

vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: criarEngMock,
  setEngagementStatusAction: setStatusMock,
}));

const SERVICO: ServiceRow = {
  ativo: true,
  codigo: "SV-09",
  descricao: null,
  duracao: null,
  entregaveis: [],
  exigeLab: false,
  id: "svc-1",
  modalidade: "PROJETO",
  moduloVinculado: null,
  nome: "Diagnóstico de dados",
  papeis: [],
  precoBaseCentavos: 100_000,
  preRequisitos: [],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
};

describe("Catálogo — tirar do catálogo", () => {
  beforeEach(() => {
    setAtivoMock.mockReset();
    setAtivoMock.mockResolvedValue({ data: { id: "svc-1" }, ok: true });
  });

  it("o clique no gatilho não chama a action e mostra o alvo", () => {
    render(<Catalogo iniciais={[SERVICO]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Tirar do catálogo" }));

    expect(setAtivoMock).not.toHaveBeenCalled();
    expect(screen.getByText(/SV-09 · Diagnóstico de dados/)).toBeTruthy();
  });

  it("Confirmar chama setServiceAtivoAction com ativo=false", async () => {
    render(<Catalogo iniciais={[SERVICO]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Tirar do catálogo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(setAtivoMock).toHaveBeenCalledTimes(1));
    expect(setAtivoMock).toHaveBeenCalledWith({ ativo: false, id: "svc-1" });
  });

  it("Voltar não chama", () => {
    render(<Catalogo iniciais={[SERVICO]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Tirar do catálogo" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(setAtivoMock).not.toHaveBeenCalled();
  });

  it("Devolver ao catálogo tem volta, e continua um clique", async () => {
    render(<Catalogo iniciais={[{ ...SERVICO, ativo: false }]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Devolver" }));

    await waitFor(() => expect(setAtivoMock).toHaveBeenCalledTimes(1));
    expect(setAtivoMock).toHaveBeenCalledWith({ ativo: true, id: "svc-1" });
  });
});

const ENGAJAMENTO: EngagementRow = {
  clienteNome: "Atlas Energia",
  clienteSlug: "atlas-energia",
  codigo: "ENG-07",
  fimEm: null,
  id: "eng-1",
  inicioEm: null,
  nome: "Adoção assistida",
  proximos: ["ATIVO", "CANCELADO"],
  status: "PROPOSTO",
  valorCentavos: 500_000,
};

function montarEngajamentos() {
  return render(
    <Engajamentos
      clientes={[]}
      iniciais={[ENGAJAMENTO]}
      podeEscrever
      servicos={[]}
    />
  );
}

describe("Engajamentos — Cancelar", () => {
  beforeEach(() => {
    setStatusMock.mockReset();
    // `ok: false` de propósito: o sucesso faz `window.location.reload()`,
    // que o jsdom não implementa — e o que se prova aqui é a chamada.
    setStatusMock.mockResolvedValue({ error: "recusado", ok: false });
  });

  it("o clique em Cancelar não chama a action e mostra o alvo", () => {
    montarEngajamentos();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(setStatusMock).not.toHaveBeenCalled();
    expect(screen.getByText(/ENG-07 · Adoção assistida/)).toBeTruthy();
  });

  it("Confirmar chama setEngagementStatusAction com CANCELADO", async () => {
    montarEngajamentos();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(setStatusMock).toHaveBeenCalledTimes(1));
    expect(setStatusMock).toHaveBeenCalledWith({
      id: "eng-1",
      status: "CANCELADO",
    });
  });

  it("Voltar não chama", () => {
    montarEngajamentos();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(setStatusMock).not.toHaveBeenCalled();
  });

  it("as outras transições continuam um clique", async () => {
    montarEngajamentos();

    fireEvent.click(screen.getByRole("button", { name: "→ Ativo" }));

    await waitFor(() => expect(setStatusMock).toHaveBeenCalledTimes(1));
    expect(setStatusMock).toHaveBeenCalledWith({
      id: "eng-1",
      status: "ATIVO",
    });
  });
});
