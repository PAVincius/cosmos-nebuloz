/** @vitest-environment jsdom */
// gerador-envio.test.tsx — [P0] "Enviar proposta" enviava a versão salva, não
// a da tela. `enviar` chamava `submitProposalAction({ id })` sem olhar se
// título, assentos, módulos etc. tinham mudado desde o último `salvar`; o
// preview mostrava o editado e o cliente recebia o antigo.
//
// O que se prova: com edição pendente o botão vira "Salvar e enviar" e o
// clique salva ANTES de enviar; sem edição, só envia; se salvar falha, não
// envia. E enviar é sem volta, então passa pela barreira com alvo escrito.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Gerador } from "@/app/(staff)/propostas/[id]/gerador";
import type { CatalogoComercial } from "@/app/actions/catalogo-comercial";
import type { PropostaParaEdicao } from "@/app/actions/proposta-escopo";

const { submitMock, salvarMock, pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  salvarMock: vi.fn(),
  submitMock: vi.fn(),
}));

vi.mock("@/app/actions/proposals", () => ({
  submitProposalAction: submitMock,
}));

vi.mock("@/app/actions/proposta-escopo", () => ({
  salvarEscopoAction: salvarMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const CATALOGO: CatalogoComercial = {
  addOns: [],
  modulos: [{ modulo: "COSMOS", precoMensalCentavos: 50_000 }],
  planos: [
    {
      limiteUsuarios: null,
      minimoAssentos: 5,
      nome: "Team",
      permiteRolesCustom: true,
      precoAssentoCentavos: 9900,
      slug: "team",
    },
  ],
  termos: [{ descontoPercent: 0, meses: 12, nome: "12 meses", slug: "12m" }],
};

const PROPOSTA: PropostaParaEdicao = {
  addOnSlugs: [],
  assentos: 40,
  clienteNome: "Atlas Energia",
  contatoEmail: "diretoria@atlas.com.br",
  descontoPercent: 0,
  id: "prop-1",
  modulos: ["COSMOS"],
  numero: "P-0001",
  planoSlug: "team",
  servicoIds: [],
  status: "RASCUNHO",
  termoSlug: "12m",
  titulo: "Atlas — plataforma",
};

function montar(proposta: PropostaParaEdicao = PROPOSTA) {
  return render(
    <Gerador
      catalogo={CATALOGO}
      podeEscrever
      proposta={proposta}
      servicos={[]}
    />
  );
}

function ok(data: unknown) {
  return Promise.resolve({ data, ok: true });
}

describe("Gerador — enviar a versão da tela", () => {
  beforeEach(() => {
    submitMock.mockReset();
    salvarMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
    submitMock.mockImplementation(() =>
      ok({ id: "prop-1", status: "ENVIADA" })
    );
    salvarMock.mockImplementation(() => ok({ id: "prop-1", numero: "P-0001" }));
  });

  it("editar assentos depois de salvo vira 'Salvar e enviar', e salva antes de enviar", async () => {
    montar();

    fireEvent.change(screen.getByLabelText("Assentos"), {
      target: { value: "60" },
    });

    expect(
      screen.queryByRole("button", { name: "Enviar proposta" })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Salvar e enviar" }));

    // A barreira: alvo escrito (título + cliente), nada disparado ainda.
    expect(screen.getByText(/Atlas — plataforma/)).toBeTruthy();
    expect(screen.getByText(/O cliente recebe esta versão/)).toBeTruthy();
    expect(salvarMock).not.toHaveBeenCalled();
    expect(submitMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(salvarMock).toHaveBeenCalledTimes(1);
    expect(salvarMock).toHaveBeenCalledWith(
      expect.objectContaining({ assentos: 60, id: "prop-1" })
    );
    expect(submitMock).toHaveBeenCalledWith({ id: "prop-1" });
    // Salvar veio antes de enviar — é o ponto do bug.
    expect(salvarMock.mock.invocationCallOrder[0]).toBeLessThan(
      submitMock.mock.invocationCallOrder[0] as number
    );
    expect(pushMock).toHaveBeenCalledWith("/propostas?enviada=prop-1");
  });

  it("sem edição, 'Enviar proposta' chama só submitProposalAction", async () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(salvarMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/propostas?enviada=prop-1");
  });

  it("se salvar falha, não envia e mostra o erro", async () => {
    salvarMock.mockImplementation(() =>
      Promise.resolve({ error: "Escopo inválido.", ok: false })
    );
    montar();

    fireEvent.change(screen.getByLabelText("Assentos"), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e enviar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(salvarMock).toHaveBeenCalledTimes(1));
    expect(submitMock).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Escopo inválido."
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("Voltar na barreira não salva nem envia", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(salvarMock).not.toHaveBeenCalled();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("desconto acima do limite: 'Enviar para aprovação' e a consequência fala da fila", () => {
    montar({ ...PROPOSTA, descontoPercent: 30 });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar para aprovação" })
    );

    expect(screen.getByText(/fila de aprovação/)).toBeTruthy();
  });

  it("zero assentos é legítimo: o slider aceita 0", () => {
    montar();

    const slider = screen.getByLabelText("Assentos") as HTMLInputElement;
    expect(slider.min).toBe("0");
    fireEvent.change(slider, { target: { value: "0" } });
    expect(slider.value).toBe("0");
  });
});
