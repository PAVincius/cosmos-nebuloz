// Story-038: RBAC permission matrix — maps MemberRole to fine-grained permissions
// MemberRole values: ADMIN | STE | RTE | SM | PO | DEV | MEMBER

export type Permission =
  | "epic:read"
  | "epic:write"
  | "epic:transition"
  | "feature:read"
  | "feature:write"
  | "story:read"
  | "story:write"
  | "sprint:read"
  | "sprint:manage"
  | "standup:write"
  | "art:manage"
  | "pi-plan:read"
  | "pi-plan:manage"
  | "governance:approve"
  | "budget:read"
  | "budget:write"
  | "member:read"
  | "analytics:read"
  | "reporting:export"
  | "impediment:manage"
  | "retro:manage"
  | "wsjf:write"
  | "*";

export type SaFeRole = "ADMIN" | "STE" | "RTE" | "PO" | "SM" | "DEV" | "MEMBER";

const ADMIN_PERMISSIONS: Permission[] = ["*"];

const RTE_PERMISSIONS: Permission[] = [
  "epic:read",
  "epic:write",
  "epic:transition",
  "feature:read",
  "feature:write",
  "art:manage",
  "pi-plan:manage",
  "governance:approve",
  "budget:read",
  "budget:write",
  "member:read",
  "analytics:read",
  "reporting:export",
  "story:read",
  "sprint:read",
  "impediment:manage",
];

const PO_PERMISSIONS: Permission[] = [
  "epic:read",
  "epic:write",
  "feature:read",
  "feature:write",
  "story:read",
  "story:write",
  "pi-plan:read",
  "wsjf:write",
  "analytics:read",
  "sprint:read",
];

const SM_PERMISSIONS: Permission[] = [
  "feature:read",
  "feature:write",
  "story:read",
  "story:write",
  "sprint:manage",
  "sprint:read",
  "impediment:manage",
  "retro:manage",
  "analytics:read",
  "standup:write",
];

const DEV_PERMISSIONS: Permission[] = [
  "feature:read",
  "story:read",
  "story:write",
  "sprint:read",
  "standup:write",
];

const MEMBER_PERMISSIONS: Permission[] = [
  "epic:read",
  "feature:read",
  "sprint:read",
  "analytics:read",
];

export const PERMISSION_MATRIX: Record<SaFeRole, Permission[]> = {
  ADMIN: ADMIN_PERMISSIONS,
  STE: RTE_PERMISSIONS,
  RTE: RTE_PERMISSIONS,
  PO: PO_PERMISSIONS,
  SM: SM_PERMISSIONS,
  DEV: DEV_PERMISSIONS,
  MEMBER: MEMBER_PERMISSIONS,
};

export function hasPermission(role: SaFeRole, permission: Permission): boolean {
  const perms = PERMISSION_MATRIX[role];
  return perms.includes("*") || perms.includes(permission);
}

export function hasPermissions(
  role: SaFeRole,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}
