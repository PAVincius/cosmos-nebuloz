/**
 * RBAC policy table — pure logic, no server/auth imports (testável com Vitest).
 *
 * @see permissions.ts for `enforce()` com AuthError
 */

export type MemberRole =
  | "ADMIN"
  | "STE"
  | "RTE"
  | "PO"
  | "SM"
  | "DEV"
  | "MEMBER";

export type PolicyAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "activate"
  | "complete"
  | "resolve"
  | "vote"
  | "manage"
  | "upsert";

export type EntityType =
  | "SolutionTrain"
  | "Capability"
  | "SolutionEpic"
  | "LACE"
  | "Supplier"
  | "Epic"
  | "StrategicTheme"
  | "RoadmapItem"
  | "OKR"
  | "KeyResult"
  | "LeanBudget"
  | "Feature"
  | "WSJF"
  | "ART"
  | "PIPlan"
  | "PIObjective"
  | "Risk"
  | "Dependency"
  | "ConfidenceVote"
  | "Team"
  | "Sprint"
  | "Story"
  | "Task"
  | "Defect"
  | "Impediment"
  | "StandupEntry"
  | "SprintReview"
  | "Retrospective"
  | "Integration"
  | "AuditLog"
  | "Notification"
  | "Workspace"
  | "Member"
  | "ScheduledReport"
  | "UserDashboardLayout";

type Policy = Partial<Record<PolicyAction, readonly MemberRole[]>>;

export const POLICIES: Record<EntityType, Policy> = {
  SolutionTrain: { create: ["STE"], update: ["STE"], delete: ["STE"] },
  Capability: { create: ["STE"], update: ["STE"], delete: ["STE"] },
  SolutionEpic: { create: ["STE"], update: ["STE"], delete: ["STE"] },
  LACE: { upsert: ["STE"] },
  Supplier: {
    create: ["STE"],
    update: ["STE"],
    delete: ["STE"],
    read: ["STE", "RTE"],
  },
  Epic: {
    create: ["STE", "RTE", "PO"],
    update: ["STE", "RTE", "PO"],
    delete: ["RTE", "STE"],
  },
  StrategicTheme: {
    create: ["STE", "RTE"],
    update: ["STE", "RTE"],
    delete: ["STE", "RTE"],
  },
  RoadmapItem: {
    create: ["STE", "RTE"],
    update: ["STE", "RTE"],
    delete: ["STE", "RTE"],
  },
  OKR: {
    create: ["STE", "RTE", "PO"],
    update: ["STE", "RTE", "PO"],
    delete: ["STE", "RTE", "PO"],
  },
  KeyResult: {
    create: ["STE", "RTE", "PO"],
    update: ["STE", "RTE", "PO"],
    delete: ["STE", "RTE", "PO"],
  },
  LeanBudget: {
    create: ["RTE"],
    update: ["RTE"],
    delete: ["RTE"],
    read: ["STE", "RTE"],
  },
  Feature: {
    create: ["STE", "RTE", "PO"],
    update: ["STE", "RTE", "PO"],
    delete: ["RTE", "STE"],
  },
  WSJF: { update: ["STE", "RTE", "PO"] },
  ART: { create: [], update: ["RTE"], delete: [] },
  PIPlan: {
    create: ["RTE", "STE"],
    update: ["RTE", "STE"],
    delete: ["RTE", "STE"],
  },
  PIObjective: {
    create: ["RTE", "SM", "PO"],
    update: ["RTE", "SM", "PO"],
    delete: ["RTE", "SM", "PO"],
  },
  Risk: {
    create: ["STE", "RTE", "SM"],
    update: ["STE", "RTE", "SM"],
    delete: ["RTE"],
  },
  Dependency: {
    create: ["RTE", "PO", "SM"],
    update: ["RTE", "PO", "SM"],
    delete: ["RTE", "PO", "SM"],
  },
  ConfidenceVote: {
    manage: ["STE", "RTE"],
    vote: ["STE", "RTE", "PO", "SM", "DEV"],
  },
  Team: { create: ["RTE"], update: ["RTE", "SM"], delete: ["RTE"] },
  Sprint: {
    create: ["RTE", "SM"],
    update: ["RTE", "SM"],
    delete: ["RTE", "SM"],
    activate: ["SM", "RTE"],
    complete: ["SM", "RTE"],
  },
  Story: {
    create: ["PO", "SM", "DEV"],
    update: ["PO", "SM", "DEV"],
    delete: ["PO", "SM"],
  },
  Task: {
    create: ["SM", "DEV"],
    update: ["SM", "DEV"],
    delete: ["SM", "DEV"],
  },
  Defect: {
    update: ["SM", "DEV"],
    delete: ["SM", "DEV"],
    resolve: ["SM", "DEV"],
  },
  Impediment: { resolve: ["SM", "RTE"], delete: ["SM"] },
  StandupEntry: {},
  SprintReview: { create: ["SM", "RTE"], update: ["SM", "RTE"] },
  Retrospective: { create: ["SM"], update: ["SM"] },
  Integration: { create: [], update: [], delete: [] },
  AuditLog: { read: ["RTE", "STE"] },
  Notification: {},
  Workspace: { update: [] },
  Member: { create: [], update: [], delete: [] },
  ScheduledReport: {
    create: ["ADMIN", "STE", "RTE"],
    update: ["ADMIN", "STE", "RTE"],
    delete: ["ADMIN", "STE", "RTE"],
    read: ["ADMIN", "STE", "RTE", "PO", "SM", "DEV", "MEMBER"],
  },
  UserDashboardLayout: {
    upsert: ["ADMIN", "STE", "RTE", "PO", "SM", "DEV", "MEMBER"],
    read: ["ADMIN", "STE", "RTE", "PO", "SM", "DEV", "MEMBER"],
  },
};

export function can(
  role: MemberRole,
  entity: EntityType,
  action: PolicyAction
): boolean {
  if (role === "ADMIN") {
    return true;
  }

  const policy = POLICIES[entity];

  if (action === "read") {
    const allowed = policy.read;
    if (!allowed) {
      return true;
    }
    return allowed.includes(role);
  }

  const allowed = policy[action];
  if (!allowed) {
    return false;
  }
  return allowed.includes(role);
}
