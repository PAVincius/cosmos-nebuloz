/** @vitest-environment jsdom */
// modals-distill.test.tsx — controles mortos e defaults que mentiam nos
// modais do Charter.
//
//  1. PublishVersionModal: os checkboxes "Notificar" e "Exigir re-aceite" não
//     entravam no onSubmit (PublishSchema só aceita summary) — somem; a
//     informação vira texto no painel de efeitos.
//  2. ExportPackageModal: período fixo 2026-04-01→2026-06-30 vira últimos 90
//     dias a partir de hoje, editável.
//  3. NewVendorModal: região e retenção nascem "Não declarada" (vazio →
//     undefined → null no banco), não "UE (Frankfurt)" e "Zero". As listas de
//     categoria/área/público saem do protótipo healthtech para rules.ts.
//  4. DecisionModal: sem veredito pré-selecionado; "Registrar decisão" travado
//     até escolher. Rodapé sem " · —" quando o papel não veio.
//  5. IntakeModal: "Início pretendido" chega ao onSubmit como launchTarget;
//     "Plano de revisão humana" (coletado e descartado) some.
//  6. <Kbd>esc</Kbd> em todos os modais — ModalHost fecha todos com Esc.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VendorRow } from "@/app/(charter)/actions/vendors";
import {
  INTAKE_DEPARTMENTS,
  TRACK_AUDIENCES,
  VENDOR_CATEGORIES,
} from "@/lib/charter/rules";
import { ClauseLibraryModal } from "../../components/charter/modals/clause-library";
import { DecisionModal } from "../../components/charter/modals/decision";
import { DiffModal } from "../../components/charter/modals/diff";
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
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });

afterEach(() => {
  vi.useRealTimers();
});

describe("1. PublishVersionModal sem controles mortos", () => {
  it("não tem checkbox de notificar nem de re-aceite; o efeito é texto", () => {
    render(
      <PublishVersionModal
        blockers={[]}
        currentVersion="v1.0"
        nextVersion="v1.1"
        onClose={noop}
        onSubmit={noop}
        pending={false}
        peopleCount={10}
        policyName="Política de IA"
        trackCount={2}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Notificar todos os colaboradores" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Exigir re-aceite nas trilhas vinculadas",
      })
    ).toBeNull();
    expect(
      screen.getByText(/Aceites das trilhas vinculadas serão invalidados/)
    ).toBeTruthy();
    expect(screen.getByText(/2 trilhas · 10 pessoas/)).toBeTruthy();
  });
});

describe("2. ExportPackageModal com período honesto", () => {
  it("nasce com os últimos 90 dias a partir de hoje", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 16, 12));
    render(
      <ExportPackageModal
        onClose={noop}
        onSubmit={noop}
        pending={false}
        result={null}
      />
    );
    expect((screen.getByLabelText(/^De/) as HTMLInputElement).value).toBe(
      "2026-06-18"
    );
    expect((screen.getByLabelText(/^Até/) as HTMLInputElement).value).toBe(
      "2026-09-16"
    );
  });

  it("os campos são editáveis e o valor editado vai ao onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <ExportPackageModal
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
        result={null}
      />
    );
    type(screen.getByLabelText(/^De/), "2026-01-01");
    type(screen.getByLabelText(/^Até/), "2026-03-31");
    fireEvent.click(screen.getByRole("button", { name: "Gerar pacote" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-01-01", to: "2026-03-31" })
    );
  });
});

