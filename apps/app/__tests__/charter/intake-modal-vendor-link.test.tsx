/** @vitest-environment jsdom */
// intake-modal-vendor-link.test.tsx — o bloqueio do intake aponta a saída.
// Com todo fornecedor em REVIEW sem cláusula (maxClass nulo), o Callout de
// "combinação não permitida" já explicava o motivo, mas não dizia onde
// resolver: o requester lia a recusa e fechava o modal. Agora o Callout leva
// um link para o fornecedor, onde as cláusulas são ajustadas.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VendorRow } from "@/app/(charter)/actions/vendors";
import { IntakeModal } from "../../components/charter/modals-intake";

function vendor(over: Partial<VendorRow> = {}): VendorRow {
  return {
    id: "v-1",
    code: "V-001",
    name: "OpenAI",
    category: "LLM",
    tier: "REVIEW",
    region: "EUA",
    dpa: false,
    retention: null,
    subprocessors: 0,
    maxClass: null,
    cases: 0,
    renewalAt: null,
    notes: null,
    flags: [],
    criticalMissing: 0,
    ...over,
  };
}

describe("IntakeModal com fornecedor inelegível", () => {
  it("o Callout de bloqueio linka para ajustar as cláusulas do fornecedor", () => {
    render(
      <IntakeModal
        onClose={() => {
          // sem efeito no teste
        }}
        onSubmit={() => {
          // sem efeito no teste
        }}
        pending={false}
        policyVersion={null}
        vendors={[vendor()]}
      />
    );

    expect(screen.getByText(/não pode processar dado/)).toBeTruthy();
    const link = screen.getByRole("link", {
      name: /Ajustar cláusulas de OpenAI/,
    });
    expect(link.getAttribute("href")).toBe("/charter/vendor/V-001");
  });

  it("com fornecedor elegível não há bloqueio nem link", () => {
    render(
      <IntakeModal
        onClose={() => {
          // sem efeito no teste
        }}
        onSubmit={() => {
          // sem efeito no teste
        }}
        pending={false}
        policyVersion="v1.0"
        vendors={[vendor({ maxClass: "CONFIDENTIAL", tier: "APPROVED" })]}
      />
    );

    expect(screen.queryByText(/não pode processar dado/)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /Ajustar cláusulas/ })
    ).toBeNull();
  });
});
