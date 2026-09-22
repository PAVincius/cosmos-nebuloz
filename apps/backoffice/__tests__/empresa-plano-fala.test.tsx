/** @vitest-environment jsdom */
// empresa-plano-fala.test.tsx — onda 8a, bloco 1. O plano de contas grava
// no blur (renomear), no clique (desativar/reativar) e no formulário (nova
// conta) — e terminava em silêncio. Agora cada escrita fala, nomeando a
// conta pelo código e pelo nome, depois que a lista volta do servidor.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Plano } from "@/app/(staff)/empresa/financeiro/plano";
import type { ContaView } from "@/app/actions/empresa/financeiro";

const mocks = vi.hoisted(() => ({
  atualizarConta: vi.fn(),
  criarConta: vi.fn(),
}));

vi.mock("@/app/actions/empresa/financeiro", () => ({
  atualizarConta: mocks.atualizarConta,
  criarConta: mocks.criarConta,
}));

const CONTA: ContaView = {
  ativa: true,
  centroDeCusto: "comercial",
  conta: "4.1",
  grupo: 4,
  nome: "Publicidade paga",
  ordem: 0,
};

function status(): string | null {
  return screen.queryByRole("status")?.textContent ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Plano — toda escrita fala", () => {
  it("renomear: o status nomeia o código e o nome novo", async () => {
    mocks.atualizarConta.mockResolvedValue({
      data: [{ ...CONTA, nome: "Mídia paga" }],
      ok: true,
    });
    render(<Plano inicial={[CONTA]} podeEscrever />);
    const campo = screen.getByLabelText("Nome da conta 4.1");
    fireEvent.change(campo, { target: { value: "Mídia paga" } });
    fireEvent.blur(campo);

    await waitFor(() =>
      expect(status()).toBe("Conta 4.1 renomeada para «Mídia paga».")
    );
  });

  it("desativar e reativar: o status diz qual conta e o que mudou", async () => {
    mocks.atualizarConta.mockResolvedValueOnce({
      data: [{ ...CONTA, ativa: false }],
      ok: true,
    });
    render(<Plano inicial={[CONTA]} podeEscrever />);
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() =>
      expect(status()).toBe("Conta 4.1 «Publicidade paga» desativada.")
    );

    mocks.atualizarConta.mockResolvedValueOnce({ data: [CONTA], ok: true });
    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));
    await waitFor(() =>
      expect(status()).toBe("Conta 4.1 «Publicidade paga» reativada.")
    );
  });

  it("nova conta: o status nomeia a conta criada", async () => {
    const nova: ContaView = { ...CONTA, conta: "4.7", nome: "Eventos" };
    mocks.criarConta.mockResolvedValue({ data: [CONTA, nova], ok: true });
    render(<Plano inicial={[CONTA]} podeEscrever />);
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "4.7" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Eventos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));

    await waitFor(() => expect(status()).toBe("Conta 4.7 «Eventos» criada."));
  });

  it("escrita recusada mostra o erro e não fala sucesso", async () => {
    mocks.atualizarConta.mockResolvedValue({
      error: "Conta com lançamentos no período.",
      ok: false,
    });
    render(<Plano inicial={[CONTA]} podeEscrever />);
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await screen.findByText("Conta com lançamentos no período.");
    expect(status()).toBeNull();
  });
});
