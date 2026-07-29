import { expect, test } from "@playwright/test";
import { beat, resetBeats } from "./_utils";

// Usability Lab — Demo 1: "Um PI Planning com Cosmos" (RTE + PO + BO).
// Walks the "Cena 2 (com Cosmos)" beats: a RTE opens the PI session with team
// capacity already loaded, the Program Board assembles features/dependencies/
// ROAM, and Business Owners score PI Objectives in context — no post-planning
// spreadsheet night. Each beat produces a screenshot for tour review.

test.describe("Lab · Demo 1 — PI Planning (RTE→PO→BO)", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("PI Planning tour: session → program board → capacity → ROAM → objectives", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    resetBeats();

    // 1. RTE abre o PISession — times e capacidade já carregados.
    await beat(page, testInfo, {
      screen: "piplanning",
      slug: "demo1-pi-planning",
      expectText: "PI Planning",
      expectData: ["PI 2026-Q2", "Lançar Portfolio Kanban em produção"],
    });

    // 2. Capacity por time visível no painel.
    await beat(page, testInfo, {
      screen: "capacity",
      slug: "demo1-capacity",
      expectText: "Capacity Planning",
      expectData: ["Team Nebula"],
    });

    // 3. Program Board se monta: features por sprint, dependências, ROAM.
    await beat(page, testInfo, {
      screen: "program",
      slug: "demo1-program-board",
      expectText: "Program Board",
      expectData: ["Team Nebula", "Portfolio Kanban Board (5 colunas SAFe)"],
    });

    // 4. Riscos ROAM em view dedicada.
    await beat(page, testInfo, {
      screen: "risks",
      slug: "demo1-roam-risks",
      expectText: "Riscos",
      expectData: ["Capacidade do team reduzida por 2 semanas (férias)"],
    });

    // 5. Business Owners atribuem business value às PI Objectives (OKRs).
    await beat(page, testInfo, {
      screen: "okrs",
      slug: "demo1-pi-objectives",
      expectText: "OKRs",
      expectData: ["Reduzir lead time de portfolio em 40%"],
    });

    // Surface any not-ported screens as a soft signal in the report.
    expect(testInfo.annotations.filter((a) => a.type === "not-ported")).toEqual(
      []
    );
  });
});
