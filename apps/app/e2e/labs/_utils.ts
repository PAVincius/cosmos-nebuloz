import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

// Usability-lab harness. Each "beat" of a demo tour navigates a real Cosmos
// screen (/cosmos/<id>), waits for it to settle, asserts it did not crash or
// render as a not-yet-ported placeholder, and captures a named screenshot.
// The screenshots (one per tour step) are the deliverable a reviewer walks
// through; assertions turn a silent broken screen into a failing step.

export const SHOTS_DIR = path.resolve(__dirname, "screenshots");

const ERROR_BOUNDARY = "Oops, something went wrong";
const NOT_PORTED = "Tela ainda não portada";
// Screens render this when their server action rejects — most commonly an
// expired session after a reseed. Without this check a beat still "passes" on
// the page header alone while every panel below it is an error state.
const LOAD_FAILED = /Não foi possível carregar/i;

export type BeatOpts = {
  // Screen id (e.g. "kanban") or an absolute /cosmos/... path.
  screen: string;
  // Screenshot filename stem; the step number is appended automatically.
  slug: string;
  // Identity check — the page header. Proves we landed on the right screen.
  expectText?: string | RegExp;
  // Proof the screen rendered actual records, not just its chrome. Headers,
  // KPI labels and section titles render even when every query returns zero
  // rows, so a beat asserting only expectText photographs an empty screen and
  // still passes. These come from seeded content (a team name, an epic title,
  // an objective) and are the difference between "the route loaded" and "the
  // tour has something to show".
  expectData?: (string | RegExp)[];
  // The inverse proof, for screens whose populated rows have no predictable
  // text to match: assert the screen's own "nothing here" copy is absent.
  forbidText?: (string | RegExp)[];
};

export type CardBeatOpts = {
  // Selector for the card to click (kanban epic card, team card…).
  cardSelector: string;
  // URL the click is expected to land on.
  urlFragment: RegExp;
  slug: string;
  expectText?: string | RegExp;
  expectData?: (string | RegExp)[];
};

let counter = 0;

// Reset the per-test step counter so filenames are stable across a spec.
export function resetBeats() {
  counter = 0;
}

async function bestEffort(wait: Promise<unknown>) {
  try {
    await wait;
  } catch {
    // Intentionally swallowed: these waits are hints, not requirements. A
    // screen that never settles is itself a finding, and the screenshot taken
    // right after records it far better than a thrown timeout would.
  }
}

async function settle(page: Page) {
  // Not networkidle: Next.js dev keeps an HMR websocket open, so the page is
  // never "idle" and the wait would just burn its full timeout every beat.
  await bestEffort(page.waitForLoadState("domcontentloaded"));
  // Screens render a "Carregando…" state while their server action resolves;
  // wait for it to clear so the shot shows real data, not a spinner.
  await bestEffort(
    page
      .getByText(/Carregando/i)
      .first()
      .waitFor({ state: "detached", timeout: 8000 })
  );
  // Past KpiCard's count-up animation (900ms + its 150ms fallback timer).
  // Shooting earlier captures eased mid-flight numbers — a 13 SP KPI photographs
  // as 11 — which is worse than useless in a screenshot meant for review.
  await page.waitForTimeout(1200);
}

async function shoot(page: Page, testInfo: TestInfo, slug: string) {
  counter += 1;
  const name = `${slug}-${String(counter).padStart(2, "0")}`;
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
  return file;
}

async function assertHealthy(
  page: Page,
  testInfo: TestInfo,
  route: string,
  opts: {
    expectText?: string | RegExp;
    expectData?: (string | RegExp)[];
    forbidText?: (string | RegExp)[];
  }
) {
  await expect(
    page.getByText(ERROR_BOUNDARY),
    `Screen "${route}" hit the error boundary`
  ).toHaveCount(0);

  await expect(
    page.getByText(LOAD_FAILED),
    `Screen "${route}" rendered a load-failure state — usually an expired auth fixture (re-run with AUTH_TEST=1) or a failing server action`
  ).toHaveCount(0);

  const notPorted = await page
    .getByText(NOT_PORTED)
    .isVisible()
    .catch(() => false);

  if (notPorted) {
    testInfo.annotations.push({
      type: "not-ported",
      description: `${route} renders the "Tela ainda não portada" placeholder`,
    });
    return;
  }
  if (opts.expectText) {
    await expect(page.getByText(opts.expectText).first()).toBeVisible();
  }

  for (const proof of opts.expectData ?? []) {
    await expect(
      page.getByText(proof).first(),
      `Screen "${route}" loaded but shows no seeded content matching ${proof} — the tour beat would be photographed empty`
    ).toBeVisible();
  }

  for (const empty of opts.forbidText ?? []) {
    await expect(
      page.getByText(empty),
      `Screen "${route}" still shows its empty-state copy ${empty} — nothing seeded for this beat`
    ).toHaveCount(0);
  }
}

// Navigate one tour beat and capture it. A not-yet-ported screen is recorded
// as an annotation (visible in the report) rather than a hard failure, so the
// tour still produces its full set of shots.
export async function beat(page: Page, testInfo: TestInfo, opts: BeatOpts) {
  const route = opts.screen.startsWith("/")
    ? opts.screen
    : `/cosmos/${opts.screen}`;
  await page.goto(route);
  await settle(page);

  // Capture first, assert second: the screenshot is the deliverable and must
  // exist even when a screen crashed or stayed on its loading state.
  const file = await shoot(page, testInfo, opts.slug);
  await assertHealthy(page, testInfo, route, opts);
  return file;
}

// Open the first card on the current screen (kanban epic card / team card) to
// reach a detail screen, then capture it. Used for the demo beats that drill
// into an epic or a team from a board.
export async function openFirstCard(
  page: Page,
  testInfo: TestInfo,
  opts: CardBeatOpts
) {
  const card = page.locator(opts.cardSelector).first();
  // Generous: a cold Next dev route compile plus the board's data fetch can
  // outlast a short timeout on the first hit of a run.
  await card.waitFor({ state: "visible", timeout: 30_000 });
  await card.click();
  await page.waitForURL(opts.urlFragment, { timeout: 15_000 });
  await settle(page);

  const file = await shoot(page, testInfo, opts.slug);
  await assertHealthy(page, testInfo, page.url(), opts);
  return file;
}
