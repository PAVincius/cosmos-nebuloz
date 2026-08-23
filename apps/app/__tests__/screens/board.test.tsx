// board.test.tsx — board do time (/cosmos/board), story-060. Primeira tela do
// Cosmos no nível Team. Cobre AC-001 (story na coluna certa), AC-002 (trocar de
// time; time sem sprint aponta a origem), AC-003 (mover), AC-004 (criar story na
// sprint selecionada), AC-005 (task dentro da story) e AC-006 (vazio e erro).
// Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTeamBoardMock = vi.fn();
// Só a leitura é mockada. COLUNAS mora em board.constants.ts — módulo puro, sem
// "use server" e sem @repo/auth/server ou @repo/database atrás — então a tela
// usa o array real, e mudar o vocabulário de StoryStatus quebra aqui em vez de
// passar batido por causa de uma cópia desatualizada no mock.
vi.mock("@/app/(cosmos)/actions/board", () => ({
  getTeamBoard: (...args: unknown[]) => getTeamBoardMock(...args),
}));

const createStoryMock = vi.fn();
const updateStoryStatusMock = vi.fn();
vi.mock("@/app/actions/stories", () => ({
  createStory: (...args: unknown[]) => createStoryMock(...args),
  updateStoryStatus: (...args: unknown[]) => updateStoryStatusMock(...args),
}));

const createTaskMock = vi.fn();
const listTasksByStoryMock = vi.fn();
const updateTaskStatusMock = vi.fn();
vi.mock("@/app/actions/tasks", () => ({
  createTask: (...args: unknown[]) => createTaskMock(...args),
  listTasksByStory: (...args: unknown[]) => listTasksByStoryMock(...args),
  updateTaskStatus: (...args: unknown[]) => updateTaskStatusMock(...args),
}));

import BoardScreen from "../../components/cosmos/screens/board";

const COLUNAS_VAZIAS = [
  { status: "BACKLOG", label: "Backlog", stories: [] },
  { status: "TODO", label: "A fazer", stories: [] },
  { status: "IN_PROGRESS", label: "Em andamento", stories: [] },
  { status: "REVIEW", label: "Revisão", stories: [] },
  { status: "DONE", label: "Concluído", stories: [] },
];

const story = (over: Record<string, unknown> = {}) => ({
  id: "st-1",
  title: "Login com SSO",
  storyPoints: 3,
  priority: "high",
  status: "TODO",
  taskTotal: 0,
  taskDone: 0,
  ...over,
});

const board = (over: Record<string, unknown> = {}) => ({
  teams: [
    { id: "tm-1", name: "Squad Pagamentos" },
    { id: "tm-2", name: "Squad Checkout" },
  ],
  selectedTeamId: "tm-1",
  sprints: [{ id: "spr-1", name: "Sprint 1", status: "ACTIVE" }],
  selectedSprintId: "spr-1",
  columns: COLUNAS_VAZIAS,
  ...over,
});

const comStories = (stories: ReturnType<typeof story>[]) =>
  COLUNAS_VAZIAS.map((c) => ({
    ...c,
    stories: stories.filter((s) => s.status === c.status),
  }));

