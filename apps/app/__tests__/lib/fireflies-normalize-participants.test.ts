// @vitest-environment node
//
// Pure unit tests for normalizeFirefliesParticipants — the "participante
// externo = participants menos workspace_users" subtraction from
// docs/compliance/consentimento-de-gravacao.md §4, and the fail-closed
// "known: false" case that §7 relies on to keep STANDING from
// auto-granting a meeting it knows nothing about.

import { describe, expect, it } from "vitest";
import { normalizeFirefliesParticipants } from "@/lib/inngest/fireflies-normalize";

describe("normalizeFirefliesParticipants", () => {
  it("known=false when participants field is missing entirely", () => {
    const result = normalizeFirefliesParticipants({ id: "m1" });
    expect(result).toEqual({ known: false, participants: [] });
  });

  it("known=false when workspace_users is missing (partial response)", () => {
    const result = normalizeFirefliesParticipants({
      id: "m1",
      participants: ["a@nebuloz.ai"],
    });
    expect(result.known).toBe(false);
    expect(result.participants).toEqual([]);
  });

  it("known=false when participants is missing but workspace_users present", () => {
    const result = normalizeFirefliesParticipants({
      id: "m1",
      workspace_users: ["a@nebuloz.ai"],
    });
    expect(result.known).toBe(false);
  });

  it("known=true, isExternal=false for a participant that is also a workspace user", () => {
    const result = normalizeFirefliesParticipants({
      id: "m1",
      participants: ["a@nebuloz.ai"],
      workspace_users: ["a@nebuloz.ai"],
    });
    expect(result.known).toBe(true);
    expect(result.participants).toEqual([
      {
        email: "a@nebuloz.ai",
        name: null,
        isOrganizer: false,
        isExternal: false,
      },
    ]);
  });

  it("isExternal=true for a participant not in workspace_users", () => {
    const result = normalizeFirefliesParticipants({
      id: "m1",
      participants: ["a@nebuloz.ai", "guest@totvs.com"],
      workspace_users: ["a@nebuloz.ai"],
    });
    expect(result.known).toBe(true);
    expect(
      result.participants.find((p) => p.email === "guest@totvs.com")
    ).toMatchObject({ isExternal: true });
    expect(
      result.participants.find((p) => p.email === "a@nebuloz.ai")
    ).toMatchObject({ isExternal: false });
  });

  it("marks the organizer via organizer_email (case-insensitive)", () => {
    const result = normalizeFirefliesParticipants({
      id: "m1",
      participants: ["RTE@nebuloz.ai"],
      workspace_users: ["rte@nebuloz.ai"],
      organizer_email: "rte@nebuloz.ai",
    });
    expect(result.participants[0]).toMatchObject({
      email: "RTE@nebuloz.ai",
      isOrganizer: true,
    });
  });

  it("fills name from meeting_attendees display name when the email matches", () => {
    const result = normalizeFirefliesParticipants({
      id: "m1",
      participants: ["guest@totvs.com"],
      workspace_users: [],
      meeting_attendees: [
        { email: "guest@totvs.com", displayName: "Guest Person" },
      ],
    });
    expect(result.participants[0]).toMatchObject({
      email: "guest@totvs.com",
      name: "Guest Person",
    });
  });

  it("de-duplicates repeated emails in participants (case-insensitive)", () => {
    const result = normalizeFirefliesParticipants({
      id: "m1",
      participants: ["a@nebuloz.ai", "A@nebuloz.ai"],
      workspace_users: ["a@nebuloz.ai"],
    });
    expect(result.participants).toHaveLength(1);
  });

  it("empty participants array with workspace_users present → known=true, no external", () => {
    const result = normalizeFirefliesParticipants({
      id: "m1",
      participants: [],
      workspace_users: [],
    });
    expect(result).toEqual({ known: true, participants: [] });
  });
});
