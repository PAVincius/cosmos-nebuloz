/**
 * COSMOS UX Swarm — Shared Types
 * DCU (Design Centrado no Usuário) validation framework
 */

export type PersonaId = "lpm" | "rte" | "po" | "sm" | "devops";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type FindingCategory =
  | "route-missing"      // PRD specifies route that doesn't exist
  | "ui-error"           // JS crash, component throws
  | "design-violation"   // Diverge from DESIGN.md tokens
  | "flow-blocked"       // User cannot complete their primary task
  | "ux-friction"        // Task possible but slow/confusing
  | "api-error"          // Endpoint returns unexpected status
  | "accessibility"      // Missing ARIA, contrast, focus
  | "performance"        // Page load > 3s, action > 1s
  | "compliant";         // Everything correct — positive finding

export type UxFinding = {
  id: string;                 // unique: `${persona}-${timestamp}-${seq}`
  persona: PersonaId;
  severity: FindingSeverity;
  category: FindingCategory;
  route: string;              // URL where finding occurred
  component?: string;         // Component/file reference from DESIGN.md
  story?: string;             // PRD user story this maps to
  description: string;
  expected?: string;          // What PRD/DESIGN.md says should happen
  actual?: string;            // What actually happened
  suggestion?: string;        // Concrete fix or improvement
  codeRef?: string;           // File path suggestion for fix
  timestamp: number;
  screenshot?: string;        // Path to screenshot artifact
};

export type PersonaReport = {
  persona: PersonaId;
  role: string;               // Human-readable role name
  startedAt: number;
  completedAt: number;
  findings: UxFinding[];
  flowsAttempted: number;
  flowsCompleted: number;
  criticalCount: number;
  highCount: number;
};

export type SwarmReport = {
  generatedAt: string;
  appVersion: string;
  personas: PersonaReport[];
  allFindings: UxFinding[];
  crossPersonaIssues: CrossPersonaIssue[];
  dcuScore: number;           // 0-100 (100 = all flows work per PRD)
  summary: string;
};

export type CrossPersonaIssue = {
  findingIds: string[];       // Multiple personas hit same issue
  severity: FindingSeverity;
  description: string;
  affectedPersonas: PersonaId[];
  priority: number;           // Higher = fix first
};
