/** @vitest-environment jsdom */
// modals-gating.test.tsx — a confirmação de cada modal é desabilitada de
// verdade enquanto o formulário não está pronto.
//
// Antes, `GatedAction` era um <span> com `pointer-events:none` e o motivo no
// `title`: não impedia Tab+Enter, `fireEvent.click` disparava a action, e o
// motivo só aparecia no hover. Agora cada confirmação é um `GatedButton`
// (`disabled` real) e o motivo é texto visível no rodapé. Mutação que este
// arquivo pega: voltar ao span → "não dispara" e "disabled" falham.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VendorRow } from "@/app/(charter)/actions/vendors";
import { DecisionModal } from "../../components/charter/modals/decision";
import { ExportPackageModal } from "../../components/charter/modals/export-package";
import { MitigationModal } from "../../components/charter/modals/mitigation";
import { NewVendorModal } from "../../components/charter/modals/new-vendor";
import { PublishTrackModal } from "../../components/charter/modals/publish-track";
import { PublishVersionModal } from "../../components/charter/modals/publish-version";
import { VendorTierModal } from "../../components/charter/modals/vendor-tier";
import { IntakeModal } from "../../components/charter/modals-intake";

const noop = () => {
  // sem efeito no teste
};

/** O gate de verdade: `disabled` no DOM, e nem clique nem Enter chegam à
 *  action. Devolve o que o teste compara com `GATED`. */
function probe(button: HTMLElement, onSubmit: ReturnType<typeof vi.fn>) {
  fireEvent.click(button);
  fireEvent.keyDown(button, { key: "Enter" });
  return {
    disabled: button.hasAttribute("disabled"),
    calls: onSubmit.mock.calls.length,
  };
}
const GATED = { disabled: true, calls: 0 };

const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });

describe("DecisionModal", () => {
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <DecisionModal
        approvalPath={null}
        caseCode="UC-001"
        caseTitle="Triagem"
        dataClass="INTERNAL"
        deciderName="Você"
        deciderRole="Compliance"
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
        riskLabel="Moderado"
        riskTone="amber"
        score={6}
        vendorName={null}
      />
    );
    return onSubmit;
  };

  it("sem justificativa, a confirmação está desabilitada e o motivo é texto visível", () => {
    const onSubmit = renderIt();
    fireEvent.click(
      screen.getByRole("button", { name: /^Bloquear Incompatível/ })
    );
    expect(
      probe(screen.getByRole("button", { name: "Bloquear" }), onSubmit)
    ).toEqual(GATED);
    expect(screen.getByText(/Escreva a justificativa/)).toBeTruthy();
  });

  it("com justificativa, a confirmação habilita e dispara a decisão", () => {
    const onSubmit = renderIt();
    fireEvent.click(
      screen.getByRole("button", { name: /^Bloquear Incompatível/ })
    );
    type(
      screen.getByPlaceholderText(/Uso compatível com a seção 4/),
      "Incompatível com a seção 4 da política."
    );
    const btn = screen.getByRole("button", { name: "Bloquear" });
    expect(btn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "BLOCKED" })
    );
  });
});

describe("MitigationModal", () => {
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <MitigationModal
        cases={[{ code: "UC-001", title: "Triagem" }]}
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
      />
    );
    return onSubmit;
  };
  const fillAction = () =>
    type(
      screen.getByPlaceholderText(/Pseudonimizar/),
      "Pseudonimizar identificadores"
    );
  const fillDue = () => type(screen.getByLabelText(/Prazo/), "2026-10-01");
  const fillOwner = () =>
    type(screen.getByPlaceholderText("Quem responde pela ação"), "Marina");

  it("vazio, Registrar está desabilitado e o motivo é texto visível", () => {
    const onSubmit = renderIt();
    expect(
      probe(screen.getByRole("button", { name: "Registrar" }), onSubmit)
    ).toEqual(GATED);
    expect(screen.getByText(/Descreva a ação/)).toBeTruthy();
  });

  it("Dono é obrigatório: ação e prazo sem dono continuam travados", () => {
    const onSubmit = renderIt();
    fillAction();
    fillDue();
    expect(
      probe(screen.getByRole("button", { name: "Registrar" }), onSubmit)
    ).toEqual(GATED);
  });

  it("com ação, dono e prazo, Registrar dispara com o dono", () => {
    const onSubmit = renderIt();
    fillAction();
    fillDue();
    fillOwner();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ ownerName: "Marina", dueDate: "2026-10-01" })
    );
  });
});

