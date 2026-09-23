/** @vitest-environment jsdom */
// propostas-lista.test.tsx — a lista de propostas depois do envio.
//
// O gerador chegava aqui com `router.push("/propostas")` mudo: a pessoa
// trocava de tela sem nenhuma frase dizendo que o envio aconteceu. Agora o
// gerador passa `?enviada=<id>` e a lista confirma pelo título.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Propostas } from "@/app/(staff)/propostas/propostas";
import type { ProposalRow } from "@/app/actions/proposals";

const { submitMock, pushMock, paramsMock } = vi.hoisted(() => ({
  paramsMock: vi.fn<() => URLSearchParams>(() => new URLSearchParams()),
  pushMock: vi.fn(),
  submitMock: vi.fn(),
}));

vi.mock("@/app/actions/proposals", () => ({
  submitProposalAction: submitMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/propostas",
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useSearchParams: () => paramsMock(),
}));

/** A confirmação do envio, que nasce na linha. O contador da busca também é
 *  `status`, e não é dele que o teste fala. */
function confirmacaoNaTela(): HTMLElement | undefined {
  return screen.queryAllByRole("status").find((s) => s.closest("li"));
}

function linha(over: Partial<ProposalRow>): ProposalRow {
  return {
    acvCentavos: 100_000,
    cliente: "Atlas Energia",
    criadoEm: "2026-09-01T00:00:00.000Z",
    descontoPercent: 0,
    id: "prop-1",
    numero: "P-0001",
    status: "RASCUNHO",
    titulo: "Atlas — plataforma",
    totalCentavos: 100_000,
    ...over,
  };
}

describe("Propostas — confirmação do envio", () => {
  beforeEach(() => {
    submitMock.mockReset();
    pushMock.mockReset();
    paramsMock.mockReset();
    paramsMock.mockImplementation(() => new URLSearchParams());
  });

  it("com ?enviada=<id>, confirma o envio pelo título, como status", () => {
    paramsMock.mockImplementation(() => new URLSearchParams("enviada=prop-1"));
    render(
      <Propostas iniciais={[linha({ status: "ENVIADA" })]} podeEscrever />
    );

    const status = confirmacaoNaTela();
    expect(status?.textContent).toContain("Atlas — plataforma");
    expect(status?.textContent).toContain("enviada");
  });

  it("sem o parâmetro, nada de confirmação", () => {
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    expect(confirmacaoNaTela()).toBeUndefined();
  });

  it("id que não está na lista não inventa confirmação", () => {
    paramsMock.mockImplementation(
      () => new URLSearchParams("enviada=nao-existe")
    );
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    expect(confirmacaoNaTela()).toBeUndefined();
  });
});

// Enviar pela linha era um botão fantasma dentro de `<li role="button">` que
// abre a proposta: um clique, sem alvo, sem consequência. A barreira é a
// mesma do gerador; o `<li role=button>` aninhado fica para a onda de a11y.
describe("Propostas — enviar pela linha", () => {
  beforeEach(() => {
    submitMock.mockReset();
    submitMock.mockResolvedValue({
      data: { id: "prop-1", status: "ENVIADA" },
      ok: true,
    });
    pushMock.mockReset();
    paramsMock.mockReset();
    paramsMock.mockImplementation(() => new URLSearchParams());
  });

  it("o clique em Enviar não envia, mostra o alvo e não abre a proposta", () => {
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(submitMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Atlas — plataforma · Atlas Energia/)).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("Confirmar chama submitProposalAction com o id, sem navegar", async () => {
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith({ id: "prop-1" });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("Voltar não envia nem navega", () => {
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(submitMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("acima do limite de desconto, o gatilho é 'Pedir aprovação' e a consequência fala da fila", () => {
    render(
      <Propostas iniciais={[linha({ descontoPercent: 30 })]} podeEscrever />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pedir aprovação" }));

    expect(screen.getByText(/fila de aprovação/)).toBeTruthy();
  });
});
