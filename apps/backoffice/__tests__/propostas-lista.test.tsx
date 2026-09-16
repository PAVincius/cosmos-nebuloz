/** @vitest-environment jsdom */
// propostas-lista.test.tsx — a lista de propostas depois do envio.
//
// O gerador chegava aqui com `router.push("/propostas")` mudo: a pessoa
// trocava de tela sem nenhuma frase dizendo que o envio aconteceu. Agora o
// gerador passa `?enviada=<id>` e a lista confirma pelo título.
import { render, screen } from "@testing-library/react";
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
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useSearchParams: () => paramsMock(),
}));

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

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Atlas — plataforma");
    expect(status.textContent).toContain("enviada");
  });

  it("sem o parâmetro, nada de confirmação", () => {
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("id que não está na lista não inventa confirmação", () => {
    paramsMock.mockImplementation(
      () => new URLSearchParams("enviada=nao-existe")
    );
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
