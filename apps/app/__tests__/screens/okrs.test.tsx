// okrs.test.tsx — regression coverage for the ObjectiveCard entry point:
// the card previously had no onClick to the objective detail screen
// (okrs.tsx currently a known gap). Mocks listOkrs/createKeyResultCheckIn
// (no real DB) and asserts clicking the card header navigates to the new
// "okr" route with the objective's id.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(cosmos)/actions/okrs", () => ({
  listOkrs: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: "okr-1",
        title: "Reduzir churn em 20%",
        status: "ON_TRACK",
        ownerName: "Ana Souza",
        keyResults: [
          {
            id: "kr-1",
            title: "Churn mensal",
            current: 8,
            target: 20,
            unit: "%",
            progressPct: 40,
          },
        ],
      },
    ],
  }),
}));
vi.mock("@/app/actions/okrs", () => ({
  createKeyResultCheckIn: vi.fn(),
}));

import { NavCtx } from "@repo/design-system/cosmos/kit";
import OkrsScreen from "../../components/cosmos/screens/okrs";

describe("OkrsScreen — ObjectiveCard navigation", () => {
  it("navigates to the objective detail screen when the card header is clicked", async () => {
    const navigate = vi.fn();
    render(
      <NavCtx.Provider value={{ navigate, isComingSoon: () => false }}>
        <OkrsScreen />
      </NavCtx.Provider>
    );

    const title = await screen.findByText("Reduzir churn em 20%");
    title.click();

    expect(navigate).toHaveBeenCalledWith("okr", "okr-1");
  });
});
