import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { TaskNode } from "../../app/(cosmos)/actions/epic-tree.constants";
import { ModalProvider } from "../../components/cosmos/modal";
import { TaskDetailModal } from "../../components/cosmos/screens/epic-tree/task-detail-modal";

const jiraTask: TaskNode = {
  id: "task-1",
  title: "Ajustar índice",
  status: "REVIEW",
  estimateHours: 3,
  assigneeName: "Ana Souza",
  externalSource: "jira",
  externalId: "COS-142",
  externalUrl: null,
  blocks: null,
};

function renderModal(task: TaskNode) {
  return render(
    <ModalProvider>
      <TaskDetailModal task={task} />
    </ModalProvider>
  );
}

describe("TaskDetailModal", () => {
  test("falls back to the provider's built URL when sync stored none", () => {
    renderModal(jiraTask);
    expect(
      screen
        .getByRole("link", { name: /Abrir no Jira Software/ })
        .getAttribute("href")
    ).toBe("https://cosmos.atlassian.net/browse/COS-142");
  });

  test("prefers the URL the sync actually stored", () => {
    renderModal({
      ...jiraTask,
      externalUrl: "https://jira.example.com/COS-142",
    });
    expect(
      screen
        .getByRole("link", { name: /Abrir no Jira Software/ })
        .getAttribute("href")
    ).toBe("https://jira.example.com/COS-142");
  });

  test("names an unknown provider without rendering 'undefined'", () => {
    renderModal({
      ...jiraTask,
      externalSource: "bitbucket",
      externalUrl: null,
    });
    expect(screen.queryByText(/undefined/)).toBeNull();
    // Sem provider conhecido e sem URL gravada não há para onde mandar o usuário.
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("states plainly that editing happens in the source tool", () => {
    renderModal(jiraTask);
    expect(
      screen.getByText(/A edição acontece na ferramenta de origem/)
    ).toBeTruthy();
  });
});
