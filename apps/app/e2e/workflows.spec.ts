import { expect, test } from "@playwright/test";

/**
 * E2E — Workflows list
 *
 * Smoke test for /workflows. The BPMN canvas detail page is already
 * covered by bpmn-canvas.spec.ts. Does NOT click the activate/deactivate
 * toggle — it calls a real server action (activateBpmnDefinition).
 */
test.describe("Workflows @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  test("renders header and workflow rows", async ({ page }) => {
    await page.goto("/cosmos/workflows");
    await expect(page.locator("h1")).toContainText(/Workflows/i, {
      timeout: 15_000,
    });
  });
});
