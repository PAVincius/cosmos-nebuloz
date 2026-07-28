import { expect, test } from "@playwright/test";

/**
 * E2E — Epic drill-down (Epic → Feature → Story → Task)
 *
 * Proves the four levels actually connect on the epic screen's Features tab,
 * not merely that the pages render. Fixtures come from `scripts/seed-e2e.ts`,
 * which wipes and recreates the tenant deterministically on every run — so
 * the titles/ids below are stable across seed runs, not incidental.
 *
 * The epic under test is "Portfolio Kanban & OKR Dashboard" (epicMain), with
 * two features and three stories that between them exercise all three task
 * flavours the seed guarantees:
 *   - featKanban → story "Drag-and-drop entre colunas do Kanban"
 *       → 2 tasks imported from CONNECTED providers (jira, linear)
 *   - featOKR    → story "Filtrar OKRs por horizonte (2026, H1, H2)"
 *       → 2 tasks imported from a DISCONNECTED provider (github, INACTIVE)
 *   - featOKR    → story "Criar/editar OKR via modal"
 *       → 1 native task with a schema-valid note
 *
 * The epic card on /cosmos/kanban has no accessible role of its own (it
 * wraps a draggable div, per kanban.tsx's EpicCard), so we reach it by its
 * exact title text rather than role — the same convention art-detail.spec.ts
 * uses when a route needs a real id it can only discover via the app itself.
 */
