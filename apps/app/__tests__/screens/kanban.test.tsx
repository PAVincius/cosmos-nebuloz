import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listEpicsMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/kanban", () => ({
  listEpics: (...args: unknown[]) => listEpicsMock(...args),
  createEpic: vi.fn(),
  moveEpic: vi.fn(),
}));

// NewEpicModal (statically imported by kanban.tsx, even though it isn't
// rendered in these tests) pulls in EntityLinkField, which imports the real
// entity-search server action at module scope — mock it so the import chain
// never touches @repo/auth/server under the client-side test env guard.
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

import KanbanScreen from "../../components/cosmos/screens/kanban";

const FAKE_MOCK_TITLES = [
  "Antifraude em tempo real (ML)",
  "Migração core para multi-tenant",
  "SSO & SCIM Enterprise",
  "FinOps guardrails por ART",
];

describe("KanbanScreen", () => {
  it("renders the error state and no fabricated epics when listEpics fails", async () => {
    listEpicsMock.mockResolvedValueOnce({ ok: false, error: "boom" });
    render(<KanbanScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os épicos do portfólio.")
      ).toBeTruthy()
    );

    const html = document.body.innerHTML;
    for (const title of FAKE_MOCK_TITLES) {
      expect(html).not.toContain(title);
    }
    expect(html).not.toContain("EP-097");
    expect(html).not.toContain("EP-076");
    expect(html).not.toContain("EP-061");
    expect(html).not.toContain("EP-042");
    expect(html).not.toContain("fonte:");
  });

  it("renders the empty state (not fabricated epics) when the tenant has none", async () => {
    listEpicsMock.mockResolvedValueOnce({ ok: true, data: [] });
    render(<KanbanScreen />);

    await waitFor(() =>
      expect(screen.getByText("Nenhum épico no portfólio")).toBeTruthy()
    );

    const html = document.body.innerHTML;
    for (const title of FAKE_MOCK_TITLES) {
      expect(html).not.toContain(title);
    }
  });

  it("renders real epics from listEpics on success", async () => {
    listEpicsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: "real-epic-1",
          title: "Real Epic From The Server",
          column: "funnel",
          theme: null,
          art: null,
          artTone: "accent",
          owner: "Ana",
          wsjf: 5,
          size: 8,
          progress: 0,
          hot: false,
        },
      ],
    });
    render(<KanbanScreen />);

    await waitFor(() =>
      expect(screen.getByText("Real Epic From The Server")).toBeTruthy()
    );
    const html = document.body.innerHTML;
    for (const title of FAKE_MOCK_TITLES) {
      expect(html).not.toContain(title);
    }
  });

  it("does not show the fabricated ORBIT copilot insight naming EP-097/EP-076", async () => {
    listEpicsMock.mockResolvedValueOnce({ ok: true, data: [] });
    render(<KanbanScreen />);
    await waitFor(() =>
      expect(screen.getByText("Nenhum épico no portfólio")).toBeTruthy()
    );
    expect(document.body.innerHTML).not.toContain(
      "priorize EP-097 e EP-076 no próximo refinamento"
    );
  });
});
