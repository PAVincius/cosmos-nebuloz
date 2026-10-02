// Aviso ao titular na bateria do respondente — condição única do parecer de
// Compliance (796dab44, docs/compliance/2026-09-24-parecer-meridian-respondente.md)
// pra liberar este fluxo em produção. Texto verbatim de
// docs/compliance/operadora-controladora.md §4. Prova: o aviso está na tela
// já no primeiro render, antes de qualquer resposta — não atrás de clique,
// não só depois de enviar.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Battery } from "../../app/(meridian)/actions/respondent";

vi.mock("@/app/(meridian)/actions/respondent", () => ({
  attachEvidence: vi.fn(),
  saveDraft: vi.fn(),
  submitBattery: vi.fn(),
}));

import { RespondentForm } from "@/components/meridian/respondent-form";

const BATTERY: Battery = {
  context: {
    respondentId: "r1",
    tenantId: "t1",
    assessmentId: "a1",
    assessmentCode: "AS-104",
    orgName: "Vanta Saúde",
    axis: "DATA",
    axisLabel: "Data",
    name: "Jonas Reis",
    deadline: "2026-12-01T00:00:00.000Z",
    status: "PENDING",
  },
  questions: [
    {
      id: "q1",
      code: "Q-D01",
      type: "LIKERT",
      text: "Qual a cobertura de linhagem?",
      scaleLabels: [],
      answer: null,
      evidence: [],
    },
  ],
};

describe("RespondentForm — aviso ao titular", () => {
  it("mostra o aviso da Compliance já no primeiro render, antes de qualquer resposta", () => {
    render(<RespondentForm battery={BATTERY} token="tok-abc" />);

    expect(
      screen.getByText("Se seus dados chegaram até nós por uma organização")
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Ela é a controladora; nós tratamos os dados em nome dela, como operadora/
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        /procure a organização que convidou você ou conduziu a reunião/
      )
    ).toBeTruthy();

    // Ninguém respondeu nada ainda — o aviso não depende de interação.
    expect(screen.queryByText(/Enviar respostas/)).toBeTruthy();
    expect(
      (
        screen
          .getByText("Enviar respostas")
          .closest("button") as HTMLButtonElement
      ).disabled
    ).toBe(false);
  });

  it("mantém o endereço de contato da política interna atual (privacy@nebuloz.ai)", () => {
    render(<RespondentForm battery={BATTERY} token="tok-abc" />);
    const link = screen.getByText("privacy@nebuloz.ai");
    expect(link.getAttribute("href")).toBe("mailto:privacy@nebuloz.ai");
  });

  it("avisa que evidência anexada some em 90 dias, prazo fixo da Nebuloz — não da organização cliente (parecer 2026-09-28)", () => {
    render(<RespondentForm battery={BATTERY} token="tok-abc" />);
    expect(screen.getByText(/90 dias/)).toBeTruthy();
    expect(
      screen.getByText(/organização que convidou você não escolhe/)
    ).toBeTruthy();
  });
});

// Atrito A1: o prazo mostrado ao respondente é o dia de Brasília, não o do
// navegador. 02/11 02:59Z é 01/11 23:59 em Brasília; num navegador em UTC o
// `toLocaleDateString` puro mostrava 02/11.
describe("prazo na bateria do respondente", () => {
  it("mostra o dia de Brasília mesmo com o navegador em outro fuso", () => {
    const original = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      render(
        <RespondentForm
          battery={{
            ...BATTERY,
            context: {
              ...BATTERY.context,
              deadline: "2026-11-02T02:59:59.999Z",
            },
          }}
          token="t"
        />
      );
      expect(screen.getByText(/prazo 01\/11\/2026/)).toBeDefined();
    } finally {
      process.env.TZ = original;
    }
  });
});