test.describe("Epic drill-down @auth", () => {
  test.use({ storageState: "./e2e/fixtures/auth-session.json" });

  const EPIC_TITLE = "Portfolio Kanban & OKR Dashboard";
  const FEAT_KANBAN_TITLE = "Portfolio Kanban Board (5 colunas SAFe)";
  const FEAT_OKR_TITLE = "OKR Dashboard com Key Results";
  const STORY_DONE_TITLE = "Drag-and-drop entre colunas do Kanban";
  const STORY_REVIEW_TITLE = "Filtrar OKRs por horizonte (2026, H1, H2)";
  const STORY_IN_PROGRESS_TITLE = "Criar/editar OKR via modal";

  async function openFeaturesTab(page: import("@playwright/test").Page) {
    await page.goto("/cosmos/kanban");
    await page.getByText(EPIC_TITLE, { exact: true }).first().click();
    await page.waitForURL(/\/cosmos\/epic\//);
    await page.getByRole("button", { name: "Features" }).click();
  }

  /** Expands a feature row (identified by its title) and returns its panel. */
  async function expandFeature(
    page: import("@playwright/test").Page,
    featureTitle: string
  ) {
    const featureRow = page
      .locator('[role="button"]')
      .filter({ hasText: featureTitle });
    await expect(featureRow).toHaveAttribute("aria-expanded", "false");
    await featureRow.click();
    await expect(featureRow).toHaveAttribute("aria-expanded", "true");
    const panelId = await featureRow.getAttribute("aria-controls");
    if (!panelId) {
      throw new Error(`Feature row "${featureTitle}" has no aria-controls`);
    }
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    return panel;
  }

  /** Expands a story row (identified by its title) and returns its panel. */
  async function expandStory(
    panel: import("@playwright/test").Locator,
    storyTitle: string
  ) {
    const storyRow = panel.getByRole("button", {
      name: new RegExp(escapeRegExp(storyTitle)),
    });
    await expect(storyRow).toHaveAttribute("aria-expanded", "false");
    await storyRow.click();
    await expect(storyRow).toHaveAttribute("aria-expanded", "true");
    const panelId = await storyRow.getAttribute("aria-controls");
    if (!panelId) {
      throw new Error(`Story row "${storyTitle}" has no aria-controls`);
    }
    const storyPanel = panel.page().locator(`#${panelId}`);
    await expect(storyPanel).toBeVisible();
    return storyPanel;
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  test("expanding a feature reveals its stories with a visible AC line, and expanding a story reveals a task imported from a connected provider", async ({
    page,
  }) => {
    await openFeaturesTab(page);

    const featurePanel = await expandFeature(page, FEAT_KANBAN_TITLE);
    const storyRow = featurePanel.getByRole("button", {
      name: new RegExp(escapeRegExp(STORY_DONE_TITLE)),
    });
    await expect(storyRow).toBeVisible();
    await expect(storyRow).toContainText("AC: - DnD funciona em mouse e touch");

    const storyPanel = await expandStory(featurePanel, STORY_DONE_TITLE);

    // Task imported from a CONNECTED provider (jira, ACTIVE in the seed):
    // shows its external ref and opens a read-only modal — no "Conectar" path.
    const jiraTaskRow = storyPanel
      .locator("div")
      .filter({ hasText: "[Jira] Corrigir paginação do board de riscos" })
      .last();
    await expect(
      jiraTaskRow.getByRole("button", { name: /COS-142/ })
    ).toBeVisible();
    await expect(
      jiraTaskRow.getByRole("button", { name: /não conectado/i })
    ).toHaveCount(0);
  });

  test("a task imported from a disconnected provider shows the Conectar path and it navigates to Integrations", async ({
    page,
  }) => {
    await openFeaturesTab(page);

    const featurePanel = await expandFeature(page, FEAT_OKR_TITLE);
    const storyPanel = await expandStory(featurePanel, STORY_REVIEW_TITLE);

    const githubTaskRow = storyPanel
      .locator("div")
      .filter({
        hasText: "[GitHub] Corrigir flake no pipeline de E2E",
      })
      .last();
    const connectButton = githubTaskRow.getByRole("button", {
      name: "GitHub não conectado · Conectar",
    });
    await expect(connectButton).toBeVisible();
    // A connected-provider ref button must not also be offered on this row.
    await expect(
      githubTaskRow.getByRole("button", { name: "Abrir nota" })
    ).toHaveCount(0);

    await connectButton.click();
    await page.waitForURL(/\/cosmos\/integrations/);
    await expect(
      page.getByRole("heading", { name: "Integrações" })
    ).toBeVisible();
  });

  test("a native task offers Abrir nota, and creating a new native task adds a row whose note modal opens", async ({
    page,
  }) => {
    await openFeaturesTab(page);

    const featurePanel = await expandFeature(page, FEAT_OKR_TITLE);
    const storyPanel = await expandStory(featurePanel, STORY_IN_PROGRESS_TITLE);

    // Seeded native task already proves the "native" flavour on its own.
    const seededNativeRow = storyPanel
      .locator("div")
      .filter({
        hasText: "Detalhar critérios de aceite da task nativa",
      })
      .last();
    await expect(
      seededNativeRow.getByRole("button", { name: "Abrir nota" })
    ).toBeVisible();

    // Creating a new native task adds a distinct row — this story has no
    // other task titled exactly "Nova task", so the row is unambiguous.
    await storyPanel
      .getByRole("button", { name: "+ Nova task nativa" })
      .click();
    const newTaskRow = storyPanel
      .locator("div")
      .filter({ has: page.getByText("Nova task", { exact: true }) })
      .last();
    await expect(newTaskRow).toBeVisible();

    await newTaskRow.getByRole("button", { name: "Abrir nota" }).click();
    await expect(
      page.getByText(
        "Criada e mantida dentro da plataforma — sem dependência de ferramenta externa"
      )
    ).toBeVisible();
    await expect(page.getByLabel("Título da task")).toHaveValue("Nova task");
  });

  test("the ↗ button navigates to the feature screen without toggling the feature row first", async ({
    page,
  }) => {
    await openFeaturesTab(page);

    const featureRow = page
      .locator('[role="button"]')
      .filter({ hasText: FEAT_KANBAN_TITLE });
    await expect(featureRow).toHaveAttribute("aria-expanded", "false");

    await featureRow
      .getByRole("button", { name: `Abrir feature ${FEAT_KANBAN_TITLE}` })
      .click();

    // The guarantee here is stopPropagation() on the ↗ button in
    // feature-table.tsx, not timing: it stops the click from ever reaching
    // the row's own onClick, so toggle() never runs. If stopPropagation were
    // missing, this would fail regardless of how long we waited.
    await expect(featureRow).toHaveAttribute("aria-expanded", "false");

    await page.waitForURL(/\/cosmos\/feature\//);
    await expect(
      page.getByRole("heading", { name: FEAT_KANBAN_TITLE })
    ).toBeVisible();
  });
});
