// arts.test.tsx — tela /cosmos/arts (story-059). Cobre os ACs visíveis na
// superfície: AC-001 (criar ART, nome duplicado não some), AC-002 (ART sem time
// não oferece PI), AC-003 (criar PI informa a contagem de sprints), AC-004
// (DRAFT é sinalizado e a tela o abre; demais estados não oferecem) e AC-005
// (vazio e erro sem ART fabricado). Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listArtsMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/arts", () => ({
  listArts: (...args: unknown[]) => listArtsMock(...args),
}));

// As mutações vivem em app/actions/arts/lifecycle.ts — a tela importa de lá em
// vez de ganhar uma terceira cópia de createART neste repo.
const createARTMock = vi.fn();
const createPIPlanWithSprintsMock = vi.fn();
const transitionPIPlanMock = vi.fn();
vi.mock("@/app/actions/arts/lifecycle", () => ({
  createART: (...args: unknown[]) => createARTMock(...args),
  createPIPlanWithSprints: (...args: unknown[]) =>
    createPIPlanWithSprintsMock(...args),
  transitionPIPlan: (...args: unknown[]) => transitionPIPlanMock(...args),
}));

import ArtsScreen from "../../components/cosmos/screens/arts";

const pi = (over: Record<string, unknown> = {}) => ({
  id: "pi-1",
  name: "PI 2026.1",
  status: "DRAFT",
  startDate: "2026-09-01T00:00:00.000Z",
  endDate: "2026-11-10T00:00:00.000Z",
  sprintCount: 5,
  visivelNoBoard: false,
  podeAbrir: true,
  ...over,
});

const art = (over: Record<string, unknown> = {}) => ({
  id: "art-1",
  name: "ART Pagamentos",
  status: "INACTIVE",
  piCadenceWeeks: 10,
  sprintLengthWeeks: 2,
  ipSprintEnabled: true,
  teamCount: 3,
  sprintsPorTime: 5,
  piPlans: [],
  ...over,
});

