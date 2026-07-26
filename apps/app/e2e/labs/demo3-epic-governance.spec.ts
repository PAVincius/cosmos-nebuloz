import { expect, test } from "@playwright/test";
import { beat, openFirstCard, resetBeats } from "./_utils";

// Usability Lab — Demo 3: "Do Epic confuso a plano governado" (PO + LPM).
// Walks the "Cena 2 (com Cosmos)" beats: a PO structures an epic via the Lean
// Business Case fields with LACE (copilot) scoring INVEST/WSJF, the epic moves
// through the Portfolio Kanban under an approval workflow that logs every
// decision, and the LPM sees it against themes, budget and OKRs before approving.

test.describe("Lab · Demo 3 — Epic → plano governado (PO→LPM)", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("Governance tour: kanban → epic LBC → WSJF → copilot → gates → decision log → themes → budget → OKRs", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    resetBeats();

    // 1. Portfolio Kanban — épico em status FUNNEL.
    await beat(page, testInfo, {
      screen: "kanban",
      slug: "demo3-portfolio-kanban",
      expectText: "Kanban de Épicos",
    });

    // 2. Epic detail — Lean Business Case (hipótese, outcomes, leading indicators, INVEST/WSJF).
    await openFirstCard(page, testInfo, {
      cardSelector: ".card-in",
      urlFragment: /\/cosmos\/epic\//,
      slug: "demo3-epic-lean-business-case",
    });

    // 3. WSJF Rankings — priorização gerada a partir de valor/tempo/risco.
    await beat(page, testInfo, {
      screen: "wsjf",
      slug: "demo3-wsjf",
      expectText: "WSJF Rankings",
    });

    // 4. LACE copilot — sugestões de texto e score INVEST.
    await beat(page, testInfo, {
      screen: "copilot",
      slug: "demo3-lace-copilot",
      expectText: "Copilot",
    });

    // 5. Governance Board — ApprovalWorkflow nas transições de estágio.
    await beat(page, testInfo, {
      screen: "governance",
      slug: "demo3-governance-gates",
      expectText: "Governance Board",
    });

    // 6. Decision Log — cada transição vira um DecisionLogEntry (quem, por quê, com quais dados).
    await beat(page, testInfo, {
      screen: "decisions",
      slug: "demo3-decision-log",
      expectText: "Decision Log",
    });

    // 7. Strategic Themes — contexto estratégico do épico.
    await beat(page, testInfo, {
      screen: "themes",
      slug: "demo3-strategic-themes",
      expectText: "Temas Estratégicos",
    });

    // 8. Lean Budgets — quanto o épico consome de orçamento.
    await beat(page, testInfo, {
      screen: "budgets",
      slug: "demo3-lean-budget",
      expectText: "Lean Budgets",
    });

    // 9. OKRs — quais objetivos o épico impacta.
    await beat(page, testInfo, {
      screen: "okrs",
      slug: "demo3-okrs-impact",
      expectText: "OKRs",
    });

    expect(testInfo.annotations.filter((a) => a.type === "not-ported")).toEqual(
      []
    );
  });
});
