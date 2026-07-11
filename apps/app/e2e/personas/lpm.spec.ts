/**
 * COSMOS UX Swarm — Lean Portfolio Manager Persona
 *
 * Simulates a Lean Portfolio Manager navigating portfolio-level features.
 * PRD User Stories:
 *   - Criar e mover Épicos em Portfolio Kanban (drag-drop + real-time sync)
 *   - Vincular Épicos aos OKRs (multi-select search)
 *   - Visualizar WSJF scores e priorizar backlog
 *
 * Communicates findings to: e2e/fixtures/swarm/findings-lpm.json
 */

import { expect, test } from "@playwright/test";
import { makeFindingId, writeFinding } from "../swarm/state";
import type { UxFinding } from "../swarm/types";

const PERSONA = "lpm" as const;

function finding(
  partial: Omit<UxFinding, "id" | "persona" | "timestamp">
): UxFinding {
  return {
    ...partial,
    id: makeFindingId(PERSONA),
    persona: PERSONA,
    timestamp: Date.now(),
  };
}

test.describe("LPM — Portfolio Kanban", () => {
  test("portfolio route exists and does not return 500", async ({ page }) => {
    const response = await page.goto("/portfolio");
    const status = response?.status() ?? 0;

    if (status >= 500) {
      writeFinding(
        finding({
          severity: "critical",
          category: "ui-error",
          route: "/portfolio",
          story:
            "Como LPM, quero criar e mover Épicos em um Kanban colaborativo.",
          description: `Portfolio page server error — HTTP ${status}`,
          actual: `Status ${status}`,
          expected: "HTTP 200 or 302 to sign-in",
          suggestion:
            "Check getPortfolioEpics server action and requireTenantSession",
          codeRef: "apps/app/app/(authenticated)/portfolio/page.tsx",
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/portfolio",
          description: "Portfolio route returns non-500 status",
        })
      );
    }

    expect(status).toBeLessThan(500);
  });

  test("no critical JS errors on portfolio page load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.route("**/api/collaboration/auth**", (route) => route.abort());
    await page.goto("/portfolio");
    await page.waitForTimeout(2000);

    const critical = errors.filter(
      (e) =>
        !(
          e.includes("Liveblocks") ||
          e.includes("NEXT_NOT_FOUND") ||
          e.includes("ResizeObserver")
        )
    );

    if (critical.length > 0) {
      writeFinding(
        finding({
          severity: "critical",
          category: "ui-error",
          route: "/portfolio",
          story:
            "Como LPM, quero criar e mover Épicos em um Kanban colaborativo.",
          description: `JS crash on portfolio load: ${critical[0]}`,
          actual: critical.join("; "),
          suggestion:
            "Fix JavaScript error before users can interact with Kanban",
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/portfolio",
          description: "No critical JS errors on portfolio page load",
        })
      );
    }

    expect(critical).toHaveLength(0);
  });

  test("portfolio/dashboard route accessible (new route)", async ({ page }) => {
    const response = await page.goto("/portfolio");
    const status = response?.status() ?? 0;

    if (status === 404) {
      writeFinding(
        finding({
          severity: "medium",
          category: "route-missing",
          route: "/portfolio",
          story:
            "Como LPM, quero criar e mover Épicos em um Kanban colaborativo.",
          description: "Portfolio Kanban route not found (404)",
          expected: "Route /portfolio should render Portfolio Kanban",
          actual: "HTTP 404",
          suggestion:
            "Route exists in codebase but may need sidebar navigation link added",
          codeRef: "apps/app/app/(authenticated)/portfolio/page.tsx",
        })
      );
    }

    expect(status).not.toBe(500);
  });

  test("portfolio page has Kanban column headers", async ({ page }) => {
    await page.route("**/api/collaboration/auth**", (route) => route.abort());
    const response = await page.goto("/portfolio");

    const finalUrl = page.url();
    const isOnPortfolio = !finalUrl.includes("sign-in");

    if (response?.status() === 200 && isOnPortfolio) {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500);

      const expectedColumns = [
        "Funnel",
        "Reviewing",
        "Analyzing",
        "Portfolio Backlog",
        "Implementing",
        "Done",
      ];

      for (const col of expectedColumns) {
        const el = page.locator(`text=${col}`).first();
        const visible = await el.isVisible().catch(() => false);

        if (!visible) {
          writeFinding(
            finding({
              severity: "high",
              category: "flow-blocked",
              route: "/portfolio",
              story:
                "Como LPM, quero criar e mover Épicos em um Kanban colaborativo.",
              description: `SAFe Kanban column "${col}" not visible`,
              expected: `Column header "${col}" must be visible per SAFe Portfolio Kanban spec`,
              actual: "Column not found in DOM",
              suggestion:
                "Check KanbanColumn component — column may not render if data/status mapping is wrong",
              codeRef:
                "apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-board.tsx",
            })
          );
        }
      }
    } else if (!isOnPortfolio) {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/portfolio",
          description:
            "Portfolio redirects unauthenticated users to sign-in (auth required — rerun with AUTH_TEST=true)",
        })
      );
    }
  });

  test("WSJF scores visible in feature/epic cards @auth", async ({ page }) => {
    test.skip(
      !process.env.AUTH_TEST,
      "Auth tests disabled (set AUTH_TEST=true)"
    );
    await page.goto("/portfolio");
    await page.waitForLoadState("networkidle");

    const wsjfBadge = page.locator('[class*="wsjf"], [data-wsjf]').first();
    const visible = await wsjfBadge.isVisible().catch(() => false);

    if (!visible) {
      writeFinding(
        finding({
          severity: "medium",
          category: "ux-friction",
          route: "/portfolio",
          story: "Como LPM, quero priorizar backlog baseado em WSJF.",
          description: "WSJF score badge not visible on Epic cards",
          expected: "WSJF score shown on each Epic card",
          actual: "No WSJF badge found",
          suggestion:
            "Ensure wsjfScore > 0 for seeded data, or show 0.0 with a muted style",
          codeRef:
            "apps/app/app/(authenticated)/dashboard/portfolio/components/kanban-card.tsx",
        })
      );
    }
  });

  test("DESIGN.md — portfolio uses Linear dark surface tokens", async ({
    page,
  }) => {
    await page.route("**/api/collaboration/auth**", (route) => route.abort());
    await page.goto("/portfolio");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    const bodyBg = await page.evaluate(() => {
      const body = document.body;
      return getComputedStyle(body).backgroundColor;
    });

    const isLightWhite =
      bodyBg === "rgb(255, 255, 255)" || bodyBg === "rgba(0, 0, 0, 0)";

    if (isLightWhite) {
      writeFinding(
        finding({
          severity: "low",
          category: "design-violation",
          route: "/portfolio",
          description:
            "Page background is white — should be Linear dark canvas in dark mode",
          expected:
            "Dark mode active: background ~oklch(0.09 0.003 280) ≈ #0f0f10",
          actual: `Computed background: ${bodyBg}`,
          suggestion:
            "Check that dark class is applied to <html> element by ThemeProvider",
          codeRef: "packages/design-system/styles/globals.css",
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/portfolio",
          description:
            "Page background uses non-white color (dark mode active)",
        })
      );
    }
  });
});
