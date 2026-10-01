import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Entregável DISPENSADO na lista da fase (Crivo, #331): o P3.2 do Atlas aparecia
// com "Iniciar". Dispensado não vale para a trilha e não tem ação — a tela mostra
// o estado e o motivo, e esconde o que mexeria nele.

vi.mock("@/app/(scaffold)/actions/deliverables", () => ({
  approveDeliverable: vi.fn(),
  attachDeliverableVersion: vi.fn(),
  readDeliverableFile: vi.fn(),
  reopenDeliverable: vi.fn(),
  requestDeliverableAdjustment: vi.fn(),
  startDeliverable: vi.fn(),
  submitDeliverable: vi.fn(),
  assignDeliverable: vi.fn(),
  addDeliverableLink: vi.fn(),
  removeDeliverableLink: vi.fn(),
}));

import { DeliverableList } from "@/components/scaffold/deliverable-list";

const ok = { allowed: true, reason: null };

const item = (over: Record<string, unknown> = {}) =>
  ({
    id: "d1",
    phaseInstanceId: "ph1",
    code: "P3.2",
    title: "Papéis formais de IA e dados em 1 ou 2 áreas",
    status: "NOT_STARTED",
    required: true,
    dispensedReason: null,
    ownerId: null,
    approverId: null,
    hasFile: false,
    fileName: null,
    version: 0,
    derived: false,
    lastReview: null,
    links: [],
    linkAccess: ok,
    assignAccess: ok,
    attach: ok,
    actions: {
      START: ok,
      SUBMIT: ok,
      APPROVE: ok,
      REQUEST_ADJUSTMENT: ok,
      REOPEN: ok,
    },
    ...over,
  }) as never;

const renderList = (items: unknown[]) =>
  render(
    <DeliverableList
      assignees={[]}
      items={items as never[]}
      onChanged={() => {}}
    />
  );

describe("lista de entregáveis", () => {
  it("entregável normal mostra Iniciar, Designar e Vínculos", () => {
    renderList([item()]);
    expect(screen.getByRole("button", { name: /^iniciar$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /designar/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /vínculos/i })).toBeDefined();
  });

  it("dispensado mostra o estado e o motivo, e nenhuma ação", () => {
    renderList([
      item({
        required: false,
        dispensedReason:
          "Dispensado pelo overlay do cliente: os papéis de dado já existem no Atlas",
      }),
    ]);
    expect(screen.getByText("Dispensado")).toBeDefined();
    expect(
      screen.getByText(/os papéis de dado já existem no atlas/i)
    ).toBeDefined();

    expect(screen.queryByRole("button", { name: /^iniciar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /designar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /vínculos/i })).toBeNull();
    expect(screen.queryByLabelText(/anexar arquivo/i)).toBeNull();
    // Nenhum botão sobra na linha.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("dispensar um não tira a ação dos outros", () => {
    renderList([
      item({ id: "d1", code: "P3.2", dispensedReason: "motivo" }),
      item({ id: "d2", code: "P1.1", title: "Catálogo" }),
    ]);
    expect(screen.getAllByRole("button", { name: /^iniciar$/i })).toHaveLength(
      1
    );
  });
});
