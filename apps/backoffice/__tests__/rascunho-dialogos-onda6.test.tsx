/** @vitest-environment jsdom */
// rascunho-dialogos-onda6.test.tsx — crítica rodada 3: cinco diálogos Radix
// ainda descartavam o que foi digitado no Esc e no clique fora sem perguntar
// (processo, lead — nota de perda —, baixar/cancelar título, alterar/
// encerrar/crédito de assinatura, motivo da travessia na fila de gates).
// Mesmo trio de provas de `rascunho-dialogos.test.tsx`: sem rascunho o Esc
// fecha; com rascunho segura e pergunta; Voltar mantém, Descartar fecha.
// Remover a guarda de qualquer um derruba a linha dele.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AlterarValorDialog,
  CreditoDialog,
  EncerrarDialog,
} from "@/app/(staff)/empresa/financeiro/recorrente-dialogs";
import {
  BaixarDialog,
  CancelarDialog,
} from "@/app/(staff)/empresa/financeiro/titulo-dialogs";
import { ProcessoDialog } from "@/app/(staff)/ferramentas/processos/processo-dialog";
import { LeadDialog } from "@/app/(staff)/funil/lead-dialog";
import { FilaDeGates } from "@/app/(staff)/scaffold/fila-de-gates";
import type { LeadRow } from "@/app/actions/leads";
import type { QueueEntry } from "@/app/actions/scaffold-supervision";
import type { TituloRow } from "@/lib/empresa/livro";
import type { AssinaturaRow } from "@/lib/empresa/recorrente";

const { enterTenantContextMock } = vi.hoisted(() => ({
  enterTenantContextMock: vi.fn(),
}));

vi.mock("@/app/actions/scaffold-supervision", () => ({
  enterTenantContext: enterTenantContextMock,
}));

const PERGUNTA = /Descartar o que foi digitado\?/;
const ok = () => Promise.resolve({ data: { id: "x" }, ok: true as const });

function apertarEsc() {
  fireEvent.keyDown(document, { key: "Escape" });
}

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

provasDoDialogo({
  abrir: () => {
    const onFechar = vi.fn();
    render(
      <ProcessoDialog
        aberto
        diagramas={[]}
        onFechar={onFechar}
        onSalvar={vi.fn(() => ok())}
        processo={null}
      />
    );
    return onFechar;
  },
  nome: "Processo",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Onboarding" },
    });
  },
});

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

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <LeadDialog
        estagios={[
          { codigo: "LEAD", criterios: [], pesoPercent: 10, tetoDias: 7 },
        ]}
        hoje={new Date("2026-09-06T12:00:00.000Z")}
        lead={LEAD}
        modoInicial="perda"
        onClose={onClose}
        onConverter={() => ok()}
        onMover={() => ok()}
        onPerder={() => ok()}
        onProximaAcao={() => ok()}
        podeEscrever
      />
    );
    return onClose;
  },
  nome: "Lead — nota de perda",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("O que aconteceu"), {
      target: { value: "Escolheram outro fornecedor." },
    });
  },
});

const TITULO: TituloRow = {
  baixadoEm: null,
  clienteSlug: null,
  competenciaBaixa: null,
  conta: "5.1",
  contraparte: "AWS",
  descricao: "Hospedagem AWS",
  emissao: "2026-09-01",
  id: "t1",
  motivoCancelamento: null,
  status: "ABERTO",
  tipo: "PAGAR",
  valorCentavos: 300_000,
  vencimento: "2026-09-20",
};

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <BaixarDialog onBaixar={() => ok()} onClose={onClose} titulo={TITULO} />
    );
    return onClose;
  },
  nome: "Baixar título",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-09-02" },
    });
  },
});

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <CancelarDialog
        onCancelar={() => ok()}
        onClose={onClose}
        titulo={TITULO}
      />
    );
    return onClose;
  },
  nome: "Cancelar título",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Motivo do cancelamento"), {
      target: { value: "Duplicidade de cobrança identificada." },
    });
  },
});

