import { describe, expect, it } from "vitest";
import { validateRoomId } from "../../lib/collaboration/room-id";

describe("validateRoomId (AC-003, AC-004)", () => {
  it("accepts valid program-board room ID", () => {
    const result = validateRoomId("org_a:program-board:plan_123");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.orgId).toBe("org_a");
      expect(result.surface).toBe("program-board");
      expect(result.entityId).toBe("plan_123");
    }
  });

  it("accepts all valid surface values (AC-003)", () => {
    const surfaces = [
      "program-board",
      "pi-kanban",
      "sprint-board",
      "retro",
      "bpmn-canvas",
      "portfolio-kanban",
      "solution-board",
      "org-presence",
    ];

    for (const surface of surfaces) {
      const result = validateRoomId(`org-1:${surface}:entity-1`);
      expect(result.valid).toBe(true);
    }
  });

  it("rejects unknown surface (AC-003)", () => {
    const result = validateRoomId("org_a:unknown-surface:entity_1");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("Invalid surface");
    }
  });

  it("rejects room ID with wrong number of parts", () => {
    const result = validateRoomId("org_a:program-board");
    expect(result.valid).toBe(false);
  });

  it("rejects room ID with extra colons", () => {
    const result = validateRoomId("org_a:program-board:entity:extra");
    expect(result.valid).toBe(false);
  });

  it("rejects empty room ID", () => {
    const result = validateRoomId("");
    expect(result.valid).toBe(false);
  });

  it("cross-tenant check: orgId from room vs session (AC-004)", () => {
    const sessionOrgId = "org_a";
    const result = validateRoomId("org_b:program-board:plan_1");
    expect(result.valid).toBe(true);
    if (result.valid) {
      // orgId from room does NOT match session org — should be denied
      expect(result.orgId).not.toBe(sessionOrgId);
    }
  });

  it("same-tenant access: orgId from room matches session (AC-004)", () => {
    const sessionOrgId = "org_a";
    const result = validateRoomId("org_a:portfolio-kanban:org_a");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.orgId).toBe(sessionOrgId);
    }
  });

  it("returns orgId as first segment (AC-008 token scoping)", () => {
    const result = validateRoomId("tenant-xyz:sprint-board:sprint-99");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.orgId).toBe("tenant-xyz");
    }
  });
});
