/** @vitest-environment jsdom */
// barreira-e-frases-onda7.test.tsx — crítica rodada 4 (30/40).
//
// 1. Ativar módulo (ACTIVE/TRIAL) era um clique direto; decisão do dono: passa
//    pela mesma barreira que suspender, com a consequência escrita de verdade.
// 2. Promover a ADMIN dizia o que ADMIN pode só em parte — lê-se de
//    `apps/app/app/actions/settings/*`: convida, remove, troca papel, mexe em
//    integrações, SSO e política de segurança.
// 3. Seis escritas terminavam em silêncio: criar pessoa, criar serviço, novo
//    lead, base legal/parecer, responder critério e concluir avaliação. Cada
//    uma ganha a frase nomeada em `<Confirmacao>` (role=status).
// 4. Criar serviço/pessoa fazia `setLista` otimista sem releitura: a lista
//    passa a ser relida pela action depois de criar.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacidade } from "@/app/(staff)/capacidade/capacidade";
import { AbaUsuarios } from "@/app/(staff)/clientes/[slug]/abas/usuarios";
import { ModuleForm } from "@/app/(staff)/clientes/[slug]/module-form";
import { Painel } from "@/app/(staff)/empresa/consentimento/painel";
import { NovoLeadDialog } from "@/app/(staff)/funil/novo-lead-dialog";
import { Avaliacao } from "@/app/(staff)/growth/readiness/[id]/avaliacao";
import { Catalogo } from "@/app/(staff)/servicos/catalogo";
import type { PessoaCapacidade } from "@/app/actions/capacity";
import type { ConsentimentoView } from "@/app/actions/empresa/consentimento";
import type { AvaliacaoDetalhe } from "@/app/actions/maturidade";
import type { ServiceRow } from "@/app/actions/services";

const mocks = vi.hoisted(() => ({
  concluirAvaliacao: vi.fn(),
  contractModuleAction: vi.fn(),
  createPersonAction: vi.fn(),
  createServiceAction: vi.fn(),
  lerConsentimento: vi.fn(),
  listCapacity: vi.fn(),
  listServices: vi.fn(),
  marcarParecer: vi.fn(),
  responder: vi.fn(),
  salvarDecisao: vi.fn(),
  updateTenantMemberRoleAction: vi.fn(),
}));

vi.mock("@/app/actions/provisioning", () => ({
  contractModuleAction: mocks.contractModuleAction,
}));
vi.mock("@/app/actions/tenant-members", () => ({
  updateTenantMemberRoleAction: mocks.updateTenantMemberRoleAction,
}));
vi.mock("@/app/actions/services", () => ({
  createServiceAction: mocks.createServiceAction,
  listServices: mocks.listServices,
  setServiceAtivoAction: vi.fn(),
}));
vi.mock("@/app/actions/capacity", () => ({
  allocatePersonAction: vi.fn(),
  createPersonAction: mocks.createPersonAction,
  listCapacity: mocks.listCapacity,
}));
vi.mock("@/app/actions/empresa/consentimento", () => ({
  lerConsentimento: mocks.lerConsentimento,
  marcarParecer: mocks.marcarParecer,
  responderPergunta: vi.fn(),
  salvarDecisao: mocks.salvarDecisao,
}));
vi.mock("@/app/actions/maturidade", () => ({
  concluirAvaliacao: mocks.concluirAvaliacao,
  responder: mocks.responder,
}));
vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

beforeEach(() => {
  vi.clearAllMocks();
});

/** O `<output>` que contém o texto — `getByRole("status")` sozinho pega a
 *  região de "Copiado" do consentimento. */
async function statusComTexto(texto: RegExp | string): Promise<HTMLElement> {
  const el = await screen.findByText(texto);
  const output = el.closest("output");
  if (!output) {
    throw new Error(`"${String(texto)}" precisa viver num role=status`);
  }
  return output;
}

