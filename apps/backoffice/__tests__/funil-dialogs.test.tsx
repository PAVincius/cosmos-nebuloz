/** @vitest-environment jsdom */
// funil-dialogs.test.tsx — LeadDialog e NovoLeadDialog são as duas peças que
// faltavam da T5 do funil v2. O que se prova aqui: o rodapé certo aparece por
// estado (ativo → ação principal; perdido/ganho → só "Fechar"), o modo de
// perda só libera "Registrar perda" com motivo + nota ≥ 12, e "Criar lead" só
// libera com organização + próximo passo + data, convertendo o ACV em reais
// para centavos (× 100) na chamada.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeadDialog } from "@/app/(staff)/funil/lead-dialog";
import { NovoLeadDialog } from "@/app/(staff)/funil/novo-lead-dialog";
import type { CanalRow, LeadRow } from "@/app/actions/leads";
import type { ConfigEstagio } from "@/lib/comercial/funil";
import type { Result } from "@/lib/safe-action";

const HOJE = new Date("2026-09-06T12:00:00.000Z");

const ESTAGIOS: ConfigEstagio[] = [
  { codigo: "LEAD", criterios: [], pesoPercent: 10, tetoDias: 7 },
  { codigo: "DISCOVERY", criterios: [], pesoPercent: 30, tetoDias: 14 },
  { codigo: "EVALUATION", criterios: [], pesoPercent: 60, tetoDias: 21 },
  { codigo: "PROPOSAL", criterios: [], pesoPercent: 80, tetoDias: 30 },
];

function leadFactory(over: Partial<LeadRow>): LeadRow {
  return {
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
    ...over,
  };
}

function ok(data: unknown = {}): Promise<Result<unknown>> {
  return Promise.resolve({ data, ok: true });
}

function montarLeadDialog(lead: LeadRow | null, podeEscrever = true) {
  const onClose = vi.fn();
  const onMover = vi.fn(() => ok());
  const onConverter = vi.fn(() => ok());
  const onPerder = vi.fn(() => ok());
  const onProximaAcao = vi.fn(() => ok());

  render(
    <LeadDialog
      estagios={ESTAGIOS}
      hoje={HOJE}
      lead={lead}
      onClose={onClose}
      onConverter={onConverter}
      onMover={onMover}
      onPerder={onPerder}
      onProximaAcao={onProximaAcao}
      podeEscrever={podeEscrever}
    />
  );

  return { onClose, onConverter, onMover, onPerder, onProximaAcao };
}

