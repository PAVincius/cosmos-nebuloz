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

export type BeatOpts = {
  // Screen id (e.g. "kanban") or an absolute /cosmos/... path.
  screen: string;
  // Screenshot filename stem; the step number is appended automatically.
  slug: string;
  // Text expected somewhere on the loaded screen (page header, KPI label…).
  // Asserted visible when provided — makes the beat meaningful, not just "no crash".
  expectText?: string | RegExp;
};

export type CardBeatOpts = {
  // Selector for the card to click (kanban epic card, team card…).
  cardSelector: string;
  // URL the click is expected to land on.
  urlFragment: RegExp;
  slug: string;
  expectText?: string | RegExp;
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
  await page.waitForTimeout(400); // let the final layout paint before the shot
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
  expectText?: string | RegExp
) {
  await expect(
    page.getByText(ERROR_BOUNDARY),
    `Screen "${route}" hit the error boundary`
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
  if (expectText) {
    await expect(page.getByText(expectText).first()).toBeVisible();
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
  await assertHealthy(page, testInfo, route, opts.expectText);
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
  await assertHealthy(page, testInfo, page.url(), opts.expectText);
  return file;
}
