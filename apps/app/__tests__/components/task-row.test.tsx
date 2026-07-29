import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import type { TaskNode } from "../../app/(cosmos)/actions/epic-tree.constants";
import { NavCtx } from "../../components/cosmos/kit";
import { TaskRow } from "../../components/cosmos/screens/epic-tree/task-row";

const nativeTask: TaskNode = {
  id: "task-1",
  title: "Escrever migration",
  status: "TODO",
  estimateHours: 2,
  assigneeName: "Ana Souza",
  externalSource: null,
  externalId: null,
  externalUrl: null,
  blocks: [],
};

const jiraTask: TaskNode = {
  ...nativeTask,
  id: "task-2",
  title: "Ajustar índice",
  externalSource: "jira",
  externalId: "COS-142",
  externalUrl: null,
  blocks: null,
};

function renderRow(ui: ReactNode, navigate = vi.fn()) {
  return render(
    <NavCtx.Provider value={{ navigate, isComingSoon: () => false }}>
      {ui}
    </NavCtx.Provider>
  );
}

describe("TaskRow", () => {
  test("a native task offers the note editor", () => {
    const onOpenNative = vi.fn();
    renderRow(
      <TaskRow
        connected
        onOpenExternal={vi.fn()}
        onOpenNative={onOpenNative}
        task={nativeTask}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir nota/i }));
    expect(onOpenNative).toHaveBeenCalledWith(nativeTask);
    expect(screen.queryByRole("button", { name: /COS-142/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Conectar/i })).toBeNull();
  });

  test("a connected external task opens the read-only detail modal", () => {
    const onOpenExternal = vi.fn();
    renderRow(
      <TaskRow
        connected
        onOpenExternal={onOpenExternal}
        onOpenNative={vi.fn()}
        task={jiraTask}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /COS-142/ }));
    expect(onOpenExternal).toHaveBeenCalledWith(jiraTask);
    expect(screen.queryByRole("button", { name: /Abrir nota/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Conectar/i })).toBeNull();
  });

  test("a disconnected external task routes to integrations instead", () => {
    const navigate = vi.fn();
    const onOpenExternal = vi.fn();
    renderRow(
      <TaskRow
        connected={false}
        onOpenExternal={onOpenExternal}
        onOpenNative={vi.fn()}
        task={jiraTask}
      />,
      navigate
    );

    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));
    expect(navigate).toHaveBeenCalledWith("integrations");
    expect(onOpenExternal).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Abrir nota/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /COS-142/ })).toBeNull();
  });

  test("an external task from an unknown provider falls through to the disconnected state even when connected", () => {
    const unknownProviderTask: TaskNode = {
      ...jiraTask,
      id: "task-3",
      externalSource: "bitbucket",
      externalId: "BB-9",
    };
    const onOpenExternal = vi.fn();
    renderRow(
      <TaskRow
        connected
        onOpenExternal={onOpenExternal}
        onOpenNative={vi.fn()}
        task={unknownProviderTask}
      />
    );

    expect(screen.getByRole("button", { name: /Conectar/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Abrir nota/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /BB-9/ })).toBeNull();
  });

  test("names the origin in text, not only by colour and letter", () => {
    renderRow(
      <TaskRow
        connected
        onOpenExternal={vi.fn()}
        onOpenNative={vi.fn()}
        task={jiraTask}
      />
    );

    expect(screen.getByText("Origem: Jira Software")).toBeTruthy();
  });
});
