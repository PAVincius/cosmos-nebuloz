/** @vitest-environment jsdom */
// vendor-detail-screen.test.tsx — duas correções da onda 5a: (1) o estado de
// carregamento era um retângulo genérico único, sem o idioma de skeleton do
// resto do produto (mesmo ajuste que policy.tsx e case-detail.tsx já tinham
// ganhado); (2) o KpiCard "Casos de uso vinculados" jogava todos os códigos
// unidos por " · " no hint — com muitos casos vinculados, o card estoura.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getVendorMock = vi.fn();
vi.mock("@/app/(charter)/actions/vendors", () => ({
  getVendor: (...args: unknown[]) => getVendorMock(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import VendorDetailScreen from "../../components/charter/screens/vendor-detail";

function baseVendor(linkedCasesCount: number) {
  return {
    ok: true as const,
    data: {
      id: "v1",
      code: "FOR-01",
      name: "Fornecedor Teste",
      category: "SaaS",
      tier: "APPROVED",
      region: "BR",
      dpa: true,
      retention: "Zero",
      subprocessors: 2,
      maxClass: "CONFIDENTIAL",
      cases: linkedCasesCount,
      renewalAt: null,
      notes: null,
      flags: [],
      criticalMissing: 0,
      clauseCodes: [],
      reasoning: ["Motivo de exemplo"],
      library: [],
      linkedCases: Array.from({ length: linkedCasesCount }, (_, i) => ({
        code: `UC-${String(i + 1).padStart(3, "0")}`,
        title: `Caso ${i + 1}`,
        dataClass: "INTERNAL" as const,
        exceedsMaxClass: false,
      })),
    },
  };
}

describe("VendorDetailScreen", () => {
  it("estado de carregamento usa o idioma de SkeletonCard, não um retângulo genérico", () => {
    getVendorMock.mockReturnValue(
      new Promise(() => {
        // nunca resolve — mantém a tela em loading durante o teste
      })
    );

    const { container } = render(<VendorDetailScreen param="FOR-01" />);

    expect(container.querySelector('[style*="height: 240px"]')).toBeNull();
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(1);
  });

  it("hint de 'Casos de uso vinculados' com 12 casos trunca em 3 + 'e mais 9'", async () => {
    getVendorMock.mockResolvedValue(baseVendor(12));

    render(<VendorDetailScreen param="FOR-01" />);

    await screen.findByText("Fornecedor Teste");
    const hint = await screen.findByText(/e mais 9/);
    expect(hint.textContent).not.toContain("UC-004");
    expect(hint.textContent).toContain("e mais 9");
  });

  // O score 0–100 é uma coluna com default 50 que nenhuma escrita calcula
  // (SRD §3). Mostrar o número era mostrar o default como medição.
  it("score do fornecedor diz 'sem medição' no lugar do número", async () => {
    getVendorMock.mockResolvedValue(baseVendor(0));

    render(<VendorDetailScreen param="FOR-01" />);

    await screen.findByText("Fornecedor Teste");
    expect(screen.getByText("sem medição")).toBeTruthy();
    expect(screen.getByText(/nenhuma regra calcula/i)).toBeTruthy();
    expect(screen.queryByText("/100")).toBeNull();
  });
});
