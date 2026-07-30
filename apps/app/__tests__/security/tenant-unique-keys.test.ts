import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Repo root: apps/app/__tests__/security -> apps/app -> apps -> <repo root>
const REPO_ROOT = join(__dirname, "../../../..");
const SCHEMA_DIR = join(REPO_ROOT, "packages/database/prisma/schema");

// Composite @@unique keys that omit tenantId on a model that otherwise has a
// tenantId column, reviewed and accepted as of Sec 6 of the isolamento-tenant
// plan (2026-07-28): every field in each key already scopes to a single
// tenant transitively (piPlanId/artId/sprintId/etc. all belong to exactly one
// tenant), so a collision across tenants is not reachable through them. This
// is a different situation from the bug Sec 2 fixed in TeamMemberAssignment /
// StandupEntry, where the key allowed an UPDATE to match another tenant's row
// by id.
//
// This allowlist exists so the check below catches NEW unscoped keys (a
// regression) without re-litigating these pre-existing ones. Do not add to
// it without confirming the same transitive-scoping argument holds — if it
// doesn't, add tenantId to the key instead (see the Sec 2 migration for the
// pattern: packages/database/prisma/migrations/20260728000000_tenant_scoped_assignment_key).
const ALLOWED_UNSCOPED_UNIQUE_KEYS = new Set([
  "PIParticipant:piPlanId,userId",
  "ArtSequenceCounter:artId,type",
  "PIPlanFeatureAssignment:piPlanId,featureId",
  "BillingEntryAllocation:billingEntryId,themeId,epicId,artId,effectiveFrom",
  "LACEMember:laceId,userId",
  "ConfidenceVoteSession:piSessionId,roundNumber",
  "ConfidenceVoteTally:voteSessionId,round",
  "DependencyLink:blockingFeatureId,blockedFeatureId",
  "ARTMembership:artId,userId",
  "MemberSprintMetrics:sprintId,userId",
  "TeamCapacitySnapshot:sprintId,teamId",
  // Charter (2026-07-30): policyId/vendorId/clauseId each already belong to
  // exactly one tenant (CharterPolicy/CharterVendor/CharterClause all carry
  // tenantId), same transitive-scoping argument as the entries above.
  "CharterPolicySection:policyId,ordinal",
  "CharterPolicyVersion:policyId,version",
  "CharterVendorClause:vendorId,clauseId",
]);

type ModelUniqueKey = { model: string; fields: string[]; file: string };

function schemaFiles(): string[] {
  return readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".prisma"))
    .map((f) => join(SCHEMA_DIR, f));
}

// Extracts every `model Name { ... }` block (non-greedy, single-file scope —
// Prisma models never nest braces at the top level in this schema).
function modelBlocks(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /model\s+(\w+)\s*\{([^}]*)\}/gs;
  let m: RegExpExecArray | null = re.exec(src);
  while (m !== null) {
    out.push({ name: m[1], body: m[2] });
    m = re.exec(src);
  }
  return out;
}

function hasTenantIdField(body: string): boolean {
  return /^\s*tenantId\s+String\b/m.test(body);
}

function uniqueKeysMissingTenantId(
  model: string,
  body: string,
  file: string
): ModelUniqueKey[] {
  if (!hasTenantIdField(body)) {
    return [];
  }
  const out: ModelUniqueKey[] = [];
  const re = /@@unique\(\[([^\]]+)\]/g;
  let m: RegExpExecArray | null = re.exec(body);
  while (m !== null) {
    const fields = m[1].split(",").map((f) => f.trim());
    if (!fields.includes("tenantId")) {
      out.push({ model, fields, file });
    }
    m = re.exec(body);
  }
  return out;
}

describe("multi-tenant models never gain an unscoped @@unique key", () => {
  it("has no @@unique key on a tenantId-bearing model that omits tenantId, unless allowlisted", () => {
    const offenders: string[] = [];

    for (const file of schemaFiles()) {
      const src = readFileSync(file, "utf8");
      for (const { name, body } of modelBlocks(src)) {
        for (const key of uniqueKeysMissingTenantId(name, body, file)) {
          const id = `${key.model}:${key.fields.join(",")}`;
          if (!ALLOWED_UNSCOPED_UNIQUE_KEYS.has(id)) {
            offenders.push(
              `${key.model}(@@unique([${key.fields.join(", ")}])) in ${file.replace(REPO_ROOT, "")} — ` +
                "has a tenantId column but this key omits it; either add tenantId to the key " +
                "or add a reviewed exemption with justification to ALLOWED_UNSCOPED_UNIQUE_KEYS"
            );
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
