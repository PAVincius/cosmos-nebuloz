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
  // CharterPolicyLink (2026-08-06): policyId is FK'd and tenant-scoped like
  // the entries above. alvoId has no FK by design — it points at
  // CharterUseCase or CharterVendor depending on alvoTipo — but linkPolicy()
  // validates alvoId belongs to the caller's tenant before every write, and
  // cuids don't collide across tenants, so the same transitive argument holds.
  "CharterPolicyLink:policyId,alvoTipo,alvoId",
  // Meridian (2026-08-29): mesmo argumento de escopo transitivo. Cada campo
  // não-tenant destas chaves é FK para um modelo que carrega `tenantId` —
  // templateId → MeridianTemplate, respondentId → MeridianRespondent,
  // assessmentId → MeridianAssessment, gapId → MeridianGap. Uma colisão entre
  // tenants exigiria que dois tenants compartilhassem a mesma linha pai, o que
  // a FK impede. Diferente do caso que a Sec 2 corrigiu: aqui nenhuma chave
  // permite que um UPDATE case com a linha de outro tenant por id.
  "MeridianQuestion:templateId,code",
  "MeridianResponse:respondentId,questionId",
  "MeridianAxisScore:assessmentId,axis",
  "MeridianGapDependency:gapId,dependsOnGapId",
  "MeridianPlanItem:assessmentId,gapId",
  // Growth · readiness (2026-09-06): mesma forma de `MeridianResponse` — uma
  // resposta identificada pelo pai mais o item respondido. `avaliacaoId` é FK
  // para `AvaliacaoDeMaturidade`, que carrega `tenantId`, então uma colisão
  // entre tenants exigiria dois tenants dividindo a mesma avaliação, o que a
  // FK impede.
  //
  // Aqui a chave estreita é a *mais* forte, e por isso ela fica: incluir
  // `tenantId` passaria a permitir duas respostas para o mesmo
  // (avaliacaoId, criterioId) sob tenants diferentes — exatamente a duplicata
  // que a chave existe para impedir. `RespostaDeMaturidade` só tem a coluna
  // `tenantId` porque a policy de RLS da casa é
  // `"tenantId" = current_tenant_id()`, e tabela sem a coluna ficaria fora do
  // isolamento; a coluna não é parte da identidade da linha.
  "RespostaDeMaturidade:avaliacaoId,criterioId",
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
