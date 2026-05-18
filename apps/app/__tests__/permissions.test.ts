import { describe, expect, it } from "vitest";
import { can } from "../app/actions/permissions-policy";

describe("can — WSJF", () => {
  it("allows PO to update WSJF", () => {
    expect(can("PO", "WSJF", "update")).toBe(true);
  });

  it("denies DEV from updating WSJF", () => {
    expect(can("DEV", "WSJF", "update")).toBe(false);
  });

  it("allows ADMIN bypass", () => {
    expect(can("ADMIN", "WSJF", "update")).toBe(true);
  });
});

describe("can — Epic", () => {
  it("allows RTE to delete epic", () => {
    expect(can("RTE", "Epic", "delete")).toBe(true);
  });

  it("denies PO from deleting epic", () => {
    expect(can("PO", "Epic", "delete")).toBe(false);
  });
});

describe("can — read defaults", () => {
  it("allows unrestricted read on Epic for MEMBER", () => {
    expect(can("MEMBER", "Epic", "read")).toBe(true);
  });

  it("restricts AuditLog read to STE and RTE", () => {
    expect(can("STE", "AuditLog", "read")).toBe(true);
    expect(can("PO", "AuditLog", "read")).toBe(false);
  });
});

describe("can — ADMIN-only entities", () => {
  it("denies RTE from creating Integration", () => {
    expect(can("RTE", "Integration", "create")).toBe(false);
  });

  it("allows ADMIN to create Integration", () => {
    expect(can("ADMIN", "Integration", "create")).toBe(true);
  });
});
