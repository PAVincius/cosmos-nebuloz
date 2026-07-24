// roadmap.test.tsx — screen-level coverage for the multi-PI Gantt timeline:
// real items render into ART lanes with period columns, milestone flags and
// the status legend survive, and the empty state is honest (no items → no
// fabricated grid).
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoadmapItemView } from "../../app/(cosmos)/actions/roadmap";

const listRoadmapItemsMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/roadmap", () => ({
  listRoadmapItems: (...args: unknown[]) => listRoadmapItemsMock(...args),
}));

import RoadmapScreen from "../../components/cosmos/screens/roadmap";

const ITEMS: RoadmapItemView[] = [
  {
    id: "ri1",
    title: "Migração multi-tenant",
    startDate: "2026-01-05T00:00:00.000Z",
    endDate: "2026-02-10T00:00:00.000Z",
    color: "#6366f1",
    status: "IN_PROGRESS",
    milestone: true,
    artId: "art-1",
    artName: "ART Norte",
  },
  {
    id: "ri2",
    title: "Item sem ART",
    startDate: "2026-01-05T00:00:00.000Z",
    endDate: "2026-01-20T00:00:00.000Z",
    color: "#22c55e",
    status: "PLANNED",
    milestone: false,
    artId: null,
    artName: null,
  },
];

describe("RoadmapScreen", () => {
  it("renders ART lanes, item bars and the status legend from real data", async () => {
    listRoadmapItemsMock.mockResolvedValueOnce({ ok: true, data: ITEMS });
    render(<RoadmapScreen />);

    expect(await screen.findByText("ART Norte")).toBeTruthy();
    expect(screen.getByText("Sem ART atribuído")).toBeTruthy();
    expect(screen.getByText("Migração multi-tenant")).toBeTruthy();
    expect(screen.getByText("Item sem ART")).toBeTruthy();

    // Status legend — one entry per known status (also echoed on the item
    // bars themselves, so at least one match rather than exactly one) plus
    // the milestone marker, which only ever appears in the legend.
    expect(screen.getAllByText("Planejado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Em progresso").length).toBeGreaterThan(0);
    expect(screen.getByText("Concluído")).toBeTruthy();
    expect(screen.getByText("Marco")).toBeTruthy();

    expect(screen.getByText("2 itens no horizonte")).toBeTruthy();
    expect(screen.getByText("1 marcos")).toBeTruthy();
  });

  it("shows an honest empty state and no grid when there are no roadmap items", async () => {
    listRoadmapItemsMock.mockResolvedValueOnce({ ok: true, data: [] });
    render(<RoadmapScreen />);

    expect(await screen.findByText("Nenhum item de roadmap")).toBeTruthy();
    expect(screen.queryByText("ART")).toBeNull();
  });

  it("shows the error state when the action fails", async () => {
    listRoadmapItemsMock.mockResolvedValueOnce({
      ok: false,
      error: "boom",
    });
    render(<RoadmapScreen />);

    expect(
      await screen.findByText("Não foi possível carregar os dados.")
    ).toBeTruthy();
  });
});
