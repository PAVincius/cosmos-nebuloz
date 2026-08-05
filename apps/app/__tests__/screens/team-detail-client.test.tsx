// team-detail-client.test.tsx — mounts TeamDetailClient with a fixed
// `initial` prop, verifying the velocity chart renders from real sprint
// data, the load bar/KPIs derive from TeamCapacitySnapshot, the features
// list navigates, PI Objectives render, and honest empty states show up
// with no data — never fabricated numbers.

import { NavCtx } from "@repo/design-system/cosmos/kit";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TeamDetailView } from "@/app/(cosmos)/actions/teams";
import TeamDetailClient from "../../components/cosmos/screens/team-detail-client";

const BASE: TeamDetailView = {
  id: "tm1",
  name: "Squad Atlas",
  focusArea: "Pagamentos",
  velocity: 30,
  wip: 4,
  members: [{ name: "Ana Souza", role: "Lead" }],
  recentCapacity: [
    { period: "2026-06-01", expectedSp: 40, actualSp: 44, utilizationPct: 92 },
  ],
  sprints: [
    { id: "sp2", name: "Sprint 13", capacity: 40, velocity: 44 },
    { id: "sp1", name: "Sprint 12", capacity: 40, velocity: 20 },
  ],
  features: [
    { id: "f1", title: "Checkout PIX", statusId: "DONE", progressPct: 100 },
    {
      id: "f2",
      title: "Split de pagamento",
      statusId: "IN_PROGRESS",
      progressPct: 40,
    },
  ],
  piObjectives: [
    {
      id: "o1",
      title: "Reduzir latência do checkout",
      status: "IN_PROGRESS",
      businessValue: 8,
      plannedValue: 100,
      achievedValue: 40,
    },
  ],
};

function renderWithNav(initial: TeamDetailView, navigate = vi.fn()) {
  render(
    <NavCtx.Provider value={{ navigate, isComingSoon: () => false }}>
      <TeamDetailClient initial={initial} />
    </NavCtx.Provider>
  );
  return navigate;
}

describe("TeamDetailClient", () => {
  it("renders the velocity chart from real closed-sprint data", () => {
    renderWithNav(BASE);

    expect(screen.getByText("Sprint 13")).toBeTruthy();
    expect(screen.getByText("Sprint 12")).toBeTruthy();
  });

  it("shows the capacity load bar and KPIs from TeamCapacitySnapshot, not fabricated", async () => {
    renderWithNav(BASE);

    // utilizationPct straight from the snapshot (92%). KpiCard counts up
    // via requestAnimationFrame; wait for its fallback timeout to settle.
    await waitFor(
      () => expect(screen.getAllByText("92").length).toBeGreaterThan(0),
      { timeout: 3000 }
    );
    expect(screen.getByText("44 pts entregues")).toBeTruthy();
  });

  it("renders the features list and navigates to a feature on click", () => {
    const navigate = renderWithNav(BASE);

    expect(screen.getByText("Checkout PIX")).toBeTruthy();
    fireEvent.click(screen.getByText("Checkout PIX"));

    expect(navigate).toHaveBeenCalledWith("feature", "f1");
  });

  it("renders PI Objectives from real PIObjective rows", () => {
    renderWithNav(BASE);

    expect(screen.getByText("Reduzir latência do checkout")).toBeTruthy();
  });

  it("shows honest empty states with no sprints, features, or objectives — no fabricated data", () => {
    renderWithNav({
      ...BASE,
      sprints: [],
      features: [],
      piObjectives: [],
      recentCapacity: [],
    });

    expect(screen.getByText("Nenhuma sprint fechada ainda")).toBeTruthy();
    expect(screen.getByText("Nenhuma feature atribuída")).toBeTruthy();
    expect(screen.getByText("Sem PI Objectives")).toBeTruthy();
    expect(screen.getByText("Sem snapshot de capacidade")).toBeTruthy();
    const html = document.body.innerHTML;
    // No fabricated burnup/heatmap sections should exist.
    expect(html).not.toContain("Burnup");
    expect(html).not.toContain("heatmap");
  });
});