describe("3. NewVendorModal nasce sem postura declarada", () => {
  const renderIt = (onSubmit = vi.fn()) => {
    render(
      <NewVendorModal
        clauses={[]}
        onClose={noop}
        onSubmit={onSubmit}
        pending={false}
      />
    );
    return onSubmit;
  };

  it("região e retenção começam em 'Não declarada' e vão como undefined", () => {
    const onSubmit = renderIt();
    const region = screen.getByLabelText(
      /Região de processamento/
    ) as HTMLSelectElement;
    const retention = screen.getByLabelText(
      /Retenção declarada/
    ) as HTMLSelectElement;
    expect(region.value).toBe("");
    expect(retention.value).toBe("");
    expect(region.options[0].text).toBe("Não declarada");
    expect(retention.options[0].text).toBe("Não declarada");
    type(screen.getByPlaceholderText(/Corpus Legal Review/), "Anthropic");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.region).toBeUndefined();
    expect(sent.retention).toBeUndefined();
  });

  it("região e retenção escolhidas vão como texto", () => {
    const onSubmit = renderIt();
    type(screen.getByLabelText(/Região de processamento/), "BR (São Paulo)");
    type(screen.getByLabelText(/Retenção declarada/), "Zero");
    type(screen.getByPlaceholderText(/Corpus Legal Review/), "Anthropic");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ region: "BR (São Paulo)", retention: "Zero" })
    );
  });

  it("as listas de categoria, área e público vêm de rules.ts, sem nada clínico", () => {
    for (const list of [
      VENDOR_CATEGORIES,
      INTAKE_DEPARTMENTS,
      TRACK_AUDIENCES,
    ]) {
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((x) => /cl[ií]nic/i.test(x))).toBe(false);
    }
    renderIt();
    const category = screen.getByLabelText(/Categoria/) as HTMLSelectElement;
    expect(Array.from(category.options).map((o) => o.text)).toEqual([
      ...VENDOR_CATEGORIES,
    ]);
  });
});

describe("4. DecisionModal sem veredito pré-selecionado", () => {
  const renderIt = (deciderRole: string, onSubmit = vi.fn()) => {
    render(
      <DecisionModal
        approvalPath={null}
        caseCode="UC-001"
        caseTitle="Triagem"
        dataClass="INTERNAL"
        deciderName="Você"
        deciderRole={deciderRole}
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

  it("Registrar decisão está travado até escolher, com o motivo visível", () => {
    const onSubmit = renderIt("Compliance");
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    const btn = screen.getByRole("button", { name: "Registrar decisão" });
    expect(btn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(btn);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Escolha o veredito/)).toBeTruthy();
  });

  it("depois de escolher e justificar, a confirmação leva o rótulo do veredito", () => {
    const onSubmit = renderIt("Compliance");
    fireEvent.click(
      screen.getByRole("button", { name: /^Bloquear Incompatível/ })
    );
    type(
      screen.getByPlaceholderText(/Uso compatível com a seção 4/),
      "Incompatível com a seção 4 da política."
    );
    fireEvent.click(screen.getByRole("button", { name: "Bloquear" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "BLOCKED" })
    );
  });

  it("rodapé mostra 'Você · Compliance' com papel, e só 'Você' sem papel", () => {
    renderIt("Compliance");
    fireEvent.click(screen.getByRole("button", { name: /^Bloquear/ }));
    type(
      screen.getByPlaceholderText(/Uso compatível com a seção 4/),
      "Incompatível com a seção 4 da política."
    );
    expect(screen.getByText(/Você · Compliance/)).toBeTruthy();
  });

  it("sem papel (getSettings falhou), o rodapé mostra só 'Você'", () => {
    renderIt("—");
    fireEvent.click(screen.getByRole("button", { name: /^Bloquear/ }));
    type(
      screen.getByPlaceholderText(/Uso compatível com a seção 4/),
      "Incompatível com a seção 4 da política."
    );
    expect(screen.queryByText(/Você · —/)).toBeNull();
    expect(screen.getByText(/· Você$/)).toBeTruthy();
  });
});

describe("5. IntakeModal persiste o início pretendido", () => {
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
  const fill = () => {
    type(
      screen.getByPlaceholderText(/Triagem assistida/),
      "Triagem de sinistros"
    );
    type(
      screen.getByPlaceholderText(/Reduzir o tempo médio/),
      "Reduzir o tempo de triagem de 6 para 2 dias."
    );
    type(screen.getByPlaceholderText("Nome de quem responde pelo caso"), "Bia");
  };

  it("'Início pretendido' vai ao onSubmit como launchTarget", () => {
    const onSubmit = renderIt();
    fill();
    type(screen.getByLabelText(/Início pretendido/), "2026-11-01");
    fireEvent.click(
      screen.getByRole("button", { name: "Submeter para revisão" })
    );
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ launchTarget: "2026-11-01" })
    );
  });

  it("sem data, launchTarget vai como undefined (a action trata como null)", () => {
    const onSubmit = renderIt();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(onSubmit.mock.calls[0][0].launchTarget).toBeUndefined();
  });

  it("'Plano de revisão humana' não existe mais no formulário", () => {
    renderIt();
    expect(screen.queryByLabelText(/Plano de revisão humana/)).toBeNull();
    expect(
      screen.queryByRole("option", { name: "Revisão por amostragem" })
    ).toBeNull();
  });

  it("a área solicitante vem de rules.ts", () => {
    renderIt();
    const dept = screen.getByLabelText(/Área solicitante/) as HTMLSelectElement;
    expect(Array.from(dept.options).map((o) => o.text)).toEqual([
      ...INTAKE_DEPARTMENTS,
    ]);
  });
});

