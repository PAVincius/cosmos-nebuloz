import { expect, test } from "@playwright/test";
import { beat, openFirstCard, resetBeats } from "./_utils";

// Usability Lab — Demo 2: "Sprint execution unificada" (SM + Dev).
// Walks the "Cena 2 (com Cosmos)" beats: the SM opens a single team console
// (board + impediments + standup + retro), velocity is captured automatically
// from completed stories, and retro actions are tracked screen-to-screen
// instead of dying on a forgotten board.

test.describe("Lab · Demo 2 — Sprint execution (SM→Dev)", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("Sprint tour: teams → team console → velocity → measure & grow", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    resetBeats();

    // 1. SM abre a lista de Times.
    await beat(page, testInfo, {
      screen: "teams",
      slug: "demo2-teams",
      expectText: "Times",
      expectData: ["Team Nebula"],
    });

    // 2. Abre o Team Sprint console (board, impediments, standup, retro num só lugar).
    await openFirstCard(page, testInfo, {
      cardSelector: "button.lift",
      urlFragment: /\/cosmos\/team\//,
      slug: "demo2-team-console",
      expectData: ["Team Nebula", "Sprint 1 — Foundation"],
    });

    // 3. Velocity capturada automaticamente das stories concluídas.
    await beat(page, testInfo, {
      screen: "velocity",
      slug: "demo2-velocity",
      expectText: "Velocity",
      expectData: ["Team Nebula"],
    });

    // 4. Measure & Grow — ações de retro rastreadas ciclo a ciclo.
    await beat(page, testInfo, {
      screen: "measure",
      slug: "demo2-measure-grow",
      expectText: "Measure & Grow",
      expectData: [/competências/],
    });

    expect(testInfo.annotations.filter((a) => a.type === "not-ported")).toEqual(
      []
    );
  });
});