describe("ArtsScreen", () => {
  beforeEach(() => {
    // mockReset e não clearAllMocks: só o reset esvazia a fila de
    // mockResolvedValueOnce, e um `once` sobrando vaza para o teste seguinte.
    listArtsMock.mockReset();
    createARTMock.mockReset();
    createPIPlanWithSprintsMock.mockReset();
    transitionPIPlanMock.mockReset();
  });

  it("cria um ART pela tela e recarrega a lista (AC-001)", async () => {
    listArtsMock
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [art({ name: "ART Novo" })] });
    createARTMock.mockResolvedValue({
      ok: true,
      data: { id: "art-9", name: "ART Novo" },
    });

    render(<ArtsScreen />);
    await screen.findByText("Nenhum ART ainda.");

    fireEvent.click(screen.getByRole("button", { name: "Novo ART" }));
    fireEvent.change(screen.getByLabelText("Nome do ART"), {
      target: { value: "ART Novo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar ART" }));

    await waitFor(() =>
      expect(createARTMock).toHaveBeenCalledWith({
        name: "ART Novo",
        piCadenceWeeks: 10,
        sprintLengthWeeks: 2,
        ipSprintEnabled: true,
      })
    );
    await waitFor(() => expect(listArtsMock).toHaveBeenCalledTimes(2));
  });

  it("mantém o formulário aberto quando o nome já existe (AC-001)", async () => {
    listArtsMock.mockResolvedValue({ ok: true, data: [art()] });
    createARTMock.mockResolvedValue({ ok: false, error: "ART_NAME_CONFLICT" });

    render(<ArtsScreen />);
    await screen.findByText("ART Pagamentos");

    fireEvent.click(screen.getByRole("button", { name: "Novo ART" }));
    fireEvent.change(screen.getByLabelText("Nome do ART"), {
      target: { value: "art pagamentos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar ART" }));

    await waitFor(() => expect(createARTMock).toHaveBeenCalled());
    // O modal continua de pé com o texto digitado: o erro não pode custar o
    // que o usuário escreveu, e a lista não recarrega atrás de um fracasso.
    expect(screen.getByLabelText("Nome do ART")).toBeTruthy();
    expect(listArtsMock).toHaveBeenCalledTimes(1);
  });

  it("sinaliza ART sem time e não oferece criar PI (AC-002)", async () => {
    listArtsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        art({ id: "a1", name: "ART Com Time", teamCount: 2 }),
        art({ id: "a2", name: "ART Vazio", teamCount: 0 }),
      ],
    });

    render(<ArtsScreen />);
    await screen.findByText("ART Vazio");

    expect(
      screen.getByRole("button", { name: "Novo PI em ART Com Time" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Novo PI em ART Vazio" })
    ).toBeNull();
    expect(
      screen.getByText(
        "Sem time vinculado, este ART não gera PI Plan nem sprints."
      )
    ).toBeTruthy();
  });

  it("cria o PI e informa quantos sprints foram gerados (AC-003)", async () => {
    listArtsMock
      .mockResolvedValueOnce({ ok: true, data: [art()] })
      .mockResolvedValueOnce({
        ok: true,
        data: [art({ piPlans: [pi()] })],
      });
    createPIPlanWithSprintsMock.mockResolvedValue({
      ok: true,
      data: { id: "pi-1", sprintCount: 5 },
    });

    render(<ArtsScreen />);
    await screen.findByText("ART Pagamentos");

    fireEvent.click(
      screen.getByRole("button", { name: "Novo PI em ART Pagamentos" })
    );
    fireEvent.change(screen.getByLabelText("Nome do PI"), {
      target: { value: "PI 2026.1" },
    });
    fireEvent.change(screen.getByLabelText("Início"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Criar PI e gerar sprints" })
    );

    await waitFor(() =>
      expect(createPIPlanWithSprintsMock).toHaveBeenCalledWith({
        artId: "art-1",
        name: "PI 2026.1",
        startDate: "2026-09-01T00:00:00.000Z",
      })
    );
    await waitFor(() => expect(listArtsMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("5 sprints")).toBeTruthy();
  });

  it("avisa que DRAFT não alimenta o board e abre para planejamento (AC-004)", async () => {
    listArtsMock
      .mockResolvedValueOnce({ ok: true, data: [art({ piPlans: [pi()] })] })
      .mockResolvedValueOnce({
        ok: true,
        data: [
          art({
            piPlans: [
              pi({
                status: "PLANNING",
                visivelNoBoard: true,
                podeAbrir: false,
              }),
            ],
          }),
        ],
      });
    transitionPIPlanMock.mockResolvedValue({
      ok: true,
      data: { status: "PLANNING" },
    });

    render(<ArtsScreen />);
    await screen.findByText("PI 2026.1");

    expect(
      screen.getByText(
        "Em DRAFT, este PI não aparece no Program Board nem recebe features."
      )
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir PI 2026.1 para planejamento" })
    );

    await waitFor(() =>
      expect(transitionPIPlanMock).toHaveBeenCalledWith({
        piPlanId: "pi-1",
        event: "OPEN_PLANNING",
      })
    );
    await waitFor(() => expect(listArtsMock).toHaveBeenCalledTimes(2));
  });

  it("não oferece abrir um PI que já saiu de DRAFT (AC-004)", async () => {
    listArtsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        art({
          piPlans: [
            pi({
              status: "EXECUTING",
              visivelNoBoard: true,
              podeAbrir: false,
            }),
          ],
        }),
      ],
    });

    render(<ArtsScreen />);
    await screen.findByText("PI 2026.1");

    expect(
      screen.queryByRole("button", {
        name: "Abrir PI 2026.1 para planejamento",
      })
    ).toBeNull();
    expect(
      screen.queryByText(
        "Em DRAFT, este PI não aparece no Program Board nem recebe features."
      )
    ).toBeNull();
  });

  it("mostra o vazio explicando que o ART é o primeiro passo (AC-005)", async () => {
    listArtsMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<ArtsScreen />);

    expect(await screen.findByText("Nenhum ART ainda.")).toBeTruthy();
  });

  it("não renderiza ART nenhum quando a leitura falha (AC-005)", async () => {
    listArtsMock.mockResolvedValueOnce({ ok: false, error: "boom" });

    render(<ArtsScreen />);

    await waitFor(() => expect(screen.queryByText("Carregando...")).toBeNull());
    expect(screen.queryByText("Nenhum ART ainda.")).toBeNull();
    expect(document.body.innerHTML).not.toContain("ART Pagamentos");
  });
});
