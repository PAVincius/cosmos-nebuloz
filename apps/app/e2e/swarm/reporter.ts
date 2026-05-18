/**
 * COSMOS UX Swarm — DCU Report Generator
 * Aggregates persona findings into structured Design Centrado no Usuário report
 */

import fs from "node:fs";
import path from "node:path";
import type {
  CrossPersonaIssue,
  FindingSeverity,
  PersonaId,
  PersonaReport,
  SwarmReport,
  UxFinding,
} from "./types";

const PERSONA_ROLES: Record<PersonaId, string> = {
  lpm: "Lean Portfolio Manager",
  rte: "Release Train Engineer",
  po: "Product Owner",
  sm: "Scrum Master",
  devops: "DevOps Engineer",
};

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 20,
  high: 10,
  medium: 4,
  low: 1,
  info: 0,
};

export function generateCrossPersonaIssues(
  allFindings: UxFinding[]
): CrossPersonaIssue[] {
  const byRoute: Map<string, UxFinding[]> = new Map();

  for (const f of allFindings) {
    if (f.category === "compliant") continue;
    const key = `${f.route}::${f.category}::${f.description.slice(0, 40)}`;
    const group = byRoute.get(key) ?? [];
    group.push(f);
    byRoute.set(key, group);
  }

  const issues: CrossPersonaIssue[] = [];
  for (const [, findings] of byRoute) {
    if (findings.length < 2) continue;
    const personas = [...new Set(findings.map((f) => f.persona))];
    if (personas.length < 2) continue;

    const maxSev = findings.reduce<FindingSeverity>((acc, f) => {
      return SEVERITY_WEIGHT[f.severity] > SEVERITY_WEIGHT[acc]
        ? f.severity
        : acc;
    }, "info");

    issues.push({
      findingIds: findings.map((f) => f.id),
      severity: maxSev,
      description: findings[0].description,
      affectedPersonas: personas,
      priority: SEVERITY_WEIGHT[maxSev] * personas.length,
    });
  }

  return issues.sort((a, b) => b.priority - a.priority);
}

export function calculateDcuScore(
  allFindings: UxFinding[],
  totalFlowsAttempted: number
): number {
  if (totalFlowsAttempted === 0) return 0;

  const penaltyPoints = allFindings
    .filter((f) => f.category !== "compliant")
    .reduce((acc, f) => acc + SEVERITY_WEIGHT[f.severity], 0);

  const maxPenalty = totalFlowsAttempted * SEVERITY_WEIGHT.critical;
  const score = Math.max(0, 100 - (penaltyPoints / maxPenalty) * 100);
  return Math.round(score);
}

export function buildSwarmReport(
  personaReports: PersonaReport[]
): SwarmReport {
  const allFindings = personaReports.flatMap((r) => r.findings);
  const crossPersonaIssues = generateCrossPersonaIssues(allFindings);
  const totalFlows = personaReports.reduce(
    (acc, r) => acc + r.flowsAttempted,
    0
  );
  const dcuScore = calculateDcuScore(allFindings, totalFlows);

  const criticals = allFindings.filter((f) => f.severity === "critical").length;
  const highs = allFindings.filter((f) => f.severity === "high").length;

  const summary =
    criticals > 0
      ? `${criticals} critical issue${criticals > 1 ? "s" : ""} blocking core flows. ${highs} high-priority items. DCU Score: ${dcuScore}/100.`
      : highs > 0
        ? `No critical blockers. ${highs} high-priority UX issues. DCU Score: ${dcuScore}/100.`
        : `All primary flows operational. DCU Score: ${dcuScore}/100.`;

  return {
    generatedAt: new Date().toISOString(),
    appVersion: "cosmos-nebuloz@dev",
    personas: personaReports,
    allFindings,
    crossPersonaIssues,
    dcuScore,
    summary,
  };
}

