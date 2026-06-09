import { describe, expect, it } from "vitest";
import {
  can,
  type EntityType,
  type MemberRole,
  POLICIES,
  type PolicyAction,
} from "../app/actions/permissions-policy";

const ALL_ROLES: MemberRole[] = [
  "ADMIN",
  "STE",
  "RTE",
  "PO",
  "SM",
  "DEV",
  "MEMBER",
];

const NON_ADMIN_ROLES = ALL_ROLES.filter((r) => r !== "ADMIN");

function policyEntries(): Array<{
  entity: EntityType;
  action: PolicyAction;
  allowed: readonly MemberRole[];
}> {
  const rows: Array<{
    entity: EntityType;
    action: PolicyAction;
    allowed: readonly MemberRole[];
  }> = [];

  for (const [entity, policy] of Object.entries(POLICIES) as [
    EntityType,
    (typeof POLICIES)[EntityType],
  ][]) {
    for (const [action, allowed] of Object.entries(policy) as [
      PolicyAction,
      readonly MemberRole[],
    ][]) {
      rows.push({ entity, action, allowed });
    }
  }

  return rows;
}

describe("RBAC matrix (POLICIES × roles)", () => {
  it.each(policyEntries())("$entity.$action — only listed roles (non-ADMIN)", ({
    entity,
    action,
    allowed,
  }) => {
    for (const role of NON_ADMIN_ROLES) {
      expect(can(role, entity, action)).toBe(allowed.includes(role));
    }
  });

  it("ADMIN bypasses every explicit policy entry", () => {
    for (const { entity, action } of policyEntries()) {
      expect(can("ADMIN", entity, action)).toBe(true);
    }
  });

  it("read without policy.read allows all non-ADMIN roles", () => {
    const unrestrictedRead: EntityType[] = [
      "Epic",
      "Feature",
      "Story",
      "Notification",
      "StandupEntry",
    ];

    for (const entity of unrestrictedRead) {
      for (const role of NON_ADMIN_ROLES) {
        expect(can(role, entity, "read")).toBe(true);
      }
    }
  });

  it("empty allow-list means ADMIN-only (non-ADMIN denied)", () => {
    const adminOnly: Array<{ entity: EntityType; action: PolicyAction }> = [
      { entity: "ART", action: "create" },
      { entity: "ART", action: "delete" },
      { entity: "Integration", action: "create" },
      { entity: "Workspace", action: "update" },
      { entity: "Member", action: "create" },
    ];

    for (const { entity, action } of adminOnly) {
      for (const role of NON_ADMIN_ROLES) {
        expect(can(role, entity, action)).toBe(false);
      }
      expect(can("ADMIN", entity, action)).toBe(true);
    }
  });

  it("undefined action on entity is denied (except read default)", () => {
    expect(can("PO", "WSJF", "delete")).toBe(false);
    expect(can("PO", "LACE", "create")).toBe(false);
    expect(can("DEV", "LeanBudget", "create")).toBe(false);
  });
});
