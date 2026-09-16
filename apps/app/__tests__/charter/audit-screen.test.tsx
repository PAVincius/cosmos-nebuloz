/** @vitest-environment jsdom */
// audit-screen.test.tsx — Histórico de Auditoria: o KpiCard "Exportações
// registradas" estava em tone="green" — exportação não é sucesso, é um fato
// neutro (os vizinhos "Entradas no período" é purple e "Alterações de
// política" é accent). O teste prova o tom pelo id do gradiente que o
// próprio KpiCard grava no SVG (`cosmos_sig_<tone>_<icon>`), não por
// snapshot de estilo. Os dois botões do header ("Filtros avançados" e
// "Exportar pacote") já eram controles reais antes desta onda — nenhuma
// mudança neles.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAuditMock = vi.fn();
const exportEvidenceMock = vi.fn();
vi.mock("@/app/(charter)/actions/audit", () => ({
  listAudit: (...args: unknown[]) => listAuditMock(...args),
  exportEvidence: (...args: unknown[]) => exportEvidenceMock(...args),
}));

const getSettingsMock = vi.fn();
vi.mock("@/app/(charter)/actions/settings", () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
}));

import AuditScreen from "../../components/charter/screens/audit";

describe("AuditScreen", () => {
  beforeEach(() => {
    listAuditMock.mockReset();
    exportEvidenceMock.mockReset();
    getSettingsMock.mockReset();

    listAuditMock.mockResolvedValue({
      ok: true,
      data: { rows: [], actors: [] },
    });
    getSettingsMock.mockResolvedValue({ ok: true, data: null });
  });

  it("KpiCard 'Exportações registradas' não usa mais tone=green — exportação não é sucesso", async () => {
    const { container } = render(<AuditScreen />);

    await screen.findByText("Exportações registradas");
    expect(container.querySelector("#cosmos_sig_green_download")).toBeNull();
  });

  it("mantém os controles reais do header — 'Filtros avançados' e 'Exportar pacote'", async () => {
    render(<AuditScreen />);

    await screen.findByText("Histórico de Auditoria");
    expect(
      screen.getByRole("button", { name: /filtros avançados/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /exportar pacote/i })
    ).toBeTruthy();
  });
});
