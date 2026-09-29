import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A3 — lista de evidências em Coleta e no gap (specs/010-evidencia-coleta-gap).

const h = vi.hoisted(() => ({
  listAssessmentEvidence: vi.fn(),
  requestEvidenceUrl: vi.fn(),
}));

vi.mock("@/app/(meridian)/actions/report", () => ({
  listAssessmentEvidence: h.listAssessmentEvidence,
  requestEvidenceUrl: h.requestEvidenceUrl,
}));
vi.mock("@/components/cosmos/use-action-toast", () => ({
  useActionToast: (fn: () => Promise<unknown>) => fn(),
}));

import { EvidenceList } from "@/components/meridian/screens/evidence-list";

const AS_ID = "as-1";
const ok = <T,>(data: T) => ({ ok: true as const, data });

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("EvidenceList", () => {
  it("lista cada evidência com um botão para abrir", async () => {
    h.listAssessmentEvidence.mockResolvedValue(
      ok({
        total: 2,
        items: [
          { id: "ev-1", label: "politica-dados.pdf", eliminated: false },
          { id: "ev-2", label: "contrato.pdf", eliminated: false },
        ],
      })
    );
    render(<EvidenceList assessmentId={AS_ID} total={2} />);
    expect(
      await screen.findByRole("button", { name: /politica-dados\.pdf/ })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /contrato\.pdf/ })).toBeTruthy();
    expect(h.listAssessmentEvidence).toHaveBeenCalledWith({
      assessmentId: AS_ID,
    });
  });

  it("clicar abre o arquivo pela leitura auditada, uma evidência por vez", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    h.requestEvidenceUrl.mockResolvedValue(
      ok({ url: "https://signed.example/x", expiresIn: 300 })
    );
    h.listAssessmentEvidence.mockResolvedValue(
      ok({
        total: 2,
        items: [
          { id: "ev-1", label: "a.pdf", eliminated: false },
          { id: "ev-2", label: "b.pdf", eliminated: false },
        ],
      })
    );
    render(<EvidenceList assessmentId={AS_ID} total={2} />);
    fireEvent.click(await screen.findByRole("button", { name: /b\.pdf/ }));
    await waitFor(() =>
      expect(h.requestEvidenceUrl).toHaveBeenCalledExactlyOnceWith({
        evidenceId: "ev-2",
      })
    );
    await waitFor(() =>
      expect(tab.location.href).toBe("https://signed.example/x")
    );
  });

  it("evidência eliminada pela retenção aparece marcada e sem botão", async () => {
    h.listAssessmentEvidence.mockResolvedValue(
      ok({
        total: 2,
        items: [
          { id: "ev-1", label: "viva.pdf", eliminated: false },
          { id: "ev-2", label: "velha.pdf", eliminated: true },
        ],
      })
    );
    render(<EvidenceList assessmentId={AS_ID} total={2} />);
    await screen.findByRole("button", { name: /viva\.pdf/ });
    expect(screen.queryByRole("button", { name: /velha\.pdf/ })).toBeNull();
    expect(screen.getByText(/velha\.pdf/)).toBeTruthy();
    expect(screen.getByText(/eliminada pela retenção/i)).toBeTruthy();
  });

  it("sem permissão (lista vazia, total > 0): só a contagem, nenhum botão", async () => {
    h.listAssessmentEvidence.mockResolvedValue(ok({ total: 3, items: [] }));
    render(<EvidenceList assessmentId={AS_ID} total={3} />);
    await waitFor(() => expect(h.listAssessmentEvidence).toHaveBeenCalled());
    expect(screen.getByText(/3 evidência\(s\) anexada\(s\)/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("assessment sem evidência: diz que não há, sem botão nem chamada", () => {
    render(<EvidenceList assessmentId={AS_ID} total={0} />);
    expect(screen.getByText(/sem evidência anexada/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(h.listAssessmentEvidence).not.toHaveBeenCalled();
  });

  it("enquanto carrega, mostra a contagem; se a leitura falha, mantém a contagem", async () => {
    h.listAssessmentEvidence.mockResolvedValue({ ok: false, error: "falhou" });
    render(<EvidenceList assessmentId={AS_ID} total={2} />);
    expect(screen.getByText(/2 evidência\(s\) anexada\(s\)/)).toBeTruthy();
    await waitFor(() => expect(h.listAssessmentEvidence).toHaveBeenCalled());
    expect(screen.getByText(/2 evidência\(s\) anexada\(s\)/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
