// tab-coleta.test.tsx — o token de respondente só aparece uma vez (o banco
// guarda só o hash). Se a tela recarrega antes de o consultor ver o link, o
// token está perdido pra sempre — não tem "tentar de novo".
//
// Harness reproduz o bug real de `assessment-detail.tsx`: `onChanged`
// recarrega os dados do assessment, e enquanto `loading` a tela inteira
// (inclusive o `ModalProvider`) desmonta pra skeleton. Recarregar imediatamente
// após atribuir — antes de o consultor fechar o modal — some com o link.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentDetail } from "../../app/(meridian)/actions/assessments";

const assignRespondentMock = vi.fn();

vi.mock("@/app/(meridian)/actions/collection", () => ({
  assignRespondent: (...args: unknown[]) => assignRespondentMock(...args),
  closeCollection: vi.fn(),
  sendReminder: vi.fn(),
}));

import { ModalProvider } from "@/components/charter/modal";
import ColetaTab from "@/components/meridian/screens/tab-coleta";

const ASSESSMENT: AssessmentDetail = {
  id: "a1",
  code: "AS-104",
  orgName: "Vanta Saúde",
  sector: "Saúde",
  sizeBand: "200–1.000",
  templateVersion: "v3.2",
  status: "COLLECTING",
  deadline: "2026-12-01T00:00:00.000Z",
  consultantId: "u1",
  benchmarkOptIn: false,
  reassessmentOfCode: null,
  responses: { done: 0, total: 0 },
  evidence: 0,
  scores: null,
  composite: null,
  openedAt: "2026-08-01T00:00:00.000Z",
  closedAt: null,
  respondents: [],
  overrides: [],
  planItems: [],
  contestedSpread: 25,
  gapThreshold: 60,
};

/** Mesma forma de `assessment-detail.tsx`: `loading` desmonta o
 *  `ModalProvider` inteiro pra skeleton. */
function Harness() {
  const [loading, setLoading] = useState(false);
  if (loading) {
    return <div>tela recarregando</div>;
  }
  return (
    <ModalProvider>
      <ColetaTab a={ASSESSMENT} onChanged={() => setLoading(true)} />
    </ModalProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ColetaTab — atribuir respondente", () => {
  it("o link sobrevive até o consultor fechar o modal, e recarrega só depois", async () => {
    assignRespondentMock.mockResolvedValue({
      ok: true,
      data: { id: "r9", token: "tok-abc123" },
    });
    render(<Harness />);

    fireEvent.click(screen.getAllByText("Atribuir respondente")[0]);
    fireEvent.change(screen.getByPlaceholderText("Marina Costa"), {
      target: { value: "Rafael Tomé" },
    });
    fireEvent.change(screen.getByPlaceholderText("Gerente de Dados"), {
      target: { value: "Eng. de Dados" },
    });
    fireEvent.change(screen.getByPlaceholderText("marina@empresa.com"), {
      target: { value: "rafael@x.com" },
    });
    fireEvent.click(screen.getByText("Atribuir e gerar link"));

    // O link precisa aparecer e continuar na tela — não sumir porque a
    // recarga disparou por baixo dele. Vive num <input readOnly value=…>,
    // não em texto — getByDisplayValue, não getByText.
    await waitFor(() => {
      expect(
        screen.getByDisplayValue(/meridian-responder\/tok-abc123/)
      ).toBeTruthy();
    });
    expect(screen.queryByText("tela recarregando")).toBeNull();

    // Fechar o modal (já viu/copiou o link) é o que deve disparar a recarga.
    fireEvent.click(screen.getByText("Concluir"));
    await waitFor(() => {
      expect(screen.getByText("tela recarregando")).toBeTruthy();
    });
  });
});
