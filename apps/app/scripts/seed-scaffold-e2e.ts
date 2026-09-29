/**
 * scripts/seed-scaffold-e2e.ts
 *
 * Prepara o Scaffold no tenant do e2e local (`cosmos-dev`) para
 * `e2e/scaffold-track-lifecycle.spec.ts`:
 *
 *   - catálogo de templates publicado (`seed:scaffold` do @repo/database, que só
 *     insere);
 *   - módulo SCAFFOLD contratado;
 *   - `admin@cosmos.local` como CONSULTANT e `po@cosmos.local` como
 *     PROCESS_OWNER (as duas sessões que o globalSetup já grava);
 *   - a trilha TR-901, já na Fase 2 (PILOT) com o gate pronto: a Fase 1 fechada,
 *     caso de negócio assinado e entregáveis da ASSESS aprovados.
 *
 * Por que a TR-901 existe: a tela ainda não edita as métricas do caso de negócio
 * (só assina), então nenhuma trilha nova chega à Fase 2 pela interface. A
 * fixture salta a Fase 1 por SQL, com o caso assinado de mentira, e deixa a Fase
 * 2 para a spec percorrer pela tela.
 *
 * Idempotente: apaga e recria só a TR-901 do tenant alvo. Só roda em banco local.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import type { PrismaClient as PrismaClientType } from "../../../packages/database/generated";
import { PrismaClient } from "../../../packages/database/generated";
import { assertLocalDatabaseUrl } from "./seed-meridian";

const TENANT_SLUG = "cosmos-dev";
const CONSULTANT_EMAIL = "admin@cosmos.local";
const OWNER_EMAIL = "po@cosmos.local";
export const E2E_TRACK_CODE = "TR-901";
export const E2E_TRACK_NAME = "Triagem de autorizações prévias (e2e)";

const PHASES = ["ASSESS", "PILOT", "SCALE", "EMBED"] as const;

/** O que o cliente produz é do dono; o resto é da consultoria, e o outro aprova
 *  (mesma regra de `_seed-track.ts`). */
const peopleFor = (producer: string, ownerId: string, consultantId: string) =>
  producer === "OWNER"
    ? { ownerId, approverId: consultantId }
    : { ownerId: consultantId, approverId: ownerId };

