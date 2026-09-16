/** @vitest-environment jsdom */
// dialogos-descricao.test.tsx — todo diálogo Radix do painel tem descrição.
//
// O leitor de tela anuncia nome + descrição ao abrir um `role="dialog"`. Os
// nove arquivos de diálogo passavam só o `DialogTitle`; o Radix avisa no
// console e a persona Sam abria "Novo título" sem saber o que o formulário
// faz. Uma linha por diálogo: quando já há subtítulo natural ele vira a
// descrição visível; senão, `sr-only` com o que o diálogo faz.
//
// Segunda prova, de tabela também: o título usa o token de tamanho do painel
// (`--fs-forte`) por cima do `text-lg` do kit — o kit é compartilhado e não se
// edita daqui.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LancamentoDialog } from "@/app/(staff)/empresa/financeiro/lancamento-dialog";
import { NovaAssinaturaDialog } from "@/app/(staff)/empresa/financeiro/recorrente-dialog-nova";
import {
  AlterarValorDialog,
  CreditoDialog,
  EncerrarDialog,
} from "@/app/(staff)/empresa/financeiro/recorrente-dialogs";
import { NovoTituloDialog } from "@/app/(staff)/empresa/financeiro/titulo-dialog-novo";
import {
  BaixarDialog,
  CancelarDialog,
} from "@/app/(staff)/empresa/financeiro/titulo-dialogs";
import { ProcessoDialog } from "@/app/(staff)/ferramentas/processos/processo-dialog";
import { EstagioDialog } from "@/app/(staff)/funil/estagio-dialog";
import type { DadosFunil } from "@/app/(staff)/funil/funil";
import { LeadDialog } from "@/app/(staff)/funil/lead-dialog";
import { NovoLeadDialog } from "@/app/(staff)/funil/novo-lead-dialog";
import type { LeadRow } from "@/app/actions/leads";
import type { TituloRow } from "@/lib/empresa/livro";
import type { AssinaturaRow } from "@/lib/empresa/recorrente";
import type { Result } from "@/lib/safe-action";

vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: vi.fn(),
  lerEstagio: vi.fn(() =>
    Promise.resolve({ data: { config: null, mudancas: [] }, ok: true })
  ),
}));

vi.mock("@/app/actions/clients", () => ({
  listClients: vi.fn(() => Promise.resolve({ data: [], ok: true })),
}));

function ok(data: unknown = {}): Promise<Result<never>> {
  return Promise.resolve({ data, ok: true } as Result<never>);
}

