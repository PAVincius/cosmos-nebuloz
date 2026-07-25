import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

// ── Hoist mocks before any imports ──────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  personSkillProfileUpsert: vi.fn(),
  personSkillProfileUpdate: vi.fn(),
  personSkillProfileFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    personSkillProfile: {
      upsert: mocks.personSkillProfileUpsert,
      update: mocks.personSkillProfileUpdate,
      findMany: mocks.personSkillProfileFindMany,
    },
  },
}));

import {
  listPersonSkillProfiles,
  upsertPersonSkillProfile,
  verifyPersonSkillProfile,
} from "@/app/actions/flow-intelligence/person-skills";

const SKILL_LEVEL_RX = /skillLevel/;
const PROFICIENCY_RX = /proficiency/;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
});

describe("upsertPersonSkillProfile", () => {
  it("rejects skillLevel outside 1-5", async () => {
    const result = await upsertPersonSkillProfile({
      userId: "u1",
      competency: "TEAM_TECHNICAL_AGILITY",
      skillLevel: 6,
      proficiency: 80,
    });
    expect(result.ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).error).toMatch(SKILL_LEVEL_RX);
  });

  it("rejects skillLevel below 1", async () => {
    const result = await upsertPersonSkillProfile({
      userId: "u1",
      competency: "TEAM_TECHNICAL_AGILITY",
      skillLevel: 0,
      proficiency: 80,
    });
    expect(result.ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).error).toMatch(SKILL_LEVEL_RX);
  });

  it("rejects proficiency outside 0-100", async () => {
    const result = await upsertPersonSkillProfile({
      userId: "u1",
      competency: "TEAM_TECHNICAL_AGILITY",
      skillLevel: 3,
      proficiency: 110,
    });
    expect(result.ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).error).toMatch(PROFICIENCY_RX);
  });

  it("rejects proficiency below 0", async () => {
    const result = await upsertPersonSkillProfile({
      userId: "u1",
      competency: "TEAM_TECHNICAL_AGILITY",
      skillLevel: 3,
      proficiency: -1,
    });
    expect(result.ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).error).toMatch(PROFICIENCY_RX);
  });

  it("calls upsert with correct data when isDraft=true", async () => {
    mocks.personSkillProfileUpsert.mockResolvedValue({ id: "p1" });
    const result = await upsertPersonSkillProfile({
      userId: "u1",
      competency: "TEAM_TECHNICAL_AGILITY",
      skillLevel: 3,
      proficiency: 60,
      notes: "Test notes",
      isDraft: true,
    });
    expect(result.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).data?.id).toBe("p1");

    const call = mocks.personSkillProfileUpsert.mock.calls[0][0];
    expect(call.create.userId).toBe("u1");
    expect(call.create.competency).toBe("TEAM_TECHNICAL_AGILITY");
    expect(call.create.skillLevel).toBe(3);
    expect(call.create.proficiency).toBe(60);
    expect(call.create.notes).toBe("Test notes");
    expect(call.create.isDraft).toBe(true);
    expect(call.create.isVerified).toBe(false);
  });

  it("calls upsert with isDraft=false by default", async () => {
    mocks.personSkillProfileUpsert.mockResolvedValue({ id: "p2" });
    await upsertPersonSkillProfile({
      userId: "u2",
      competency: "AGILE_PRODUCT_DELIVERY",
      skillLevel: 4,
      proficiency: 85,
    });

    const call = mocks.personSkillProfileUpsert.mock.calls[0][0];
    expect(call.create.isDraft).toBe(false);
  });
});

describe("verifyPersonSkillProfile", () => {
  it("sets isVerified=true and isDraft=false", async () => {
    mocks.personSkillProfileUpdate.mockResolvedValue({ id: "p1" });
    const result = await verifyPersonSkillProfile(
      "u1",
      "TEAM_TECHNICAL_AGILITY"
    );
    expect(result.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).data?.id).toBe("p1");

    const call = mocks.personSkillProfileUpdate.mock.calls[0][0];
    expect(call.data.isVerified).toBe(true);
    expect(call.data.isDraft).toBe(false);
  });

  it("targets correct competency and userId", async () => {
    mocks.personSkillProfileUpdate.mockResolvedValue({ id: "p1" });
    await verifyPersonSkillProfile("user123", "LEAN_AGILE_LEADERSHIP");

    const call = mocks.personSkillProfileUpdate.mock.calls[0][0];
    expect(call.where.tenantId_userId_competency).toEqual({
      tenantId: tenantCtx.tenantId,
      userId: "user123",
      competency: "LEAN_AGILE_LEADERSHIP",
    });
  });
});

describe("listPersonSkillProfiles", () => {
  it("filters by userIds", async () => {
    mocks.personSkillProfileFindMany.mockResolvedValue([]);
    const result = await listPersonSkillProfiles(["u1", "u2"]);
    expect(result.ok).toBe(true);

    const call = mocks.personSkillProfileFindMany.mock.calls[0][0];
    expect(call.where.userId.in).toEqual(["u1", "u2"]);
  });

  it("returns profiles in correct order (userId asc, competency asc)", async () => {
    const mockProfiles = [
      { userId: "u1", competency: "AGILE_PRODUCT_DELIVERY", skillLevel: 3 },
      { userId: "u1", competency: "TEAM_TECHNICAL_AGILITY", skillLevel: 4 },
      { userId: "u2", competency: "TEAM_TECHNICAL_AGILITY", skillLevel: 2 },
    ];
    mocks.personSkillProfileFindMany.mockResolvedValue(mockProfiles);
    const result = await listPersonSkillProfiles(["u1", "u2"]);
    expect(result.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).data).toEqual(mockProfiles);

    const call = mocks.personSkillProfileFindMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ userId: "asc" }, { competency: "asc" }]);
  });

  it("includes tenantId in query", async () => {
    mocks.personSkillProfileFindMany.mockResolvedValue([]);
    await listPersonSkillProfiles(["u1"]);

    const call = mocks.personSkillProfileFindMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe(tenantCtx.tenantId);
  });
});