export function renderMarkdownReport(report: SwarmReport): string {
  const lines: string[] = [];
  const date = report.generatedAt.split("T")[0];

  lines.push(`# COSMOS UX Swarm Report — ${date}`);
  lines.push("");
  lines.push(`**DCU Score:** ${report.dcuScore}/100  `);
  lines.push(`**Summary:** ${report.summary}`);
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push("");

  // Cross-persona issues (highest priority)
  if (report.crossPersonaIssues.length > 0) {
    lines.push("## 🔴 Cross-Persona Issues (Multi-Role Impact)");
    lines.push("");
    lines.push(
      "These issues were independently found by multiple personas — highest fix priority."
    );
    lines.push("");
    for (const issue of report.crossPersonaIssues) {
      const personas = issue.affectedPersonas
        .map((p) => `\`${PERSONA_ROLES[p]}\``)
        .join(", ");
      lines.push(
        `- **[${issue.severity.toUpperCase()}]** ${issue.description}`
      );
      lines.push(`  - Affects: ${personas}`);
      lines.push(`  - Priority score: ${issue.priority}`);
    }
    lines.push("");
  }

  // Per-persona sections
  lines.push("## Findings by Persona");
  lines.push("");

  for (const pr of report.personas) {
    const role = PERSONA_ROLES[pr.persona];
    const duration = ((pr.completedAt - pr.startedAt) / 1000).toFixed(1);
    const flowRate = pr.flowsAttempted
      ? Math.round((pr.flowsCompleted / pr.flowsAttempted) * 100)
      : 0;

    lines.push(`### ${role} (\`${pr.persona}\`)`);
    lines.push("");
    lines.push(
      `| Metric | Value |`
    );
    lines.push(`|--------|-------|`);
    lines.push(`| Duration | ${duration}s |`);
    lines.push(
      `| Flows completed | ${pr.flowsCompleted}/${pr.flowsAttempted} (${flowRate}%) |`
    );
    lines.push(`| Critical | ${pr.criticalCount} |`);
    lines.push(`| High | ${pr.highCount} |`);
    lines.push("");

    const nonCompliant = pr.findings.filter(
      (f) => f.category !== "compliant"
    );
    if (nonCompliant.length === 0) {
      lines.push("✅ All flows completed without issues.");
    } else {
      for (const f of nonCompliant.sort(
        (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]
      )) {
        const sev = f.severity.toUpperCase().padEnd(8);
        lines.push(`- **[${sev}]** \`${f.route}\` — ${f.description}`);
        if (f.expected) lines.push(`  - Expected: ${f.expected}`);
        if (f.actual) lines.push(`  - Actual: ${f.actual}`);
        if (f.suggestion) lines.push(`  - 💡 Suggestion: ${f.suggestion}`);
        if (f.codeRef) lines.push(`  - 📁 Code: \`${f.codeRef}\``);
        if (f.story) lines.push(`  - 📋 PRD: ${f.story}`);
      }
    }
    lines.push("");
  }

  // Compliant findings
  const compliant = report.allFindings.filter(
    (f) => f.category === "compliant"
  );
  if (compliant.length > 0) {
    lines.push("## ✅ Compliant Flows");
    lines.push("");
    for (const f of compliant) {
      lines.push(
        `- \`${f.route}\` (${PERSONA_ROLES[f.persona]}): ${f.description}`
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Generated by COSMOS UX Swarm — DCU validation framework*`);

  return lines.join("\n");
}

export function saveReport(report: SwarmReport): string {
  const reportsDir = path.resolve(
    __dirname,
    "../../../../docs/ux-reports"
  );
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const date = report.generatedAt.split("T")[0];
  const mdPath = path.join(reportsDir, `${date}-swarm-report.md`);
  const jsonPath = path.join(reportsDir, `${date}-swarm-report.json`);

  fs.writeFileSync(mdPath, renderMarkdownReport(report), "utf-8");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");

  return mdPath;
}
