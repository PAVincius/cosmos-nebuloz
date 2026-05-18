#!/usr/bin/env tsx
/**
 * COSMOS UX Swarm — Orchestrator
 *
 * 1. Clears previous swarm state
 * 2. Runs all 5 persona Playwright tests in parallel
 * 3. Aggregates findings (cross-persona communication)
 * 4. Generates DCU report in docs/ux-reports/
 *
 * Usage:
 *   pnpm swarm                    # full run (server must be running)
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 pnpm swarm
 *   pnpm swarm --report-only      # report only from last run
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { readAllFindings, readPersonaFindings } from "../e2e/swarm/state";
import {
  buildSwarmReport,
  renderMarkdownReport,
  saveReport,
} from "../e2e/swarm/reporter";
import type { PersonaId, PersonaReport } from "../e2e/swarm/types";

const PERSONAS: PersonaId[] = ["lpm", "rte", "po", "sm", "devops"];
const PERSONA_ROLES: Record<PersonaId, string> = {
  lpm: "Lean Portfolio Manager",
  rte: "Release Train Engineer",
  po: "Product Owner",
  sm: "Scrum Master",
  devops: "DevOps Engineer",
};

function runSwarm(): void {
  console.log("\n🐝 COSMOS UX Swarm starting...\n");
  console.log(`Personas: ${PERSONAS.join(", ")}`);
  console.log(
    `Base URL: ${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"}\n`
  );

  const swarmStart = Date.now();
  const configPath = path.resolve(__dirname, "../playwright.swarm.config.ts");

  // Use spawnSync with array args — no shell injection possible
  const result = spawnSync(
    "npx",
    ["playwright", "test", `--config=${configPath}`],
    {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env },
    }
  );

  const swarmEnd = Date.now();
  console.log(
    `\n⏱  Swarm duration: ${((swarmEnd - swarmStart) / 1000).toFixed(1)}s`
  );

  if (result.status !== 0) {
    console.log("\n⚠️  Some persona tests failed — generating report anyway\n");
  }

  generateReport();
}

function generateReport(): void {
  console.log("\n📊 Aggregating findings from all personas...\n");

  const personaReports: PersonaReport[] = PERSONAS.map((persona) => {
    const findings = readPersonaFindings(persona);
    const criticalCount = findings.filter(
      (f) => f.severity === "critical"
    ).length;
    const highCount = findings.filter((f) => f.severity === "high").length;
    const flowsAttempted = findings.length;
    const flowsCompleted = findings.filter(
      (f) => f.category === "compliant"
    ).length;

    console.log(
      `  ${PERSONA_ROLES[persona]}: ${findings.length} findings (${criticalCount} critical, ${highCount} high)`
    );

    return {
      persona,
      role: PERSONA_ROLES[persona],
      startedAt: findings[0]?.timestamp ?? Date.now(),
      completedAt: findings[findings.length - 1]?.timestamp ?? Date.now(),
      findings,
      flowsAttempted,
      flowsCompleted,
      criticalCount,
      highCount,
    };
  });

  const allFindings = readAllFindings();
  console.log(`\nTotal findings: ${allFindings.length}`);

  const report = buildSwarmReport(personaReports);
  const reportPath = saveReport(report);

  console.log("\n" + "=".repeat(60));
  console.log(renderMarkdownReport(report));
  console.log("=".repeat(60));
  console.log(`\n📁 Report saved to: ${reportPath}`);
  console.log(`🎯 DCU Score: ${report.dcuScore}/100`);

  if (report.crossPersonaIssues.length > 0) {
    console.log(
      `\n🔴 ${report.crossPersonaIssues.length} cross-persona issue(s) (multi-role impact):`
    );
    for (const issue of report.crossPersonaIssues.slice(0, 3)) {
      console.log(
        `   [${issue.severity.toUpperCase()}] ${issue.description}`
      );
      console.log(`   Affects: ${issue.affectedPersonas.join(", ")}`);
    }
  }

  console.log("\n🐝 Swarm complete.\n");

  // Exit 1 if critical issues — allows CI to block
  const criticals = allFindings.filter(
    (f) => f.severity === "critical" && f.category !== "compliant"
  );
  if (criticals.length > 0) {
    console.error(
      `\n❌ ${criticals.length} critical issue(s) — pipeline blocked.\n`
    );
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.includes("--report-only")) {
  generateReport();
} else {
  runSwarm();
}