const ASSINATURA: AssinaturaRow = {
  clienteNome: "Cliente A",
  clienteSlug: "c-a1",
  creditosMesIncluidos: 1000,
  encerradaEm: null,
  id: "a1",
  iniciouEm: "2026-01-01",
  motivoEncerramento: null,
  planoSlug: "scale",
  precoCreditoExtraCentavos: 10,
  propostaId: null,
  tetoExcedenteCentavos: null,
  valorMensalCentavos: 150_000,
};

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <AlterarValorDialog
        assinatura={ASSINATURA}
        competencia="2026-09"
        onAlterar={() => ok()}
        onClose={onClose}
      />
    );
    return onClose;
  },
  nome: "Alterar valor da assinatura",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Novo valor mensal"), {
      target: { value: "1800,00" },
    });
  },
});

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <EncerrarDialog
        assinatura={ASSINATURA}
        onClose={onClose}
        onEncerrar={() => ok()}
      />
    );
    return onClose;
  },
  nome: "Encerrar assinatura",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Cliente cancelou o contrato." },
    });
  },
});

provasDoDialogo({
  abrir: () => {
    const onClose = vi.fn();
    render(
      <CreditoDialog
        assinatura={ASSINATURA}
        competencia="2026-09"
        onClose={onClose}
        onSalvar={() =>
          Promise.resolve({
            data: { clienteSlug: "c-a1", competencia: "2026-09" },
            ok: true as const,
          })
        }
      />
    );
    return onClose;
  },
  nome: "Crédito de IA",
  sujar: () => {
    fireEvent.change(screen.getByLabelText("Créditos consumidos no mês"), {
      target: { value: "1200" },
    });
  },
});

const ENTRADA: QueueEntry = {
  ageDays: 3,
  ageLabel: "3 d",
  criteriaMet: 2,
  criteriaTotal: 4,
  kind: "sign-off",
  orgName: "Acme Saúde",
  phase: "PILOT",
  phaseInstanceId: "pi-1",
  trackCode: "TRK-42",
  trackId: "trk-42",
};

describe("Fila de gates — motivo da travessia", () => {
  beforeEach(() => enterTenantContextMock.mockReset());

  function abrir() {
    render(<FilaDeGates iniciais={[ENTRADA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar no cliente" }));
    return screen.getByRole("dialog");
  }

  it("o título diz 'Entrar no cliente X', não 'tenant'", () => {
    abrir();
    expect(
      screen.getByRole("dialog", { name: /Entrar no cliente Acme Saúde/ })
    ).toBeTruthy();
    expect(screen.queryByText(/tenant de/)).toBeNull();
  });

  it("sem motivo digitado, Escape fecha direto", () => {
    abrir();
    apertarEsc();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("com motivo digitado, Escape pergunta; Descartar fecha e limpa", () => {
    abrir();
    fireEvent.change(screen.getByLabelText("Por que precisa entrar"), {
      target: { value: "Revisar critérios do gate com o cliente." },
    });

    apertarEsc();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(PERGUNTA)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // Reabrir nasce limpo — o motivo descartado não volta.
    fireEvent.click(screen.getByRole("button", { name: "Entrar no cliente" }));
    expect(
      (screen.getByLabelText("Por que precisa entrar") as HTMLTextAreaElement)
        .value
    ).toBe("");
  });

  it("enquanto entra, o botão diz 'Entrando…' e trava", async () => {
    let liberar: (v: unknown) => void = () => {};
    enterTenantContextMock.mockReturnValue(
      new Promise((resolve) => {
        liberar = resolve;
      })
    );
    abrir();
    fireEvent.change(screen.getByLabelText("Por que precisa entrar"), {
      target: { value: "Revisar critérios do gate com o cliente." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar e entrar" }));

    const botao = await screen.findByRole("button", { name: /Entrando…/ });
    expect(botao.hasAttribute("disabled")).toBe(true);
    liberar({ error: "x", ok: false });
    await screen.findByRole("button", { name: "Registrar e entrar" });
  });
});
