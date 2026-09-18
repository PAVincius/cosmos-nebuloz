/** @vitest-environment jsdom */
// guardas-fora-dos-dialogos.test.tsx — rascunho sujo fora dos diálogos.
//
// Os cinco diálogos Radix já perguntam antes de descartar (onda 6, rodada 3).
// Sobravam três telas de página inteira que ainda perdiam edição em silêncio:
//
// 1. **Gerador de proposta nova.** `sujo` exigia `salvo !== null`; uma
//    proposta que nunca foi salva nunca estava suja, e fechar a aba com o
//    formulário inteiro digitado não avisava.
// 2. **CAC.** Tinha `sujo` para o botão Salvar, mas trocar o período fazia
//    `router.push` e a página remontava com `key` — o rascunho ia junto. E a
//    aba fechava sem aviso.
// 3. **Consentimento.** Mesmo `sujo`, mesma aba fechando sem aviso.
//
// O que se prova: com edição pendente, `beforeunload` é cancelado em cada
// tela; no CAC, trocar o período com rascunho mostra a pergunta e não navega.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Painel as PainelDoCac } from "@/app/(staff)/empresa/cac/painel";
import { Painel as PainelDoConsentimento } from "@/app/(staff)/empresa/consentimento/painel";
import { Gerador } from "@/app/(staff)/propostas/[id]/gerador";
import type { CatalogoComercial } from "@/app/actions/catalogo-comercial";
import type { CacView } from "@/app/actions/empresa/cac";
import type { ConsentimentoView } from "@/app/actions/empresa/consentimento";
import { pushMock, zerarRoteador } from "../vitest-mocks/next-navigation";

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/proposals", () => ({ submitProposalAction: vi.fn() }));
vi.mock("@/app/actions/proposta-escopo", () => ({
  salvarEscopoAction: vi.fn(),
}));
vi.mock("@/app/actions/empresa/cac", () => ({
  salvarAlocacao: vi.fn(),
  salvarConversao: vi.fn(),
  salvarParcelas: vi.fn(),
}));
vi.mock("@/app/actions/empresa/consentimento", () => ({
  lerConsentimento: vi.fn(),
  marcarParecer: vi.fn(),
  responderPergunta: vi.fn(),
  salvarDecisao: vi.fn(),
}));
// O seletor de período puxa Radix + calendário; aqui só interessa que ele
// pede a troca. Um botão que chama `onAplicar` com um intervalo fixo basta.
vi.mock("@/components/seletor-de-periodo", () => ({
  SeletorDePeriodo: ({
    onAplicar,
  }: {
    onAplicar: (i: { de: string; ate: string }) => void;
  }) => (
    <button
      onClick={() => onAplicar({ ate: "2026-08-31", de: "2026-08-01" })}
      type="button"
    >
      Trocar período
    </button>
  ),
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

const CAC: CacView = {
  alocacoes: [],
  competenciaEditavel: "2026-09",
  competencias: ["2026-09"],
  conversao: {
    convDiscoveryEvaluationPercent: null,
    convEvaluationPropostaPercent: null,
    convLeadDiscoveryPercent: null,
    convPropostaAceitaPercent: null,
  },
  editavel: true,
  intervalo: { ate: "2026-09-30", de: "2026-09-01" },
  mensalidadeReferenciaCentavos: null,
  parcelas: {
    "4.1": 100_000,
    "4.2": 100_000,
    "4.3": null,
    "4.4": null,
    "4.5": null,
    "4.6": null,
    clientesGanhos: null,
    entregaDiagnosticoCentavos: null,
  },
  resultado: {
    cacCentavos: null,
    paybackMeses: null,
    porProduto: [],
    preenchidas: 2,
    total: 8,
  },
  sugestaoClientesGanhos: 3,
};

const CONSENTIMENTO: ConsentimentoView = {
  abertas: 0,
  avisos: [],
  camposEmAberto: [],
  decisao: {
    baseLegal: "SEM_DECISAO",
    contatoTitular: null,
    ferramenta: null,
    parecer: "PENDENTE",
    parecerEnviadoEm: null,
    parecerRecebidoEm: null,
    prazoRetencao: null,
    standingHabilitavel: null,
  },
  perguntas: [],
};

function dispararBeforeUnload(): Event {
  const evento = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(evento);
  return evento;
}

beforeEach(() => {
  zerarRoteador("/empresa/cac", "de=2026-09-01&ate=2026-09-30");
});

describe("Gerador — proposta nova", () => {
  it("limpo, fechar a aba não avisa; com o título digitado, avisa", async () => {
    render(
      <Gerador catalogo={CATALOGO} podeEscrever proposta={null} servicos={[]} />
    );

    expect(dispararBeforeUnload().defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText("Título da proposta"), {
      target: { value: "Atlas — plataforma" },
    });

    await waitFor(() =>
      expect(dispararBeforeUnload().defaultPrevented).toBe(true)
    );
  });
});

describe("CAC — rascunho e troca de período", () => {
  it("com parcela editada, fechar a aba avisa", async () => {
    render(<PainelDoCac inicial={CAC} podeEscrever />);

    expect(dispararBeforeUnload().defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText("Clientes ganhos no período"), {
      target: { value: "4" },
    });

    await waitFor(() =>
      expect(dispararBeforeUnload().defaultPrevented).toBe(true)
    );
  });

  it("trocar o período com rascunho pergunta antes e não navega", () => {
    render(<PainelDoCac inicial={CAC} podeEscrever />);
    fireEvent.change(screen.getByLabelText("Clientes ganhos no período"), {
      target: { value: "4" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Trocar período" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText("Descartar o que foi digitado?")).toBeTruthy();

    // "Voltar" mantém o rascunho e o período.
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Clientes ganhos no período")).toHaveProperty(
      "value",
      "4"
    );

    // "Descartar" navega para o período pedido.
    fireEvent.click(screen.getByRole("button", { name: "Trocar período" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(pushMock).toHaveBeenCalledWith(
      "/empresa/cac?de=2026-08-01&ate=2026-08-31"
    );
  });

  it("sem rascunho, trocar o período navega direto", () => {
    render(<PainelDoCac inicial={CAC} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Trocar período" }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Descartar o que foi digitado?")).toBeNull();
  });
});

describe("Consentimento — rascunho", () => {
  it("com a ferramenta digitada, fechar a aba avisa", async () => {
    render(<PainelDoConsentimento inicial={CONSENTIMENTO} podeEscrever />);

    expect(dispararBeforeUnload().defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText("[ferramenta]"), {
      target: { value: "Cookiebot" },
    });

    await waitFor(() =>
      expect(dispararBeforeUnload().defaultPrevented).toBe(true)
    );
  });
});
