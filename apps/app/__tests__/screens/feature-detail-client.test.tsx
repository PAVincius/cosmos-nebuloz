// feature-detail-client.test.tsx — mounts FeatureDetailClient with a fixed
// `initial` prop (no action mocking needed — data arrives from the server
// wrapper), verifying the Stories → Tasks drilldown expands on click, the
// breadcrumb navigates to the parent epic, prev/next navigate to siblings,
// and the empty state is honest when there are no stories.

import { NavCtx } from "@repo/design-system/cosmos/kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeatureDetail } from "@/app/(cosmos)/actions/epics";
import FeatureDetailClient from "../../components/cosmos/screens/feature-detail-client";

const BASE: FeatureDetail = {
  id: "f1",
  title: "Checkout PIX",
  statusId: "IN_PROGRESS",
  bv: 8,
  tc: 5,
  rr: 3,
  js: 2,
  wsjfScore: 8,
  storyPoints: 5,
  progressPct: 40,
  acceptanceCriteria: ["Critério A"],
  epicId: "e1",
  epicTitle: "Pagamentos Instantâneos",
  stories: [
    {
      id: "s1",
      title: "Implementar endpoint de cobrança",
      status: "IN_PROGRESS",
      storyPoints: 3,
      tasks: [
        { id: "tk1", title: "Criar handler", status: "DONE" },
        { id: "tk2", title: "Escrever testes", status: "TODO" },
      ],
    },
  ],
  prevFeatureId: "f0",
  nextFeatureId: "f2",
};

function renderWithNav(initial: FeatureDetail, navigate = vi.fn()) {
  render(
    <NavCtx.Provider value={{ navigate, isComingSoon: () => false }}>
      <FeatureDetailClient initial={initial} />
    </NavCtx.Provider>
  );
  return navigate;
}

describe("FeatureDetailClient", () => {
  it("renders KPIs and the story, collapsed by default (tasks hidden)", () => {
    renderWithNav(BASE);

    expect(screen.getByText("Checkout PIX")).toBeTruthy();
    expect(screen.getByText("Implementar endpoint de cobrança")).toBeTruthy();
    expect(screen.queryByText("Criar handler")).toBeNull();
  });

  it("expands a story on click to reveal its tasks", () => {
    renderWithNav(BASE);

    fireEvent.click(screen.getByText("Implementar endpoint de cobrança"));

    expect(screen.getByText("Criar handler")).toBeTruthy();
    expect(screen.getByText("Escrever testes")).toBeTruthy();
    expect(screen.getByText("1/2 tasks concluídas")).toBeTruthy();
  });

  it("navigates to the parent epic via the breadcrumb", () => {
    const navigate = renderWithNav(BASE);

    fireEvent.click(screen.getByText("← Pagamentos Instantâneos"));

    expect(navigate).toHaveBeenCalledWith("epic", "e1");
  });

  it("navigates to prev/next sibling features", () => {
    const navigate = renderWithNav(BASE);

    fireEvent.click(screen.getByText("‹ Anterior"));
    expect(navigate).toHaveBeenCalledWith("feature", "f0");

    fireEvent.click(screen.getByText("Próxima ›"));
    expect(navigate).toHaveBeenCalledWith("feature", "f2");
  });

  it("shows an honest empty state with no stories, and no prev/next when there are no siblings", () => {
    renderWithNav({
      ...BASE,
      stories: [],
      prevFeatureId: null,
      nextFeatureId: null,
    });

    expect(screen.getByText("Nenhuma story vinculada")).toBeTruthy();
    expect(screen.queryByText("‹ Anterior")).toBeNull();
    expect(screen.queryByText("Próxima ›")).toBeNull();
  });
});