async function main() {
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  // Catálogo primeiro: só insere, e a trilha abaixo precisa da versão mais nova.
  execSync("pnpm --filter @repo/database exec tsx scripts/seed-scaffold.mts", {
    stdio: "inherit",
    env: process.env,
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: TENANT_SLUG },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error(`Tenant ${TENANT_SLUG} não existe. Rode seed:e2e antes.`);
    }
    const tenantId = tenant.id;
    const [consultant, owner] = await Promise.all(
      [CONSULTANT_EMAIL, OWNER_EMAIL].map((email) =>
        db.user.findUnique({
          where: { email },
          select: { id: true, name: true },
        })
      )
    );
    if (!(consultant && owner)) {
      throw new Error("Usuários do e2e ausentes. Rode seed:e2e antes.");
    }

    await db.tenantModule.upsert({
      where: { tenantId_module: { tenantId, module: "SCAFFOLD" } },
      create: { tenantId, module: "SCAFFOLD", status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
    for (const [user, role] of [
      [consultant, "CONSULTANT"],
      [owner, "PROCESS_OWNER"],
    ] as const) {
      await db.scaffoldMembership.upsert({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        create: { tenantId, userId: user.id, role },
        update: { role },
      });
    }
    console.log("  ✓ módulo SCAFFOLD e papéis de adoção");

    // ── TR-901 ────────────────────────────────────────────────────────────
    await db.scaffoldTrack.deleteMany({
      where: { tenantId, code: E2E_TRACK_CODE },
    });

    const template = await db.scaffoldTemplate.findUnique({
      where: { key: "triage" },
      select: {
        versions: {
          orderBy: { publishedAt: "desc" },
          take: 1,
          select: {
            id: true,
            steps: { orderBy: { seq: "asc" } },
            deliverables: { orderBy: [{ phase: "asc" }, { seq: "asc" }] },
          },
        },
      },
    });
    const version = template?.versions[0];
    if (!version || version.deliverables.length === 0) {
      throw new Error(
        "Template triage sem entregáveis: o seed:scaffold falhou?"
      );
    }

    const now = new Date();
    const PHASE_STATE = {
      ASSESS: "CLOSED",
      PILOT: "GATE_READY",
      SCALE: "IDLE",
      EMBED: "IDLE",
    } as const;

    const track = await db.scaffoldTrack.create({
      data: {
        tenantId,
        code: E2E_TRACK_CODE,
        processName: E2E_TRACK_NAME,
        ownerId: owner.id,
        consultantId: consultant.id,
        templateVersionId: version.id,
        currentPhase: "PILOT",
        lastGateAt: now,
        phases: {
          create: PHASES.map((phase) => ({
            phase,
            state: PHASE_STATE[phase],
            openedAt: phase === "SCALE" || phase === "EMBED" ? null : now,
            closedAt: phase === "ASSESS" ? now : null,
            steps: {
              create: version.steps
                .filter((s) => s.phase === phase)
                .map((s) => ({
                  stepTemplateKey: s.key,
                  seq: s.seq,
                  statement: s.statement,
                  expectedArtefact: s.expectedArtefact,
                  required: s.required,
                  // Passos concluídos até a PILOT: o gate dela só espera os
                  // entregáveis, que é o que a spec percorre.
                  state:
                    phase === "ASSESS" || phase === "PILOT"
                      ? ("DONE" as const)
                      : ("TODO" as const),
                  completedAt:
                    phase === "ASSESS" || phase === "PILOT" ? now : null,
                })),
            },
          })),
        },
      },
      select: { id: true },
    });

    const phaseRows = await db.scaffoldPhaseInstance.findMany({
      where: { trackId: track.id },
      select: { id: true, phase: true },
    });
    const phaseId = new Map(phaseRows.map((p) => [p.phase, p.id]));

    // Fase 1 decidida, com a evidência que o gate deixa.
    await db.scaffoldGateResult.create({
      data: {
        tenantId,
        phaseInstanceId: phaseId.get("ASSESS") as string,
        cycle: 0,
        outcome: "PASSED",
        approverId: owner.id,
        decidedAt: now,
        criteriaSnapshot: [],
      },
    });

    // Caso de negócio assinado de mentira: existe só para a Fase 1 constar como
    // fechada com baseline. `contentHash` não é de um payload real.
    const bc = await db.scaffoldBusinessCase.create({
      data: {
        tenantId,
        trackId: track.id,
        code: "BC-901",
        state: "SIGNED",
        sponsorId: owner.id,
        sponsorRoleLabel: "Dono do processo",
        authorId: consultant.id,
        windowStart: now,
        windowMonths: 6,
        cadence: "monthly",
        benefitBasis: "Fixture de e2e: sem valor de negócio.",
        versions: {
          create: {
            tenantId,
            label: "v1",
            state: "SIGNED",
            note: "Fixture de e2e.",
            authoredById: consultant.id,
            signedById: owner.id,
            signedAt: now,
            signedByLabel: owner.name ?? "Dono do processo",
            contentHash: "e2e-fixture",
            metrics: {
              create: {
                tenantId,
                key: "cycle",
                label: "Cycle time da triagem",
                unit: "min",
                baseValue: "46",
                targetValue: "34",
                direction: "DOWN",
                confidence: "DECLARED",
                sourceLabel: "fixture e2e",
                sampleLabel: "fixture e2e",
              },
            },
          },
        },
      },
      select: { id: true, versions: { select: { id: true } } },
    });
    await db.scaffoldBusinessCase.update({
      where: { id: bc.id },
      data: {
        currentVersionId: bc.versions[0]?.id,
        signedVersionId: bc.versions[0]?.id,
      },
    });

    // Entregáveis: ASSESS aprovada; o resto, a percorrer.
    for (const t of version.deliverables) {
      const approved = t.phase === "ASSESS";
      const row = await db.scaffoldDeliverableInstance.create({
        data: {
          tenantId,
          trackId: track.id,
          phaseInstanceId: phaseId.get(t.phase) as string,
          stepCode: t.stepCode,
          code: t.code,
          templateKey: t.code,
          title: t.title,
          description: t.description,
          kind: t.kind,
          producer: t.producer,
          isExtra: false,
          // Sem Charter no tenant do e2e: o C1.1 nasce dispensado, como na tela.
          required: t.requiresModule ? false : t.required,
          dispensedReason: t.requiresModule
            ? "O módulo Charter não está contratado por esta organização; dispensado pelo sistema."
            : null,
          status: approved ? "APPROVED" : "NOT_STARTED",
          ...peopleFor(t.producer, owner.id, consultant.id),
        },
        select: { id: true, ownerId: true, approverId: true },
      });
      if (approved) {
        await db.scaffoldDeliverableEvent.createMany({
          data: (
            [
              ["START", "NOT_STARTED", "IN_PROGRESS", row.ownerId],
              ["SUBMIT", "IN_PROGRESS", "IN_REVIEW", row.ownerId],
              ["APPROVE", "IN_REVIEW", "APPROVED", row.approverId],
            ] as const
          ).map(([action, fromStatus, toStatus, actorId]) => ({
            tenantId,
            deliverableId: row.id,
            action,
            fromStatus,
            toStatus,
            actorId: actorId as string,
          })),
        });
      }
    }

    // A próxima trilha criada pela tela não pode colidir com a TR-901.
    for (const kind of ["track", "businesscase"] as const) {
      const cur = await db.scaffoldSequence.findUnique({
        where: { tenantId_kind: { tenantId, kind } },
        select: { next: true },
      });
      await db.scaffoldSequence.upsert({
        where: { tenantId_kind: { tenantId, kind } },
        create: { tenantId, kind, next: 902 },
        update: { next: Math.max(cur?.next ?? 0, 902) },
      });
    }
    console.log(`  ✓ trilha ${E2E_TRACK_CODE} na Fase 2, com o gate pronto`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
