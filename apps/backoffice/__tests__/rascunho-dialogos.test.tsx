/** @vitest-environment jsdom */
// rascunho-dialogos.test.tsx — crítica rodada 2 (25/40): o `lib/rascunho-sujo`
// existia e protegia só Estúdio e Biblioteca. Cinco diálogos Radix
// descartavam o que foi digitado no Esc ou no clique fora, e três telas de
// formulário deixavam fechar a aba com rascunho sem aviso.
//
// Por diálogo: campo preenchido + Escape → continua aberto e mostra a
// pergunta; Descartar fecha; Voltar mantém o que foi digitado. Sem rascunho,
// Escape fecha direto. Nas telas: `beforeunload` com rascunho é
// `preventDefault`; "Fechar edição" com rascunho pergunta antes.
// Remover o guard de qualquer um derruba a linha dele.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewClientForm } from "@/app/(staff)/clientes/novo/form";
import { LancamentoDialog } from "@/app/(staff)/empresa/financeiro/lancamento-dialog";
import { NovaAssinaturaDialog } from "@/app/(staff)/empresa/financeiro/recorrente-dialog-nova";
import { NovoTituloDialog } from "@/app/(staff)/empresa/financeiro/titulo-dialog-novo";
import { EstagioDialog } from "@/app/(staff)/funil/estagio-dialog";
import type { DadosFunil } from "@/app/(staff)/funil/funil";
import { NovoLeadDialog } from "@/app/(staff)/funil/novo-lead-dialog";
import { Gerador } from "@/app/(staff)/propostas/[id]/gerador";
import { EditarServico } from "@/app/(staff)/servicos/[codigo]/editar";
import type { CatalogoComercial } from "@/app/actions/catalogo-comercial";
import type { ContaView } from "@/app/actions/empresa/financeiro";
import type { PropostaParaEdicao } from "@/app/actions/proposta-escopo";
import type { ServiceDetail } from "@/app/actions/services";

const mocks = vi.hoisted(() => ({
  lerEstagio: vi.fn(),
  listClients: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/servicos/SV-09",
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: vi.fn(),
  lerEstagio: mocks.lerEstagio,
}));
vi.mock("@/app/actions/clients", () => ({ listClients: mocks.listClients }));
vi.mock("@/app/actions/provisioning", () => ({
  provisionTenantAction: vi.fn(),
}));
vi.mock("@/app/actions/services", () => ({ updateServiceAction: vi.fn() }));
vi.mock("@/app/actions/proposals", () => ({ submitProposalAction: vi.fn() }));
vi.mock("@/app/actions/proposta-escopo", () => ({
  salvarEscopoAction: vi.fn(),
}));

const PERGUNTA = /Descartar o que foi digitado\?/;

function apertarEsc() {
  fireEvent.keyDown(document, { key: "Escape" });
}

/** O trio de provas de cada diálogo, parametrizado por como abrir e como
 *  sujar. `abrir` devolve o `onClose` mockado para conferir chamadas. */
function provasDoDialogo({
  nome,
  abrir,
  sujar,
}: {
  nome: string;
  abrir: () => ReturnType<typeof vi.fn>;
  sujar: () => Promise<void> | void;
}) {
  describe(nome, () => {
    it("sem rascunho, Escape fecha direto", async () => {
      const onClose = abrir();
      await screen.findByRole("dialog");

      apertarEsc();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("com rascunho, Escape não fecha: mostra a pergunta dentro do diálogo", async () => {
      const onClose = abrir();
      await screen.findByRole("dialog");
      await sujar();

      apertarEsc();

      expect(onClose).not.toHaveBeenCalled();
      const dialogo = screen.getByRole("dialog");
      expect(within(dialogo).getByText(PERGUNTA)).toBeTruthy();
      // Voltar vem antes de Descartar: o dedo que veio do Esc acha a saída.
      const botoes = within(dialogo)
        .getAllByRole("button")
        .map((b) => b.textContent);
      expect(botoes.indexOf("Voltar")).toBeLessThan(
        botoes.indexOf("Descartar")
      );
    });

    it("Descartar fecha; Voltar mantém o diálogo e some com a pergunta", async () => {
      const onClose = abrir();
      await screen.findByRole("dialog");
      await sujar();

      apertarEsc();
      fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByText(PERGUNTA)).toBeNull();
      expect(screen.getByRole("dialog")).toBeTruthy();

      apertarEsc();
      fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
}

const CANAIS = [
  { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
];

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <NovoLeadDialog
        aberto
        canais={CANAIS}
        onClose={onClose}
        onCriar={vi.fn()}
      />
    );
    return onClose;
  },
  nome: "Novo lead",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Organização"), {
      target: { value: "Meridian" },
    });
  },
});

const DADOS_ESTAGIO: DadosFunil = {
  canais: [],
  estagios: [
    { codigo: "LEAD", criterios: [], pesoPercent: 10, tetoDias: 7 },
    { codigo: "DISCOVERY", criterios: [], pesoPercent: 30, tetoDias: 14 },
    { codigo: "EVALUATION", criterios: [], pesoPercent: 60, tetoDias: 21 },
    { codigo: "PROPOSAL", criterios: [], pesoPercent: 80, tetoDias: 30 },
  ],
  historico: [],
  hoje: "2026-09-06T12:00:00.000Z",
  leads: [],
};

