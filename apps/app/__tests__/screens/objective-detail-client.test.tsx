// objective-detail-client.test.tsx — mounts ObjectiveDetailClient with
// mocked app/actions/okrs actions (no real DB), verifying the initial
// render surfaces the objective, its Key Results, and the per-KR "why"
// note sourced from the latest check-in snapshot.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/okrs", () => ({
  createKeyResult: vi.fn(),
  createKeyResultCheckIn: vi.fn(),
  deleteKeyResult: vi.fn(),
  updateKeyResult: vi.fn(),
  updateOKR: vi.fn(),
}));

import type { ObjectiveDetailFull } from "@/app/(cosmos)/actions/objective-detail";
import ObjectiveDetailClient from "../../components/cosmos/screens/objective-detail-client";

const INITIAL: ObjectiveDetailFull = {
  id: "okr-1",
  title: "Reduzir churn em 20%",
  description: null,
  status: "ON_TRACK",
  ownerId: "user-1",
  ownerName: "Ana Souza",
  keyResults: [
    {
      id: "kr-1",
      title: "Churn mensal",
      current: 8,
      target: 20,
      unit: "%",
      progressPct: 40,
      whyNote: "Progresso consistente nas últimas 2 sprints.",
    },
    {
      id: "kr-2",
      title: "NPS enterprise",
      current: 0,
      target: 10,
      unit: "pts",
      progressPct: 0,
      whyNote: null,
    },
  ],
};

describe("ObjectiveDetailClient", () => {
  it("renders the objective, owner, and each Key Result", () => {
    render(
      <ObjectiveDetailClient
        initial={INITIAL}
        objectiveId="okr-1"
        owners={[{ id: "user-1", name: "Ana Souza" }]}
      />
    );

    expect(screen.getByText("Reduzir churn em 20%")).toBeTruthy();
    expect(screen.getByText("Dono: Ana Souza")).toBeTruthy();
    expect(screen.getByText("Churn mensal")).toBeTruthy();
    expect(screen.getByText("NPS enterprise")).toBeTruthy();
  });

  it("shows the latest check-in note as the KR's why explanation", () => {
    render(
      <ObjectiveDetailClient
        initial={INITIAL}
        objectiveId="okr-1"
        owners={[]}
      />
    );

    expect(
      screen.getByText("Progresso consistente nas últimas 2 sprints.")
    ).toBeTruthy();
  });

  it("offers an 'add why' prompt for a KR with no note yet", () => {
    render(
      <ObjectiveDetailClient
        initial={INITIAL}
        objectiveId="okr-1"
        owners={[]}
      />
    );

    expect(
      screen.getByText(/Por que está crítico: qual é o bloqueio principal\?/)
    ).toBeTruthy();
  });
});
