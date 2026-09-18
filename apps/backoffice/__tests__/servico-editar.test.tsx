/** @vitest-environment jsdom */
// servico-editar.test.tsx — [P0] serviço não podia ser editado depois de
// criado. `updateServiceAction` existia completa e nenhum `.tsx` a chamava; o
// detalhe dizia "Sem entregáveis cadastrados" e não oferecia caminho.
//
// O que se prova: o formulário nasce com os valores atuais, submeter manda o
// payload transformado (textarea → array, reais → centavos, pré-requisito →
// código), erro do servidor aparece com `role=alert`, o botão trava enquanto
// pendente, e o atalho "Cadastrar entregáveis" abre o form com o foco no
// campo certo.
import type { ProductModule } from "@repo/database";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DetalheDoServico } from "@/app/(staff)/servicos/[codigo]/detalhe";
import { EditarServico } from "@/app/(staff)/servicos/[codigo]/editar";
import type { ServiceDetail } from "@/app/actions/services";

const { updateServiceActionMock, refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  updateServiceActionMock: vi.fn(),
}));

vi.mock("@/app/actions/services", () => ({
  updateServiceAction: updateServiceActionMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/servicos/SV-09",
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("editar=1"),
}));

const SERVICO: ServiceDetail = {
  ativo: true,
  codigo: "SV-09",
  descricao: "Mapa do que existe.",
  duracao: "3 semanas",
  entregaveis: ["Relatório", "Workshop"],
  exigeLab: false,
  id: "svc-1",
  modalidade: "PROJETO",
  moduloVinculado: "COSMOS",
  nome: "Diagnóstico de dados",
  papeis: ["Consultor"],
  precoBaseCentavos: 1_250_000,
  preRequisitos: [{ codigo: "SV-01", existe: true, nome: "Kickoff" }],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
  uso: { engajamentos: [], propostas: [] },
};

const MODULOS: ProductModule[] = ["COSMOS", "CHARTER", "SIGNAL"];

function montar(over: Partial<Parameters<typeof EditarServico>[0]> = {}) {
  return render(
    <EditarServico modulos={MODULOS} podeEscrever servico={SERVICO} {...over} />
  );
}

const PAYLOAD_ATUAL = {
  descricao: "Mapa do que existe.",
  duracao: "3 semanas",
  entregaveis: ["Relatório", "Workshop"],
  exigeLab: false,
  id: "svc-1",
  moduloVinculado: "COSMOS",
  nome: "Diagnóstico de dados",
  papeis: ["Consultor"],
  precoBaseCentavos: 1_250_000,
  preRequisitos: ["SV-01"],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
};

describe("EditarServico", () => {
  beforeEach(() => {
    updateServiceActionMock.mockReset();
    refreshMock.mockReset();
  });

  it("renderiza pré-preenchido com o serviço atual", () => {
    montar();

    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
      "Diagnóstico de dados"
    );
    expect(
      (screen.getByLabelText("Preço base") as HTMLInputElement).value
    ).toBe("12500,00");
    expect(
      (screen.getByLabelText("Entregáveis") as HTMLTextAreaElement).value
    ).toBe("Relatório\nWorkshop");
    expect(
      (screen.getByLabelText("Pré-requisitos") as HTMLTextAreaElement).value
    ).toBe("SV-01");
    expect((screen.getByLabelText("Trilha") as HTMLSelectElement).value).toBe(
      "readiness"
    );
    expect(
      (screen.getByLabelText("Módulo vinculado") as HTMLSelectElement).value
    ).toBe("COSMOS");
  });

  it("submeter chama updateServiceAction com o payload transformado", async () => {
    updateServiceActionMock.mockResolvedValue({
      data: { id: "svc-1" },
      ok: true,
    });
    montar();

    fireEvent.change(screen.getByLabelText("Entregáveis"), {
      target: { value: "Relatório\nWorkshop\n\nManual  \n" },
    });
    fireEvent.change(screen.getByLabelText("Preço base"), {
      target: { value: "1.500,00" },
    });
    fireEvent.submit(screen.getByRole("form"));

    await waitFor(() =>
      expect(updateServiceActionMock).toHaveBeenCalledTimes(1)
    );
    expect(updateServiceActionMock).toHaveBeenCalledWith({
      ...PAYLOAD_ATUAL,
      entregaveis: ["Relatório", "Workshop", "Manual"],
      precoBaseCentavos: 150_000,
    });
    // Sucesso = refresh + confirmação textual, não um redirect mudo.
    expect(await screen.findByText("Serviço atualizado")).toBeTruthy();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("erro do servidor aparece com role=alert e o formulário não some", async () => {
    updateServiceActionMock.mockResolvedValue({
      error: "Serviço não encontrado.",
      ok: false,
    });
    montar();

    fireEvent.submit(screen.getByRole("form"));

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("Serviço não encontrado.");
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
      "Diagnóstico de dados"
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("enquanto pendente o botão fica desabilitado e diz que está salvando", async () => {
    // Promessa que nunca resolve: é o "durante" que se quer observar.
    updateServiceActionMock.mockReturnValue(
      new Promise(() => {
        /* pendente de propósito */
      })
    );
    montar();

    fireEvent.submit(screen.getByRole("form"));

    const botao = await screen.findByRole("button", { name: /Salvando…/ });
    expect(botao.hasAttribute("disabled")).toBe(true);
  });

  it("sem permissão de escrita, o botão fica desabilitado com o motivo", () => {
    montar({ podeEscrever: false });

    const botao = screen.getByRole("button", { name: /Salvar/ });
    expect(botao.hasAttribute("disabled")).toBe(true);
    expect(botao.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("focarEm=entregaveis leva o foco ao campo de entregáveis", () => {
    montar({ focarEm: "entregaveis" });

    expect(document.activeElement).toBe(screen.getByLabelText("Entregáveis"));
  });
});

describe("DetalheDoServico", () => {
  it("sem entregáveis, oferece o atalho que abre a edição focada", () => {
    render(<DetalheDoServico servico={{ ...SERVICO, entregaveis: [] }} />);

    const link = screen.getByRole("link", { name: /Cadastrar entregáveis/ });
    expect(link.getAttribute("href")).toContain("editar=entregaveis");
  });

  it("status de proposta e engajamento aparecem como rótulo, não enum cru", () => {
    render(
      <DetalheDoServico
        servico={{
          ...SERVICO,
          uso: {
            engajamentos: [{ id: "e1", nome: "Eng", status: "ATIVO" }],
            propostas: [
              {
                cliente: "Atlas",
                id: "p1",
                numero: "P-001",
                precoUnitCentavos: 100,
                quantidade: 1,
                status: "ENVIADA",
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByText("Enviada")).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(screen.queryByText("ENVIADA")).toBeNull();
  });
});
