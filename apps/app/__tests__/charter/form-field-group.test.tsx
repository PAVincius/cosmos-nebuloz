/** @vitest-environment jsdom */
// form-field-group.test.tsx — crítica de a11y (Sam, leitor de tela): a PR #211
// consertou TableRow, ModalHost e CheckRow mas deixou de fora `FormField`
// envolvendo `Segmented`/`RadioCards` — o <label> associa o rótulo só ao
// primeiro <button> do grupo, e os demais ficam sem nome acessível algum.
// `FormField({ variant: "group" })` troca o <label> por um grupo
// (role="group" + aria-labelledby) quando o filho é um conjunto de botões.
// Mutação que este arquivo pega: voltar ao <label> em qualquer um destes
// call sites → getByRole("group", { name }) falha.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VendorRow } from "@/app/(charter)/actions/vendors";
import { FormField, Segmented } from "../../components/charter/form-kit";
import { DecisionModal } from "../../components/charter/modals/decision";
import { PublishTrackModal } from "../../components/charter/modals/publish-track";
import { VendorTierModal } from "../../components/charter/modals/vendor-tier";
import { IntakeModal } from "../../components/charter/modals-intake";

const noop = () => {
  // sem efeito no teste
};

describe('FormField variant="group"', () => {
  it("renderiza role=group com o nome do rótulo, e os botões ficam dentro do grupo", () => {
    render(
      <FormField label="Classe de dado" variant="group">
        <Segmented
          onChange={noop}
          options={["Pública", "Interna", "Confidencial"]}
          value="Pública"
        />
      </FormField>
    );
    const group = screen.getByRole("group", { name: "Classe de dado" });
    expect(within(group).getAllByRole("button")).toHaveLength(3);
  });

  it("variant default ('field') continua um <label> comum, sem role=group", () => {
    render(
      <FormField label="Nome">
        <input />
      </FormField>
    );
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
  });
});

describe("grupos de botões nos modais alterados", () => {
  it("DecisionModal: 'Decisão' é um grupo acessível e os 4 vereditos ficam dentro", () => {
    render(
      <DecisionModal
        approvalPath={null}
        caseCode="UC-001"
        caseTitle="Triagem"
        dataClass="INTERNAL"
        deciderName="Você"
        deciderRole="Compliance"
        onClose={noop}
        onSubmit={noop}
        pending={false}
        riskLabel="Moderado"
        riskTone="amber"
        score={6}
        vendorName={null}
      />
    );
    const group = screen.getByRole("group", { name: /^Decisão/ });
    expect(within(group).getAllByRole("button")).toHaveLength(4);
  });

  it("PublishTrackModal: 'Re-certificação' é um grupo acessível com Anual/Semestral dentro", () => {
    render(
      <PublishTrackModal
        onClose={noop}
        onSubmit={noop}
        pending={false}
        policyVersion="v1.0"
        sections={[]}
      />
    );
    const group = screen.getByRole("group", { name: /^Re-certificação/ });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });

  it("VendorTierModal: 'Situação' é um grupo acessível com os tiers dentro", () => {
    render(
      <VendorTierModal
        onClose={noop}
        onSubmit={noop}
        pending={false}
        vendor={{ name: "OpenAI", tier: "REVIEW", cases: 2, maxClass: null }}
      />
    );
    const group = screen.getByRole("group", { name: /^Situação/ });
    expect(within(group).getAllByRole("button").length).toBeGreaterThan(1);
  });

  it("IntakeModal: classe de dado, exposição e criticidade viram grupos acessíveis", () => {
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
      score: 0,
      cases: 0,
      renewalAt: null,
      notes: null,
      flags: [],
      criticalMissing: 0,
    };
    render(
      <IntakeModal
        onClose={noop}
        onSubmit={noop}
        pending={false}
        policyVersion="v1.0"
        vendors={[vendor]}
      />
    );
    for (const name of [
      /^Classe de dado envolvida/,
      /^Exposição/,
      /^Criticidade da decisão/,
    ]) {
      const group = screen.getByRole("group", { name });
      expect(within(group).getAllByRole("button").length).toBeGreaterThan(1);
    }
  });
});