describe("LeadDialog", () => {
  // Converter é sem volta: o servidor nunca mais deixa mover o lead. Passa
  // pela barreira — o primeiro clique só pergunta, com o lead escrito.
  it("lead ativo em Avaliação mostra Converter em proposta; converte só depois de confirmar", () => {
    const lead = leadFactory({ estagio: "EVALUATION", id: "lead-2" });
    const { onConverter } = montarLeadDialog(lead);

    fireEvent.click(
      screen.getByRole("button", { name: "Converter em proposta" })
    );

    expect(onConverter).not.toHaveBeenCalled();
    expect(screen.getByText(/sai do funil e vira rascunho/)).toBeTruthy();
    expect(screen.getAllByText(/Meridian Corp/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(onConverter).toHaveBeenCalledWith("lead-2");
  });

  it("Voltar na conversão não converte", () => {
    const lead = leadFactory({ estagio: "EVALUATION", id: "lead-2" });
    const { onConverter } = montarLeadDialog(lead);

    fireEvent.click(
      screen.getByRole("button", { name: "Converter em proposta" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onConverter).not.toHaveBeenCalled();
  });

  it("Marcar perdido abre chips e textarea; Registrar perda só libera com motivo e nota válida", () => {
    const lead = leadFactory({});
    const { onPerder } = montarLeadDialog(lead);

    fireEvent.click(screen.getByRole("button", { name: "Marcar perdido" }));

    const registrar = screen.getByRole("button", { name: "Registrar perda" });
    expect(registrar.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Preço" }));
    const textarea = screen.getByPlaceholderText(
      "O que aconteceu — mínimo 12 caracteres"
    );

    fireEvent.change(textarea, { target: { value: "curta" } });
    expect(registrar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(textarea, { target: { value: "motivo detalhado" } });
    expect(registrar.hasAttribute("disabled")).toBe(false);

    fireEvent.click(registrar);
    expect(onPerder).toHaveBeenCalledWith(
      "lead-1",
      "PRECO",
      "motivo detalhado"
    );
  });

  it("modoInicial 'perda' (Ruling 8: soltar em Perdido no board) já abre com o formulário de perda", () => {
    const lead = leadFactory({});

    render(
      <LeadDialog
        estagios={ESTAGIOS}
        hoje={HOJE}
        lead={lead}
        modoInicial="perda"
        onClose={vi.fn()}
        onConverter={vi.fn(() => ok())}
        onMover={vi.fn(() => ok())}
        onPerder={vi.fn(() => ok())}
        onProximaAcao={vi.fn(() => ok())}
        podeEscrever={true}
      />
    );

    expect(
      screen.getByPlaceholderText("O que aconteceu — mínimo 12 caracteres")
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Registrar perda" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Marcar perdido" })).toBeNull();
  });

  it("lead perdido só mostra Fechar no rodapé", () => {
    const lead = leadFactory({
      motivoPerda: "PRECO",
      notaPerda: "Perdeu para o concorrente interno.",
      perdidoEm: "2026-09-05T00:00:00.000Z",
      perdidoNoEstagio: "DISCOVERY",
      situacao: "PERDIDO",
    });
    montarLeadDialog(lead);

    expect(screen.getByRole("button", { name: "Fechar" })).toBeTruthy();
    expect(screen.queryByText("Marcar perdido")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Converter em proposta/ })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^Avançar para/ })).toBeNull();
  });
});

const CANAIS: CanalRow[] = [
  { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
];

describe("NovoLeadDialog", () => {
  it("Criar lead só libera com organização, próximo passo e data; converte ACV em centavos", () => {
    const onCriar = vi.fn(() =>
      Promise.resolve({ data: { id: "novo" }, ok: true as const })
    );
    const onClose = vi.fn();

    render(
      <NovoLeadDialog
        aberto
        canais={CANAIS}
        onClose={onClose}
        onCriar={onCriar}
      />
    );

    const criar = screen.getByRole("button", { name: "Criar lead" });
    expect(criar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Organização"), {
      target: { value: "Acme" },
    });
    expect(criar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Próximo passo"), {
      target: { value: "Ligar amanhã" },
    });
    expect(criar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Quando"), {
      target: { value: "2026-09-20" },
    });
    expect(criar.hasAttribute("disabled")).toBe(false);

    fireEvent.change(screen.getByLabelText("ACV estimado"), {
      target: { value: "500,00" },
    });

    fireEvent.click(criar);

    expect(onCriar).toHaveBeenCalledWith(
      expect.objectContaining({
        acvEstimadoCentavos: 50_000,
        canalSlug: "indicacao",
        entrada: "MERIDIAN",
        nome: "Acme",
        proximaAcao: "Ligar amanhã",
        proximaAcaoEm: "2026-09-20",
      })
    );
  });

  it("sem canais o botão fica desabilitado mesmo com org/passo/data preenchidos", () => {
    const onCriar = vi.fn(() =>
      Promise.resolve({ data: { id: "novo" }, ok: true as const })
    );

    render(
      <NovoLeadDialog aberto canais={[]} onClose={vi.fn()} onCriar={onCriar} />
    );

    expect(
      screen.getByText("Nenhum canal cadastrado — rode o seed de canais.")
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Organização"), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByLabelText("Próximo passo"), {
      target: { value: "Ligar amanhã" },
    });
    fireEvent.change(screen.getByLabelText("Quando"), {
      target: { value: "2026-09-20" },
    });

    expect(
      screen
        .getByRole("button", { name: "Criar lead" })
        .hasAttribute("disabled")
    ).toBe(true);
  });
});