describe("PublishVersionModal", () => {
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <PublishVersionModal
        blockers={[]}
        currentVersion="v1.0"
        nextVersion="v1.1"
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
        peopleCount={10}
        policyName="Política de IA"
        trackCount={2}
      />
    );
    return onSubmit;
  };

  it("sem resumo, Publicar está desabilitado e o motivo é texto visível", () => {
    const onSubmit = renderIt();
    expect(
      probe(screen.getByRole("button", { name: "Publicar v1.1" }), onSubmit)
    ).toEqual(GATED);
    expect(screen.getByText(/Escreva um resumo de mudança/)).toBeTruthy();
  });

  it("com resumo, Publicar dispara com o resumo", () => {
    const onSubmit = renderIt();
    type(
      screen.getByPlaceholderText(/Seção 4 passa a exigir/),
      "Seção 4 passa a exigir retenção zero."
    );
    fireEvent.click(screen.getByRole("button", { name: "Publicar v1.1" }));
    expect(onSubmit).toHaveBeenCalledWith(
      "Seção 4 passa a exigir retenção zero."
    );
  });
});

describe("VendorTierModal", () => {
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <VendorTierModal
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
        vendor={{ name: "OpenAI", tier: "REVIEW", cases: 2, maxClass: null }}
      />
    );
    return onSubmit;
  };
  const justify = () =>
    type(
      screen.getByPlaceholderText(/Retenção de 14 dias/),
      "Retenção zero confirmada em contrato."
    );

  it("sem justificativa, Aplicar está desabilitado", () => {
    const onSubmit = renderIt();
    fireEvent.click(
      screen.getByRole("button", { name: /^Restrito Uso permitido/ })
    );
    expect(
      probe(screen.getByRole("button", { name: "Aplicar" }), onSubmit)
    ).toEqual(GATED);
    expect(screen.getByText(/Escreva a justificativa/)).toBeTruthy();
  });

  it("com o mesmo tier atual, Aplicar fica travado com o motivo", () => {
    const onSubmit = renderIt();
    justify();
    expect(
      probe(screen.getByRole("button", { name: "Aplicar" }), onSubmit)
    ).toEqual(GATED);
    expect(screen.getByText(/Escolha um tier diferente do atual/)).toBeTruthy();
  });

  it("com tier diferente e justificativa, Aplicar dispara", () => {
    const onSubmit = renderIt();
    fireEvent.click(
      screen.getByRole("button", { name: /^Restrito Uso permitido/ })
    );
    justify();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "RESTRICTED" })
    );
  });
});

describe("NewVendorModal", () => {
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <NewVendorModal
        clauses={[{ code: "CL-01", name: "DPA", critical: true }]}
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
      />
    );
    return onSubmit;
  };

  it("sem nome, Adicionar está desabilitado e o motivo é texto visível", () => {
    const onSubmit = renderIt();
    expect(
      probe(screen.getByRole("button", { name: "Adicionar" }), onSubmit)
    ).toEqual(GATED);
    expect(screen.getByText(/Informe o nome/)).toBeTruthy();
  });

  it("com nome, Adicionar dispara", () => {
    const onSubmit = renderIt();
    type(screen.getByPlaceholderText(/Corpus Legal Review/), "Anthropic");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Anthropic" })
    );
  });
});