provasDoDialogo({
  abrir: () => {
    mocks.lerEstagio.mockResolvedValue({ data: { mudancas: [] }, ok: true });
    const onClose = vi.fn();
    render(
      <EstagioDialog
        codigo="DISCOVERY"
        dados={DADOS_ESTAGIO}
        onAbrirLead={vi.fn()}
        onClose={onClose}
        onFiltrar={vi.fn()}
        onRecarregar={vi.fn(() => Promise.resolve())}
        podeEscrever
      />
    );
    return onClose;
  },
  nome: "Estágio (edição)",
  sujar: async () => {
    fireEvent.click(
      await screen.findByRole("button", { name: "Editar estágio" })
    );
    fireEvent.change(screen.getByLabelText("Peso (%)"), {
      target: { value: "35" },
    });
  },
});

const CONTAS: ContaView[] = [
  {
    ativa: true,
    centroDeCusto: "produto-engenharia",
    conta: "5.1",
    grupo: 5,
    nome: "Infra e nuvem",
    ordem: 0,
  },
];

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <NovoTituloDialog
        aberto
        contas={CONTAS}
        onClose={onClose}
        onCriar={vi.fn()}
      />
    );
    return onClose;
  },
  nome: "Novo título",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Hospedagem" },
    });
  },
});

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <LancamentoDialog
        aberto
        contas={CONTAS}
        linha={null}
        onAtualizar={vi.fn()}
        onClose={onClose}
        onCriar={vi.fn()}
      />
    );
    return onClose;
  },
  nome: "Lançamento",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Servidor" },
    });
  },
});

provasDoDialogo({
  abrir: () => {
    mocks.listClients.mockResolvedValue({ data: [], ok: true });
    const onClose = vi.fn();
    render(<NovaAssinaturaDialog aberto onClose={onClose} onCriar={vi.fn()} />);
    return onClose;
  },
  nome: "Nova assinatura",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Degrau"), {
      target: { value: "team" },
    });
  },
});

// ── Telas: aviso ao sair e Fechar edição ──

function dispararBeforeUnload(): boolean {
  const evento = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(evento);
  return evento.defaultPrevented;
}

const SERVICO: ServiceDetail = {
  ativo: true,
  codigo: "SV-09",
  descricao: "Mapa do que existe.",
  duracao: "3 semanas",
  entregaveis: ["Relatório"],
  exigeLab: false,
  id: "svc-1",
  modalidade: "PROJETO",
  moduloVinculado: "COSMOS",
  nome: "Diagnóstico de dados",
  papeis: ["Consultor"],
  precoBaseCentavos: 1_250_000,
  preRequisitos: [],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
  uso: { engajamentos: [], propostas: [] },
};

describe("Editar serviço — rascunho", () => {
  // Fechar é tirar `?editar` da URL, raso — não navega no servidor.
  const replaceState = vi.spyOn(window.history, "replaceState");
  beforeEach(() => vi.clearAllMocks());

  it("limpo: beforeunload passa e Fechar edição fecha direto, sem navegar", () => {
    render(
      <EditarServico modulos={["COSMOS"]} podeEscrever servico={SERVICO} />
    );

    expect(dispararBeforeUnload()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Fechar edição" }));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/servicos/SV-09");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sujo: beforeunload é preventDefault e Fechar edição pergunta antes", () => {
    render(
      <EditarServico modulos={["COSMOS"]} podeEscrever servico={SERVICO} />
    );
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Diagnóstico de dados v2" },
    });

    expect(dispararBeforeUnload()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Fechar edição" }));
    expect(replaceState).not.toHaveBeenCalled();
    expect(screen.getByText(/Descartar alterações em «SV-09»\?/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(replaceState).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>("Nome").value).toBe(
      "Diagnóstico de dados v2"
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar edição" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/servicos/SV-09");
  });
});

describe("Provisionar cliente — aviso ao sair", () => {
  it("beforeunload só é preventDefault depois de digitar", () => {
    render(<NewClientForm canWrite modulos={["COSMOS"]} />);

    expect(dispararBeforeUnload()).toBe(false);

    fireEvent.change(screen.getByLabelText("Nome da organização"), {
      target: { value: "Atlas" },
    });

    expect(dispararBeforeUnload()).toBe(true);
  });
});

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

describe("Gerador de proposta — aviso ao sair", () => {
  it("beforeunload só é preventDefault depois de editar", () => {
    render(
      <Gerador
        catalogo={CATALOGO}
        podeEscrever
        proposta={PROPOSTA}
        servicos={[]}
      />
    );

    expect(dispararBeforeUnload()).toBe(false);

    fireEvent.change(screen.getByLabelText("Assentos"), {
      target: { value: "50" },
    });

    expect(dispararBeforeUnload()).toBe(true);
  });
});
