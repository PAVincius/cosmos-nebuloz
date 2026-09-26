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
const reissueRespondentLinkMock = vi.fn();

vi.mock("@/app/(meridian)/actions/collection", () => ({
  assignRespondent: (...args: unknown[]) => assignRespondentMock(...args),
  closeCollection: vi.fn(),
  sendReminder: vi.fn(),
  revokeRespondent: (...args: unknown[]) => revokeRespondentMock(...args),
  reissueRespondentLink: (...args: unknown[]) =>
    reissueRespondentLinkMock(...args),
  reissuePendingLinks: vi.fn(),
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
    // perdido sem o consultor ter clicado em Copiar). `copyLink` é async
    // (espera a escrita no clipboard resolver antes de marcar `copied`).
    fireEvent.click(screen.getByText("Copiar"));
    await waitFor(() => {
      expect(
        (screen.getByText("Concluir").closest("button") as HTMLButtonElement)
          .disabled
      ).toBe(false);
    });

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

  it("Esc sem copiar pede confirmação — não fecha nem chama onAssigned direto", async () => {
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
    await waitFor(() => {
      expect(
        screen.getByDisplayValue(/meridian-responder\/tok-abc123/)
      ).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    // Esc sozinho não fecha nem recarrega — só abre a confirmação.
    expect(screen.queryByText("tela recarregando")).toBeNull();
    expect(screen.getByText("Fechar sem copiar o link?")).toBeTruthy();
    expect(
      screen.getByDisplayValue(/meridian-responder\/tok-abc123/)
    ).toBeTruthy();

    // "Voltar e copiar" cancela a confirmação, link continua na tela.
    fireEvent.click(screen.getByText("Voltar e copiar"));
    expect(screen.queryByText("Fechar sem copiar o link?")).toBeNull();
    expect(
      screen.getByDisplayValue(/meridian-responder\/tok-abc123/)
    ).toBeTruthy();
  });

  it("X sem copiar pede confirmação; 'Fechar mesmo assim' fecha e recarrega", async () => {
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
    await waitFor(() => {
      expect(
        screen.getByDisplayValue(/meridian-responder\/tok-abc123/)
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("tela recarregando")).toBeNull();
    expect(screen.getByText("Fechar sem copiar o link?")).toBeTruthy();

    fireEvent.click(screen.getByText("Fechar mesmo assim"));
    await waitFor(() => {
      expect(screen.getByText("tela recarregando")).toBeTruthy();
    });
  });

  it("clipboard falha: seleciona o texto e avisa; onCopy manual libera 'Concluir'", async () => {
    assignRespondentMock.mockResolvedValue({
      ok: true,
      data: { id: "r9", token: "tok-abc123" },
    });
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("negado")) },
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
    const input = await screen.findByDisplayValue(
      /meridian-responder\/tok-abc123/
    );

    fireEvent.click(screen.getByText("Copiar"));
    await waitFor(() => {
      expect(screen.getByText(/Não deu pra copiar automático/)).toBeTruthy();
    });
    expect(
      (screen.getByText("Concluir").closest("button") as HTMLButtonElement)
        .disabled
    ).toBe(true);

    fireEvent.copy(input);
    await waitFor(() => {
      expect(
        (screen.getByText("Concluir").closest("button") as HTMLButtonElement)
          .disabled
      ).toBe(false);
    });
  });

  // P3 (achado do dogfood M1/M2, 2026-09-26): `markDirty` (useEffect
  // `link && !copied`) marca o `ModalHost` como sujo assim que o link
  // aparece — e nada nunca chama `markClean` de volta. Depois de copiar,
  // `dirty` continua `true` pro resto da vida do modal, então o clique no
  // backdrop (que passa pelo `tryClose`/`dirty` do `ModalHost`, não pelo
  // `requestClose` próprio deste modal) ainda dispara o alerta genérico do
  // `ModalHost` ("Descartar alterações?", form-kit.tsx/modal.tsx) — alarme
  // falso, já que o consultor fez a coisa certa. `it.fails`: documenta o
  // bug pro dev: deve virar `it` puro quando `DirtyCtx` ganhar `markClean` e
  // este componente chamá-lo ao copiar.
  it.fails("backdrop depois de copiar fecha direto — não repete 'Descartar alterações?'", async () => {
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

    fireEvent.click(screen.getByText("Copiar"));
    await waitFor(() => {
      expect(
        (screen.getByText("Concluir").closest("button") as HTMLButtonElement)
          .disabled
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Fechar modal" }));
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
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

describe("ColetaTab — reemitir link individual (spec 006 US1)", () => {
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

  it("chama reissueRespondentLink com o id certo e mostra o link novo no mesmo modal de link", async () => {
    reissueRespondentLinkMock.mockResolvedValue({
      ok: true,
      data: { id: "r1", token: "tok-reemitido" },
    });
    render(
      <ModalProvider>
        <ColetaTab a={ASSESSMENT_COM_RESPONDENTE} onChanged={() => {}} />
      </ModalProvider>
    );

    fireEvent.click(screen.getByText("Reemitir link"));
    await waitFor(() => {
      expect(reissueRespondentLinkMock).toHaveBeenCalledWith({
        respondentId: "r1",
      });
    });
    expect(
      await screen.findByDisplayValue(/meridian-responder\/tok-reemitido/)
    ).toBeTruthy();
    expect(screen.getByText("Link reemitido")).toBeTruthy();
  });

  it("reusa a guarda de fechamento: Esc sem copiar o link reemitido pede confirmação", async () => {
    reissueRespondentLinkMock.mockResolvedValue({
      ok: true,
      data: { id: "r1", token: "tok-reemitido" },
    });
    render(
      <ModalProvider>
        <ColetaTab a={ASSESSMENT_COM_RESPONDENTE} onChanged={() => {}} />
      </ModalProvider>
    );

    fireEvent.click(screen.getByText("Reemitir link"));
    await screen.findByDisplayValue(/meridian-responder\/tok-reemitido/);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText("Fechar sem copiar o link?")).toBeTruthy();
    expect(
      screen.getByDisplayValue(/meridian-responder\/tok-reemitido/)
    ).toBeTruthy();
  });
});