describe("BoardScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTasksByStoryMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("põe cada story na sua coluna e conta por coluna (AC-001)", async () => {
    getTeamBoardMock.mockResolvedValue({
      ok: true,
      data: board({
        columns: comStories([
          story({ id: "st-1", title: "Login com SSO", status: "TODO" }),
          story({ id: "st-2", title: "Reset de senha", status: "TODO" }),
          story({ id: "st-3", title: "Auditoria", status: "IN_PROGRESS" }),
        ]),
      }),
    });

    render(<BoardScreen />);

    const todo = await screen.findByTestId("coluna-TODO");
    expect(todo.textContent).toContain("Login com SSO");
    expect(todo.textContent).toContain("Reset de senha");
    expect(todo.textContent).not.toContain("Auditoria");

    const andamento = screen.getByTestId("coluna-IN_PROGRESS");
    expect(andamento.textContent).toContain("Auditoria");
    expect(andamento.textContent).not.toContain("Login com SSO");

    expect(screen.getByTestId("contagem-TODO").textContent).toBe("2");
    expect(screen.getByTestId("contagem-IN_PROGRESS").textContent).toBe("1");
  });

  it("recarrega ao trocar de time (AC-002)", async () => {
    getTeamBoardMock.mockResolvedValue({ ok: true, data: board() });

    render(<BoardScreen />);
    await screen.findByTestId("coluna-TODO");

    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "tm-2" },
    });

    await waitFor(() =>
      expect(getTeamBoardMock).toHaveBeenLastCalledWith({ teamId: "tm-2" })
    );
  });

  it("time sem sprint aponta onde a sprint nasce (AC-002)", async () => {
    getTeamBoardMock.mockResolvedValue({
      ok: true,
      data: board({ sprints: [], selectedSprintId: null }),
    });

    render(<BoardScreen />);

    expect(
      await screen.findByText(
        "Este time não tem sprint. A sprint é gerada com o PI Plan do ART, em ARTs."
      )
    ).toBeTruthy();
  });

  it("move a story de coluna e recarrega (AC-003)", async () => {
    getTeamBoardMock.mockResolvedValue({
      ok: true,
      data: board({
        columns: comStories([story({ status: "TODO" })]),
      }),
    });
    updateStoryStatusMock.mockResolvedValue({ ok: true, data: { id: "st-1" } });

    render(<BoardScreen />);
    await screen.findByText("Login com SSO");

    fireEvent.change(screen.getByLabelText("Estado de Login com SSO"), {
      target: { value: "IN_PROGRESS" },
    });

    await waitFor(() =>
      expect(updateStoryStatusMock).toHaveBeenCalledWith("st-1", "IN_PROGRESS")
    );
    await waitFor(() => expect(getTeamBoardMock).toHaveBeenCalledTimes(2));
  });

  it("cria a story na sprint selecionada (AC-004)", async () => {
    getTeamBoardMock.mockResolvedValue({ ok: true, data: board() });
    createStoryMock.mockResolvedValue({ ok: true, data: { id: "st-9" } });

    render(<BoardScreen />);
    await screen.findByTestId("coluna-TODO");

    fireEvent.click(screen.getByRole("button", { name: "Nova story" }));
    // Regex e não string exata: FormField marca campo obrigatório com um " *"
    // no fim do rótulo, que entra no texto do label.
    fireEvent.change(screen.getByLabelText(/^Título da story/), {
      target: { value: "Exportar relatório" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar story" }));

    await waitFor(() =>
      expect(createStoryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sprintId: "spr-1",
          title: "Exportar relatório",
        })
      )
    );
  });

  it("cria a task dentro da story e conclui (AC-005)", async () => {
    getTeamBoardMock.mockResolvedValue({
      ok: true,
      data: board({ columns: comStories([story({ taskTotal: 1 })]) }),
    });
    listTasksByStoryMock.mockResolvedValue({
      ok: true,
      data: [{ id: "tk-1", title: "Subir endpoint", status: "TODO" }],
    });
    createTaskMock.mockResolvedValue({ ok: true, data: { id: "tk-2" } });
    updateTaskStatusMock.mockResolvedValue({ ok: true, data: { id: "tk-1" } });

    render(<BoardScreen />);
    await screen.findByText("Login com SSO");

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir tasks de Login com SSO" })
    );
    await screen.findByText("Subir endpoint");

    fireEvent.change(screen.getByLabelText("Nova task em Login com SSO"), {
      target: { value: "Escrever teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar task" }));

    await waitFor(() =>
      expect(createTaskMock).toHaveBeenCalledWith({
        storyId: "st-1",
        title: "Escrever teste",
      })
    );

    fireEvent.click(screen.getByLabelText("Concluir Subir endpoint"));

    await waitFor(() =>
      expect(updateTaskStatusMock).toHaveBeenCalledWith("tk-1", "DONE")
    );
  });

  it("mostra o vazio quando o tenant não tem time (AC-006)", async () => {
    getTeamBoardMock.mockResolvedValue({
      ok: true,
      data: board({ teams: [], selectedTeamId: null, sprints: [] }),
    });

    render(<BoardScreen />);

    expect(await screen.findByText("Nenhum time ainda.")).toBeTruthy();
  });

  it("não renderiza story nenhuma quando a leitura falha (AC-006)", async () => {
    getTeamBoardMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<BoardScreen />);

    await waitFor(() => expect(screen.queryByText("Carregando...")).toBeNull());
    expect(screen.queryByTestId("coluna-TODO")).toBeNull();
    expect(document.body.innerHTML).not.toContain("Login com SSO");
  });
});
