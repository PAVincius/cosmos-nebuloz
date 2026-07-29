import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({ updateNativeTaskMock: vi.fn() }));

vi.mock("../../app/(cosmos)/actions/epic-tree", () => ({
  updateNativeTask: h.updateNativeTaskMock,
  createNativeTask: vi.fn(),
  listStoryTasks: vi.fn(),
  listFeatureStories: vi.fn(),
}));

import type { TaskNode } from "../../app/(cosmos)/actions/epic-tree.constants";
import { ModalProvider } from "../../components/cosmos/modal";
import { NativeTaskModal } from "../../components/cosmos/screens/epic-tree/native-task-modal";

const nativeTask: TaskNode = {
  id: "task-1",
  title: "Escrever migration",
  status: "TODO",
  estimateHours: null,
  assigneeName: "Ana Souza",
  externalSource: null,
  externalId: null,
  externalUrl: null,
  blocks: [
    { id: "b1", kind: "heading", text: "Resultado" },
    {
      id: "b2",
      kind: "checklist",
      items: [
        { id: "i1", text: "Primeira", done: false },
        { id: "i2", text: "Segunda", done: true },
      ],
    },
  ],
};

function renderModal(onSaved = vi.fn(), task: TaskNode = nativeTask) {
  render(
    <ModalProvider>
      <NativeTaskModal onSaved={onSaved} task={task} />
    </ModalProvider>
  );
  return onSaved;
}

describe("NativeTaskModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.updateNativeTaskMock.mockResolvedValue({
      ok: true,
      data: { ...nativeTask, assigneeName: null },
    });
  });

  test("shows the checklist progress from the stored blocks", () => {
    renderModal();
    expect(screen.getByText("1/2")).toBeTruthy();
  });

  test("toggling a sub-task autosaves without mutating the original blocks", async () => {
    const before = JSON.stringify(nativeTask.blocks);
    renderModal();

    fireEvent.click(screen.getByRole("checkbox", { name: "Primeira" }));

    await waitFor(() => expect(h.updateNativeTaskMock).toHaveBeenCalled());
    const arg = h.updateNativeTaskMock.mock.calls[0][0];
    expect(arg.taskId).toBe("task-1");
    const toggled = arg.blocks.find((b: { id: string }) => b.id === "b2");
    expect(toggled.items[0].done).toBe(true);
    // A prop recebida não pode ter sido alterada no lugar.
    expect(JSON.stringify(nativeTask.blocks)).toBe(before);
  });

  test("changing status autosaves the new status", async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "REVIEW" },
    });

    await waitFor(() =>
      expect(h.updateNativeTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: "task-1", status: "REVIEW" })
      )
    );
  });

  test("keeps the assignee name the action does not resolve", async () => {
    const onSaved = renderModal();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "DONE" },
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0][0].assigneeName).toBe("Ana Souza");
  });

  test("surfaces a failed save instead of pretending it worked", async () => {
    h.updateNativeTaskMock.mockResolvedValue({
      ok: false,
      error: "sem permissão",
    });
    const onSaved = renderModal();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "DONE" },
    });

    await waitFor(() => expect(screen.getByText(/sem permissão/)).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("adding a block autosaves the longer list", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Texto" }));

    await waitFor(() => expect(h.updateNativeTaskMock).toHaveBeenCalled());
    expect(h.updateNativeTaskMock.mock.calls[0][0].blocks).toHaveLength(3);
  });

  test("removing a block autosaves the shorter list", async () => {
    renderModal();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Remover bloco" })[0]
    );

    await waitFor(() => expect(h.updateNativeTaskMock).toHaveBeenCalled());
    expect(h.updateNativeTaskMock.mock.calls[0][0].blocks).toHaveLength(1);
  });

  test("gives unnamed sub-tasks distinct accessible names by position", async () => {
    const taskWithEmptyChecklist: TaskNode = {
      ...nativeTask,
      blocks: [
        { id: "b1", kind: "heading", text: "Resultado" },
        { id: "b2", kind: "checklist", items: [] },
      ],
    };
    renderModal(vi.fn(), taskWithEmptyChecklist);

    fireEvent.click(screen.getByRole("button", { name: "+ item" }));
    await waitFor(() =>
      expect(h.updateNativeTaskMock).toHaveBeenCalledTimes(1)
    );

    fireEvent.click(screen.getByRole("button", { name: "+ item" }));
    await waitFor(() =>
      expect(h.updateNativeTaskMock).toHaveBeenCalledTimes(2)
    );

    expect(screen.getByRole("checkbox", { name: "Sub-task 1" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Sub-task 2" })).toBeTruthy();
  });
});
