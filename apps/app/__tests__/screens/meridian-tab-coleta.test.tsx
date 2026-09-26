// tab-coleta.test.tsx — o token de respondente só aparece uma vez (o banco
// guarda só o hash). Se a tela recarrega antes de o consultor ver o link, o
// token está perdido pra sempre — não tem "tentar de novo".
//
// Harness reproduz o bug real de `assessment-detail.tsx`: `onChanged`
// recarrega os dados do assessment, e enquanto `loading` a tela inteira
// (inclusive o `ModalProvider`) desmonta pra skeleton. Recarregar imediatamente
// após atribuir — antes de o consultor fechar o modal — some com o link.
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentDetail } from "../../app/(meridian)/actions/assessments";

const assignRespondentMock = vi.fn();
const revokeRespondentMock = vi.fn();

vi.mock("@/app/(meridian)/actions/collection", () => ({
  assignRespondent: (...args: unknown[]) => assignRespondentMock(...args),
  closeCollection: vi.fn(),
  sendReminder: vi.fn(),
  revokeRespondent: (...args: unknown[]) => revokeRespondentMock(...args),
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
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
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

    // "Concluir" só libera depois de copiar — é a causa raiz do P1 (link
    // perdido sem o consultor ter clicado em Copiar).
    fireEvent.click(screen.getByText("Copiar"));

    // Fechar o modal (já viu/copiou o link) é o que deve disparar a recarga.
    fireEvent.click(screen.getByText("Concluir"));
    await waitFor(() => {
      expect(screen.getByText("tela recarregando")).toBeTruthy();
    });
  });

  it("'Concluir' fica desabilitado até o consultor copiar o link ao menos uma vez", async () => {
    assignRespondentMock.mockResolvedValue({
      ok: true,
      data: { id: "r9", token: "tok-abc123" },
    });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
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
    await waitFor(() => {
      expect(
        screen.getByDisplayValue(/meridian-responder\/tok-abc123/)
      ).toBeTruthy();
    });

    // Antes de copiar, "Concluir" não deixa fechar o modal.
    expect(
      (screen.getByText("Concluir").closest("button") as HTMLButtonElement)
        .disabled
    ).toBe(true);

    fireEvent.click(screen.getByText("Copiar"));
    await waitFor(() => {
      expect(
        (screen.getByText("Concluir").closest("button") as HTMLButtonElement)
          .disabled
      ).toBe(false);
    });

    fireEvent.click(screen.getByText("Concluir"));
    await waitFor(() => {
      expect(screen.getByText("tela recarregando")).toBeTruthy();
    });
  });
});

describe("ColetaTab — revogar respondente", () => {
  const ASSESSMENT_COM_RESPONDENTE: AssessmentDetail = {
    ...ASSESSMENT,
    respondents: [
      {
        id: "r1",
        name: "Marina Costa",
        role: "Gerente de Dados",
        email: "marina@x.com",
        axis: "DATA",
        status: "INVITED",
        invitedAt: "2026-09-20T00:00:00.000Z",
        lastRemindedAt: null,
        completedAt: null,
      },
    ],
  };

  it("pede confirmação, chama revokeRespondent com o id certo e atualiza o estado", async () => {
    revokeRespondentMock.mockResolvedValue({ ok: true, data: undefined });
    render(
      <ModalProvider>
        <ColetaTab a={ASSESSMENT_COM_RESPONDENTE} onChanged={() => {}} />
      </ModalProvider>
    );

    fireEvent.click(screen.getByText("Revogar"));
    // Confirmação: a action não dispara só de clicar no botão da linha.
    expect(revokeRespondentMock).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Revogar/ }));
    await waitFor(() => {
      expect(revokeRespondentMock).toHaveBeenCalledWith({
        respondentId: "r1",
      });
    });
  });

  it("respondente REVOKED aparece riscado, com rótulo, sem contar como 'sem dono'", () => {
    // Só o eixo DATA tem revogado; os outros quatro têm dono ativo — assim
    // "sem dono" só pode se referir ao DATA, sem ambiguidade na asserção.
    const outrosEixos = ["PROCESS", "PEOPLE", "GOVERNANCE", "INFRASTRUCTURE"];
    render(
      <ModalProvider>
        <ColetaTab
          a={{
            ...ASSESSMENT,
            respondents: [
              {
                id: "r1",
                name: "Marina Costa",
                role: "Gerente de Dados",
                email: "marina@x.com",
                axis: "DATA",
                status: "REVOKED",
                invitedAt: "2026-09-20T00:00:00.000Z",
                lastRemindedAt: null,
                completedAt: null,
              },
              ...outrosEixos.map((axis, i) => ({
                id: `ok${i}`,
                name: `Dono ${axis}`,
                role: "Responsável",
                email: `dono${i}@x.com`,
                axis: axis as AssessmentDetail["respondents"][number]["axis"],
                status: "INVITED",
                invitedAt: "2026-09-20T00:00:00.000Z",
                lastRemindedAt: null,
                completedAt: null,
              })),
            ],
          }}
          onChanged={() => {}}
        />
      </ModalProvider>
    );

    expect(screen.getByText("Marina Costa")).toBeTruthy();
    expect(screen.getByText("Revogado")).toBeTruthy();
    // Eixo DATA tem só o revogado: continua "sem dono", mesmo listado.
    expect(screen.getByText("sem dono")).toBeTruthy();
    expect(
      screen.getByText(
        "Eixo sem respondente — o assessment não fecha coleta assim."
      )
    ).toBeTruthy();
    // Revogado não ganha botão de Lembrar/Revogar — só os quatro donos ativos.
    expect(screen.getAllByText("Lembrar")).toHaveLength(4);
    expect(screen.getAllByText("Revogar")).toHaveLength(4);
  });
});