describe("PublishTrackModal", () => {
  const section = {
    id: "s1",
    ordinal: 1,
    name: "Escopo",
    status: "PUBLISHED",
    statusLabel: "Publicada",
    words: 120,
  };
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <PublishTrackModal
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
        policyVersion="v1.0"
        sections={[section]}
      />
    );
    return onSubmit;
  };

  it("sem nome nem seção, Publicar e atribuir está desabilitado", () => {
    const onSubmit = renderIt();
    expect(
      probe(
        screen.getByRole("button", { name: "Publicar e atribuir" }),
        onSubmit
      )
    ).toEqual(GATED);
    expect(
      screen.getByText(/Informe o nome e escolha ao menos uma seção/)
    ).toBeTruthy();
  });

  it("com nome e uma seção, Publicar e atribuir dispara", () => {
    const onSubmit = renderIt();
    type(screen.getByPlaceholderText(/Uso de IA generativa/), "Trilha base");
    // O CheckRow vira role="checkbox" na PR #211; aceitar os dois roles evita
    // que o merge das duas branches quebre este teste.
    fireEvent.click(
      screen.queryByRole("checkbox", { name: "01 · Escopo" }) ??
        screen.getByRole("button", { name: "01 · Escopo" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Publicar e atribuir" })
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Trilha base", modules: 1 })
    );
  });
});

describe("ExportPackageModal", () => {
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <ExportPackageModal
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
        result={null}
      />
    );
    return onSubmit;
  };

  it("sem período, Gerar pacote está desabilitado e o motivo é texto visível", () => {
    const onSubmit = renderIt();
    type(screen.getByLabelText(/^De/), "");
    expect(
      probe(screen.getByRole("button", { name: "Gerar pacote" }), onSubmit)
    ).toEqual(GATED);
    expect(screen.getByText(/Informe o período/)).toBeTruthy();
  });

  it("com período e artefatos, Gerar pacote dispara", () => {
    const onSubmit = renderIt();
    fireEvent.click(screen.getByRole("button", { name: "Gerar pacote" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ format: "csv" })
    );
  });
});

describe("IntakeModal", () => {
  const vendor: VendorRow = {
    id: "v-1",
    code: "V-001",
    name: "OpenAI",
    category: "LLM",
    tier: "APPROVED",
    region: "UE",
    dpa: true,
    retention: "Zero",
    subprocessors: 0,
    maxClass: "CONFIDENTIAL",
    cases: 0,
    renewalAt: null,
    notes: null,
    flags: [],
    criticalMissing: 0,
  };
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <IntakeModal
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
        policyVersion="v1.0"
        vendors={[vendor]}
      />
    );
    return onSubmit;
  };
  const fillTitle = () =>
    type(
      screen.getByPlaceholderText(/Triagem assistida/),
      "Triagem de sinistros"
    );
  const fillObjective = () =>
    type(
      screen.getByPlaceholderText(/Reduzir o tempo médio/),
      "Reduzir o tempo de triagem de 6 para 2 dias."
    );
  const fillOwner = () =>
    type(screen.getByPlaceholderText("Nome de quem responde pelo caso"), "Bia");
  const submitBtn = () =>
    screen.getByRole("button", { name: "Submeter para revisão" });

  it("vazio, Submeter está desabilitado e o motivo é texto visível", () => {
    const onSubmit = renderIt();
    expect(probe(submitBtn(), onSubmit)).toEqual(GATED);
    expect(
      screen.getByText(/Preencha título, objetivo e responsável/)
    ).toBeTruthy();
  });

  it("Responsável é obrigatório: título e objetivo sem responsável continuam travados", () => {
    const onSubmit = renderIt();
    fillTitle();
    fillObjective();
    expect(probe(submitBtn(), onSubmit)).toEqual(GATED);
  });

  it("com título, objetivo e responsável, Submeter dispara", () => {
    const onSubmit = renderIt();
    fillTitle();
    fillObjective();
    fillOwner();
    fireEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ ownerName: "Bia", asDraft: false })
    );
  });
});