describe("6. <Kbd>esc</Kbd> em todos os modais", () => {
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
  const modals: [string, React.ReactElement][] = [
    [
      "IntakeModal",
      <IntakeModal
        key="intake"
        onClose={noop}
        onSubmit={noop}
        pending={false}
        policyVersion="v1.0"
        vendors={[vendor]}
      />,
    ],
    [
      "DecisionModal",
      <DecisionModal
        approvalPath={null}
        caseCode="UC-001"
        caseTitle="Triagem"
        dataClass="INTERNAL"
        deciderName="Você"
        deciderRole="Compliance"
        key="decision"
        onClose={noop}
        onSubmit={noop}
        pending={false}
        riskLabel="Moderado"
        riskTone="amber"
        score={6}
        vendorName={null}
      />,
    ],
    [
      "MitigationModal",
      <MitigationModal
        cases={[{ code: "UC-001", title: "Triagem" }]}
        key="mitigation"
        onClose={noop}
        onSubmit={noop}
        pending={false}
      />,
    ],
    [
      "PublishVersionModal",
      <PublishVersionModal
        blockers={[]}
        currentVersion="v1.0"
        key="publish-version"
        nextVersion="v1.1"
        onClose={noop}
        onSubmit={noop}
        pending={false}
        peopleCount={10}
        policyName="Política de IA"
        trackCount={2}
      />,
    ],
    [
      "DiffModal",
      <DiffModal
        diff={{ version: "v1.1", previous: "v1.0", rows: [] }}
        key="diff"
        onClose={noop}
        publishedAt="2026-09-01T00:00:00.000Z"
        publishedBy="Marina"
        summary="Seção 4 muda."
      />,
    ],
    [
      "VendorTierModal",
      <VendorTierModal
        key="vendor-tier"
        onClose={noop}
        onSubmit={noop}
        pending={false}
        vendor={{ name: "OpenAI", tier: "REVIEW", cases: 2, maxClass: null }}
      />,
    ],
    [
      "NewVendorModal",
      <NewVendorModal
        clauses={[]}
        key="new-vendor"
        onClose={noop}
        onSubmit={noop}
        pending={false}
      />,
    ],
    [
      "ClauseLibraryModal",
      <ClauseLibraryModal
        key="clause-library"
        onClose={noop}
        rows={[
          { code: "CL-01", name: "DPA", critical: true, covered: 1, total: 2 },
        ]}
      />,
    ],
    [
      "PublishTrackModal",
      <PublishTrackModal
        key="publish-track"
        onClose={noop}
        onSubmit={noop}
        pending={false}
        policyVersion="v1.0"
        sections={[]}
      />,
    ],
    [
      "ExportPackageModal",
      <ExportPackageModal
        key="export-package"
        onClose={noop}
        onSubmit={noop}
        pending={false}
        result={null}
      />,
    ],
  ];

  it.each(modals)("%s mostra a tecla esc no rodapé", (_name, node) => {
    render(node);
    const kbd = screen.getByText("esc");
    expect(kbd.tagName).toBe("KBD");
  });

  it("PublishTrackModal usa o público de rules.ts", () => {
    render(modals[8][1]);
    const audience = screen.getByLabelText(/Público/) as HTMLSelectElement;
    expect(Array.from(audience.options).map((o) => o.text)).toEqual([
      ...TRACK_AUDIENCES,
    ]);
  });
});
