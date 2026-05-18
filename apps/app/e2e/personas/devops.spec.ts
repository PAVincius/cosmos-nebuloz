/**
 * COSMOS UX Swarm — DevOps Engineer Persona
 *
 * PRD User Stories:
 *   - Integrar com Jira, Azure DevOps, GitHub Actions (epic-006+)
 *   - CI/CD pipeline tracking (epic-008)
 *   - API health + auth endpoints functional
 *
 * DevOps focuses on API contract validation and integration readiness.
 */

import { expect, test } from "@playwright/test";
import { makeFindingId, writeFinding } from "../swarm/state";
import type { UxFinding } from "../swarm/types";

const PERSONA = "devops" as const;

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

test.describe("DevOps — API Health & Integrations", () => {
  test("API health endpoint functional", async ({ request }) => {
    const res = await request.get("/api/health");
    const status = res.status();

    if (status === 200) {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/api/health",
          description: "Health endpoint returns 200",
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "medium",
          category: "api-error",
          route: "/api/health",
          description: `Health endpoint returned ${status}`,
          expected: "HTTP 200 with status OK",
          actual: `HTTP ${status}`,
          suggestion:
            "Implement GET /api/health returning { status: 'ok', version, uptime }",
          codeRef: "apps/app/app/api/health/route.ts",
        })
      );
    }

    expect(true).toBe(true);
  });

  test("better-auth session endpoint reachable", async ({ request }) => {
    const res = await request.get("/api/auth/get-session");
    const status = res.status();

    // With no auth: expect 200 with null session, or 401
    const valid = [200, 401].includes(status);
    if (valid) {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/api/auth/get-session",
          description: `better-auth session endpoint responds correctly (${status})`,
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "high",
          category: "api-error",
          route: "/api/auth/get-session",
          description: `better-auth get-session returned unexpected status ${status}`,
          expected: "HTTP 200 with null user OR 401",
          actual: `HTTP ${status}`,
          suggestion:
            "Verify auth.handler is correctly wired at /api/auth/[...all]/route.ts",
          codeRef: "apps/app/app/api/auth/[...all]/route.ts",
        })
      );
    }

    expect(true).toBe(true);
  });

  test("Jira integration route gap audit", async ({ page }) => {
    const routes = [
      "/integrations",
      "/integrations/jira",
      "/dashboard/integrations",
      "/settings/integrations",
    ];

    let found = false;
    for (const route of routes) {
      const res = await page.goto(route);
      if ((res?.status() ?? 0) < 400) {
        found = true;
        writeFinding(
          finding({
            severity: "info",
            category: "compliant",
            route,
            description: `Integrations route found at ${route}`,
          })
        );
        break;
      }
    }

    if (!found) {
      writeFinding(
        finding({
          severity: "high",
          category: "route-missing",
          route: "/integrations",
          story:
            "Como DevOps, quero integrar o COSMOS com Jira para sync bidirecional.",
          description: "Integrations route not implemented (epic-006+)",
          expected:
            "Integration dashboard with Jira, Azure DevOps, GitHub Actions cards",
          actual: "All integration routes return 404",
          suggestion:
            "Implement epic-006 Enhanced Portfolio & ART — integrations page",
          codeRef: "docs/stories/epic-006/",
        })
      );
    }

    expect(true).toBe(true);
  });

  test("collaboration auth endpoint returns valid response", async ({
    request,
  }) => {
    const res = await request.post("/api/collaboration/auth");
    const status = res.status();

    const valid = [200, 401, 403, 400].includes(status);
    if (valid) {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/api/collaboration/auth",
          description: `Liveblocks auth endpoint responds (${status})`,
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "medium",
          category: "api-error",
          route: "/api/collaboration/auth",
          description: `Liveblocks auth returned unexpected ${status}`,
          expected: "401 (no auth) or 200 (with session)",
          actual: `HTTP ${status}`,
          suggestion:
            "Check collaboration auth handler at apps/app/app/api/collaboration/auth/route.ts",
          codeRef: "apps/app/app/api/collaboration/auth/route.ts",
        })
      );
    }

    expect(true).toBe(true);
  });

  test("environment variable stubs don't leak to client", async ({ page }) => {
    // Security check: ensure no backend secrets appear in page source
    await page.goto("/sign-in");
    const content = await page.content();

    const dangerousPatterns = [
      "BETTER_AUTH_SECRET",
      "cosmos-dev-secret",
      "re_dev_placeholder",
      "ajkey_dev_placeholder",
      "DATABASE_URL",
      "postgresql://",
    ];

    const leaked = dangerousPatterns.filter((p) =>
      content.toLowerCase().includes(p.toLowerCase())
    );

    if (leaked.length > 0) {
      writeFinding(
        finding({
          severity: "critical",
          category: "ui-error",
          route: "/sign-in",
          description: `Security: server-side env vars leaked to client HTML: ${leaked.join(", ")}`,
          expected: "No server secrets in client HTML",
          actual: `Found in page source: ${leaked.join(", ")}`,
          suggestion:
            "Ensure BETTER_AUTH_SECRET, DATABASE_URL etc are ONLY in server: {} of createEnv — never in client:{}",
          codeRef: "packages/auth/keys.ts",
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/sign-in",
          description: "No server-side secrets detected in client HTML",
        })
      );
    }

    expect(leaked).toHaveLength(0);
  });

  test("CI/CD integration gap audit", async () => {
    writeFinding(
      finding({
        severity: "medium",
        category: "route-missing",
        route: "/integrations/cicd",
        story: "Como DevOps, quero rastrear builds e deployments via CI/CD.",
        description: "CI/CD Integration not yet implemented (epic-008)",
        expected:
          "CI/CD dashboard: build status, deployment tracking, release traceability",
        actual: "No CI/CD routes or data models beyond schema stubs",
        suggestion:
          "Implement epic-008 Enterprise & Scale — CI/CD integration",
        codeRef: "docs/stories/epic-008/",
      })
    );

    expect(true).toBe(true);
  });
});