const LEAD: LeadRow = {
  acvEstimadoCentavos: 500_000,
  canal: { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
  contatoEmail: "ana@meridian.com",
  contatoNome: "Ana",
  criadoEm: "2026-09-01T00:00:00.000Z",
  donoNome: "Vini",
  entrada: "MERIDIAN",
  estagio: "LEAD",
  estagioDesde: "2026-09-01T00:00:00.000Z",
  id: "lead-1",
  motivoPerda: null,
  nome: "Meridian Corp",
  notaPerda: null,
  origem: null,
  perdidoEm: null,
  perdidoNoEstagio: null,
  proposta: null,
  proximaAcao: "Ligar",
  proximaAcaoEm: "2026-09-10T00:00:00.000Z",
  situacao: "ATIVO",
};

const DADOS: DadosFunil = {
  canais: [],
  estagios: [
    { codigo: "LEAD", criterios: [], pesoPercent: 10, tetoDias: 7 },
    { codigo: "DISCOVERY", criterios: [], pesoPercent: 30, tetoDias: 14 },
  ],
  historico: [],
  hoje: "2026-09-06T12:00:00.000Z",
  leads: [LEAD],
};

const ASSINATURA: AssinaturaRow = {
  clienteNome: "Cliente A",
  clienteSlug: "c-a1",
  creditosMesIncluidos: 1000,
  encerradaEm: null,
  id: "a1",
  iniciouEm: "2026-01-10",
  motivoEncerramento: null,
  planoSlug: "scale-plus",
  precoCreditoExtraCentavos: 10,
  propostaId: null,
  tetoExcedenteCentavos: 5000,
  valorMensalCentavos: 150_000,
};

const TITULO: TituloRow = {
  baixadoEm: null,
  clienteSlug: null,
  competenciaBaixa: null,
  conta: "5.1",
  contraparte: "Contraparte",
  descricao: "Hospedagem",
  emissao: "2026-09-01",
  id: "t1",
  motivoCancelamento: null,
  status: "ABERTO",
  tipo: "PAGAR",
  valorCentavos: 10_000,
  vencimento: "2026-09-20",
};

const noop = () => {};

const DIALOGOS: [string, () => React.ReactElement][] = [
  [
    "EstagioDialog",
    () => (
      <EstagioDialog
        codigo="DISCOVERY"
        dados={DADOS}
        onAbrirLead={noop}
        onClose={noop}
        onFiltrar={noop}
        onRecarregar={() => Promise.resolve()}
        podeEscrever
      />
    ),
  ],
  [
    "LeadDialog",
    () => (
      <LeadDialog
        estagios={DADOS.estagios}
        hoje={new Date(DADOS.hoje)}
        lead={LEAD}
        onClose={noop}
        onConverter={() => ok()}
        onMover={() => ok()}
        onPerder={() => ok()}
        onProximaAcao={() => ok()}
        podeEscrever
      />
    ),
  ],
  [
    "NovoLeadDialog",
    () => (
      <NovoLeadDialog
        aberto
        canais={[]}
        onClose={noop}
        onCriar={() => ok({ id: "x" })}
      />
    ),
  ],
  [
    "NovoTituloDialog",
    () => (
      <NovoTituloDialog
        aberto
        contas={[]}
        onClose={noop}
        onCriar={() => ok({ id: "x" })}
      />
    ),
  ],
  [
    "LancamentoDialog",
    () => (
      <LancamentoDialog
        aberto
        contas={[]}
        linha={null}
        onAtualizar={() => ok({ id: "x" })}
        onClose={noop}
        onCriar={() => ok({ id: "x" })}
      />
    ),
  ],
  [
    "AlterarValorDialog",
    () => (
      <AlterarValorDialog
        assinatura={ASSINATURA}
        competencia="2026-05"
        onAlterar={() => ok({ id: "x" })}
        onClose={noop}
      />
    ),
  ],
  [
    "EncerrarDialog",
    () => (
      <EncerrarDialog
        assinatura={ASSINATURA}
        onClose={noop}
        onEncerrar={() => ok({ id: "x" })}
      />
    ),
  ],
  [
    "CreditoDialog",
    () => (
      <CreditoDialog
        assinatura={ASSINATURA}
        competencia="2026-05"
        onClose={noop}
        onSalvar={() => ok({ clienteSlug: "c", competencia: "2026-05" })}
      />
    ),
  ],
  [
    "BaixarDialog",
    () => (
      <BaixarDialog
        onBaixar={() => ok({ id: "x" })}
        onClose={noop}
        titulo={TITULO}
      />
    ),
  ],
  [
    "CancelarDialog",
    () => (
      <CancelarDialog
        onCancelar={() => ok({ id: "x" })}
        onClose={noop}
        titulo={TITULO}
      />
    ),
  ],
  [
    "NovaAssinaturaDialog",
    () => (
      <NovaAssinaturaDialog
        aberto
        onClose={noop}
        onCriar={() => ok({ id: "x" })}
      />
    ),
  ],
  [
    "ProcessoDialog",
    () => (
      <ProcessoDialog
        aberto
        diagramas={[]}
        onFechar={noop}
        onSalvar={() => ok()}
        processo={null}
      />
    ),
  ],
];

describe.each(DIALOGOS)("%s", (_nome, montar) => {
  it("aberto, o diálogo tem descrição acessível não vazia", () => {
    render(montar());

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("dialog", { description: /\S/ })).toBeTruthy();
  });

  it("o título usa o token de tamanho do painel por cima do text-lg do kit", () => {
    render(montar());

    const titulo = screen
      .getByRole("dialog")
      .querySelector<HTMLElement>('[data-slot="dialog-title"]');
    expect(titulo?.style.fontSize).toBe("var(--fs-forte)");
  });
});
