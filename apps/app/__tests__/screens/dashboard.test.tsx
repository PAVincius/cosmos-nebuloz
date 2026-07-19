import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(cosmos)/actions/kanban", () => ({
  listEpics: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: "e1",
        title: "Real Epic",
        column: "implementing",
        theme: "Theme A",
        art: "pay",
        artTone: "accent",
        owner: "Ana",
        wsjf: 12,
        size: 8,
        progress: 40,
        hot: false,
      },
    ],
  }),
}));

import DashboardScreen from "../../components/cosmos/screens/dashboard";

describe("DashboardScreen", () => {
  it("renders epics from listEpics, not the static EPICS array", async () => {
    const jsx = await DashboardScreen({});
    const html = JSON.stringify(jsx);
    expect(html).toContain("Real Epic");
  });
});
