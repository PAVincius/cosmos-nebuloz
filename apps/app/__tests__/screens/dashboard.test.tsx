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

// The dashboard awaits a Promise.all over several server actions. Every one of
// them must be mocked: importing the real module pulls in @repo/auth/server ->
// @repo/database, which throws under the client-side env guard in this suite.
vi.mock("@/app/(cosmos)/actions/velocity", () => ({
  listRecentSprints: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

vi.mock("@/app/(cosmos)/actions/budgets", () => ({
  listLeanBudgets: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

vi.mock("@/app/(cosmos)/actions/finops", () => ({
  getCloudCostSummary: vi.fn().mockResolvedValue({ ok: true, data: null }),
}));

vi.mock("@/app/(cosmos)/actions/piplanning", () => ({
  getActiveArtCount: vi.fn().mockResolvedValue({ ok: true, data: 0 }),
  getActivePiPlanning: vi.fn().mockResolvedValue({ ok: true, data: null }),
  listRecentPiPredictability: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

import { listEpics } from "@/app/(cosmos)/actions/kanban";
import DashboardScreen from "../../components/cosmos/screens/dashboard";

describe("DashboardScreen", () => {
  it("renders epics from listEpics, not the static EPICS array", async () => {
    const jsx = await DashboardScreen({});
    const html = JSON.stringify(jsx);
    expect(html).toContain("Real Epic");
  });

  // Toda action caía em `ok ? data : vazio`, então falha de leitura era
  // renderizada como "não há épicos" — a tela mentia com cara de dado.
  it("mostra erro, e não estado vazio, quando listEpics falha", async () => {
    vi.mocked(listEpics).mockResolvedValueOnce({
      ok: false,
      error: "conexão recusada",
    });

    const html = JSON.stringify(await DashboardScreen({}));

    expect(html).toContain("Não foi possível carregar os épicos");
    expect(html).not.toContain("Sem épicos em execução");
    // O KPI "Épicos em progresso" lia da mesma falha e mostrava "0" liso —
    // indistinguível de zero épicos de verdade em execução.
    expect(html).toContain("dados indisponíveis");
  });
});