describe("ModuleForm — ativar também passa pela barreira", () => {
  function montar() {
    render(
      <ModuleForm
        canWrite
        modules={[{ expiresAt: null, module: "COSMOS", status: "SUSPENDED" }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );
  }

  it("Ativo abre a pergunta com alvo e consequência, sem chamar a action", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Ativo" }));

    const grupo = screen.getByRole("group", { name: "Ativo" });
    expect(grupo.textContent).toContain("COSMOS · acme");
    // O que acontece de verdade: acesso imediato, sem cobrança automática.
    expect(grupo.textContent).toMatch(/acesso/);
    expect(grupo.textContent).toMatch(/cobran/);
    expect(mocks.contractModuleAction).not.toHaveBeenCalled();
  });

  it("Trial diz que não expira sozinho; Confirmar chama e a linha nomeia", async () => {
    mocks.contractModuleAction.mockResolvedValue({ data: null, ok: true });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Trial" }));

    const grupo = screen.getByRole("group", { name: "Trial" });
    expect(grupo.textContent).toMatch(/não expira/);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.contractModuleAction).toHaveBeenCalledWith({
        module: "COSMOS",
        slug: "acme",
        status: "TRIAL",
      })
    );
    const status = await statusComTexto("COSMOS de acme agora está Trial");
    expect(status).toBeTruthy();
  });

  it("o status vigente fica desabilitado — não pergunta o que já é", () => {
    render(
      <ModuleForm
        canWrite
        modules={[{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );
    expect(
      screen.getByRole("button", { name: "Ativo" }).hasAttribute("disabled")
    ).toBe(true);
  });
});

describe("AbaUsuarios — promover a ADMIN diz o que ADMIN pode", () => {
  it("a consequência lista as permissões, não um genérico", () => {
    render(
      <AbaUsuarios
        canWrite
        membros={[
          {
            desde: "2026-09-01T00:00:00.000Z",
            email: "ana@atlas.com.br",
            id: "m-1",
            nome: "Ana",
            role: "DEV",
          },
        ]}
        slug="atlas-energia"
      />
    );
    fireEvent.change(screen.getByLabelText("Papel de ana@atlas.com.br"), {
      target: { value: "ADMIN" },
    });

    const grupo = screen.getByRole("group", {
      name: /Trocar papel de Ana para ADMIN/,
    });
    for (const poder of ["convida", "remove", "papéis", "integrações", "SSO"]) {
      expect(grupo.textContent).toContain(poder);
    }
  });
});

const SERVICO: ServiceRow = {
  ativo: true,
  codigo: "SV-01",
  descricao: null,
  duracao: null,
  entregaveis: [],
  exigeLab: false,
  id: "s1",
  modalidade: "PROJETO",
  moduloVinculado: null,
  nome: "Kickoff",
  papeis: [],
  precoBaseCentavos: 100_000,
  preRequisitos: [],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
};

describe("Catálogo — criar serviço nomeia e relê", () => {
  it("após Cadastrar: frase com o código e o nome; lista vem da releitura", async () => {
    mocks.createServiceAction.mockResolvedValue({
      data: { codigo: "SV-09", id: "s9" },
      ok: true,
    });
    const criado: ServiceRow = {
      ...SERVICO,
      codigo: "SV-09",
      id: "s9",
      nome: "Workshop",
    };
    mocks.listServices.mockResolvedValue({ data: [criado, SERVICO], ok: true });
    render(<Catalogo iniciais={[SERVICO]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Novo serviço" }));
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "SV-09" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Workshop" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Novo serviço" }));

    await statusComTexto("Serviço SV-09 · Workshop cadastrado.");
    expect(mocks.listServices).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Workshop")).toBeTruthy();
  });
});

const PESSOA: PessoaCapacidade = {
  alocacoes: [],
  ativo: true,
  email: "ana@nebuloz.com",
  entraEm: null,
  habilidades: [],
  horasSemana: 40,
  id: "p1",
  nome: "Ana",
  observacao: null,
  ocupacaoAtual: 0,
  saiEm: null,
};

describe("Capacidade — criar pessoa nomeia e relê", () => {
  it("após Cadastrar: 'Pessoa Bia cadastrada.' na linha dela; lista relida", async () => {
    mocks.createPersonAction.mockResolvedValue({
      data: { id: "p2" },
      ok: true,
    });
    const bia: PessoaCapacidade = {
      ...PESSOA,
      email: "bia@nebuloz.com",
      id: "p2",
      nome: "Bia",
    };
    mocks.listCapacity.mockResolvedValue({ data: [PESSOA, bia], ok: true });
    render(<Capacidade engajamentos={[]} iniciais={[PESSOA]} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Nova pessoa" }));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Bia" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "bia@nebuloz.com" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Nova pessoa" }));

    const status = await statusComTexto("Pessoa Bia cadastrada.");
    expect(mocks.listCapacity).toHaveBeenCalledTimes(1);
    // Na linha da Bia, não no topo.
    expect(status.closest("li")?.textContent).toContain("Bia");
  });
});

describe("NovoLeadDialog — a frase sai pelo onCriado antes de fechar", () => {
  it("onCriado recebe 'Lead Acme criado em Lead.' e só então fecha", async () => {
    const onCriar = vi.fn(() =>
      Promise.resolve({ data: { id: "novo" }, ok: true as const })
    );
    const onClose = vi.fn();
    const onCriado = vi.fn();
    render(
      <NovoLeadDialog
        aberto
        canais={[
          { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
        ]}
        onClose={onClose}
        onCriado={onCriado}
        onCriar={onCriar}
      />
    );

    fireEvent.change(screen.getByLabelText("Organização"), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByLabelText("Próximo passo"), {
      target: { value: "Ligar" },
    });
    fireEvent.change(screen.getByLabelText("Quando"), {
      target: { value: "2026-09-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar lead" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onCriado).toHaveBeenCalledWith("Lead Acme criado em Lead.");
    expect(onCriado.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0]
    );
  });
});

const VIEW: ConsentimentoView = {
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

describe("Consentimento — base legal e parecer nomeiam", () => {
  it("registrar base legal diz qual ficou", async () => {
    mocks.salvarDecisao.mockResolvedValue({ data: {}, ok: true });
    mocks.lerConsentimento.mockResolvedValue({
      data: {
        ...VIEW,
        decisao: { ...VIEW.decisao, baseLegal: "CONSENTIMENTO" },
      },
      ok: true,
    });
    render(<Painel inicial={VIEW} podeEscrever />);

    fireEvent.click(
      screen.getByRole("button", { name: /Consentimento — art/ })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await statusComTexto(/Base legal registrada: Consentimento/);
  });

  it("avançar o parecer diz para onde foi", async () => {
    mocks.marcarParecer.mockResolvedValue({ data: {}, ok: true });
    mocks.lerConsentimento.mockResolvedValue({
      data: { ...VIEW, decisao: { ...VIEW.decisao, parecer: "ENVIADO" } },
      ok: true,
    });
    render(<Painel inicial={VIEW} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: /Enviar ao jurídico/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await statusComTexto(/Parecer marcado como “Enviado ao jurídico”/);
  });
});

function avaliacao(over: Partial<AvaliacaoDetalhe> = {}): AvaliacaoDetalhe {
  return {
    autorNome: "Vini",
    concluidaEm: null,
    criadoEm: "2026-09-01T00:00:00.000Z",
    id: "av-1",
    leadId: null,
    leadNome: null,
    nivelGeral: null,
    organizacao: "Acme",
    respondidos: 0,
    respostas: [],
    rubricaVersao: "v1",
    scoreGeral: null,
    status: "RASCUNHO",
    ...over,
  };
}

const PATROCINIO = "Existe patrocínio executivo com orçamento próprio para IA?";

describe("Readiness — autosave e conclusão nomeados", () => {
  it("responder um critério mostra 'Salvo' na dimensão dele", async () => {
    mocks.responder.mockResolvedValue({ data: {}, ok: true });
    render(<Avaliacao inicial={avaliacao()} podeEscrever />);

    expect(screen.queryByText("Salvo")).toBeNull();
    const bloco = screen.getByText(PATROCINIO).closest("div")
      ?.parentElement as HTMLElement;
    fireEvent.click(bloco.querySelectorAll('input[type="radio"]')[2]);

    await waitFor(() => expect(mocks.responder).toHaveBeenCalledTimes(1));
    const salvos = await screen.findAllByText("Salvo");
    expect(salvos.length).toBeGreaterThan(0);
  });

  it("concluir diz 'Avaliação concluída — score congelado em N'", async () => {
    mocks.concluirAvaliacao.mockResolvedValue({
      data: { id: "av-1", nivelGeral: "INICIAL", scoreGeral: 42 },
      ok: true,
    });
    // Todos os 18 critérios respondidos: é o que libera Concluir.
    const { RUBRICA_V1 } = await import("@/lib/growth/maturidade");
    render(
      <Avaliacao
        inicial={avaliacao({
          respostas: RUBRICA_V1.criterios.map((c) => ({
            criterioId: c.id,
            nivel: 2,
            nota: null,
          })),
        })}
        podeEscrever
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Concluir avaliação" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await statusComTexto("Avaliação concluída — score congelado em 42.");
  });
});
