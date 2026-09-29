/**
 * Prepara a carga do k6 `meridian-responder.js`: cria, no tenant local
 * `cosmos-dev`, um assessment `AS-K6-001` com N respondentes (eixo DATA, todos
 * INVITED, cada um com o seu token) e grava `.tokens.json` ao lado do script
 * com os tokens, os ids das perguntas do eixo e o id da server action
 * `saveDraft` (lido do manifesto do próprio `next dev`).
 *
 * Só local: recusa rodar se `DATABASE_URL` não apontar para localhost.
 * Idempotente: apaga o assessment `AS-K6-001` anterior (respostas e respondentes
 * antes, por causa da FK) e recria.
 *
 *   cd apps/app && npx tsx load/k6/prepare-meridian-responder.ts [N=50]
 *
 * Precisa do `next dev` já ter compilado o responder pelo menos uma vez (abrir
 * /meridian-responder/<qualquer token> uma vez), senão o manifesto ainda não
 * tem a action.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import type { PrismaClient as PrismaClientType } from "../../../../packages/database/generated";
import { PrismaClient } from "../../../../packages/database/generated";
import { hashToken, issueToken } from "../../lib/meridian/respondent-token";

const TENANT_SLUG = "cosmos-dev";
const ASSESSMENT_CODE = "AS-K6-001";
const COUNT = Number(process.argv[2] ?? 50);
// Roda de dentro de apps/app (ver o cabeçalho): sem __dirname nem import.meta,
// que dependem do modo CJS/ESM do tsx.
const here = join(process.cwd(), "load/k6");

function assertLocalDatabaseUrl(url: string | undefined): void {
  const host = url ? new URL(url).hostname : "";
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(
      `DATABASE_URL não é local (host: ${host || "vazio"}). Esta preparação só roda em localhost.`
    );
  }
}

function findSaveDraftActionId(): string {
  // `next dev` grava em .next/dev/server; `next build` em .next/server. Vale o
  // mais recente: sobra manifesto do outro modo no mesmo .next.
  const manifestPath = [
    "../../.next/dev/server/server-reference-manifest.json",
    "../../.next/server/server-reference-manifest.json",
  ]
    .map((p) => join(here, p))
    .filter((p) => existsSync(p))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!manifestPath) {
    throw new Error("manifesto de server actions não encontrado em .next");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    node?: Record<string, { exportedName?: string; filename?: string }>;
  };
  const hit = Object.entries(manifest.node ?? {}).find(
    ([, v]) =>
      v.exportedName === "saveDraft" &&
      (v.filename ?? "").includes("(meridian)/actions/respondent")
  );
  if (!hit) {
    throw new Error(
      "saveDraft não está no manifesto de server actions: abra o link de um respondente no next dev uma vez e rode de novo."
    );
  }
  return hit[0];
}

async function main() {
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
  }) as PrismaClientType;

  try {
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { slug: TENANT_SLUG },
    });
    const template = await db.meridianTemplate.findFirstOrThrow({
      where: { tenantId: tenant.id, version: "v3.2" },
    });
    const consultant = await db.meridianMembership.findFirstOrThrow({
      where: { tenantId: tenant.id, role: "CONSULTANT" },
    });
    const questions = await db.meridianQuestion.findMany({
      where: { templateId: template.id, axis: "DATA" },
      orderBy: { ordinal: "asc" },
      select: { id: true, type: true, scaleLabels: true },
    });

    const previous = await db.meridianAssessment.findFirst({
      where: { tenantId: tenant.id, code: ASSESSMENT_CODE },
      select: { id: true },
    });
    if (previous) {
      await db.meridianResponse.deleteMany({
        where: { respondent: { assessmentId: previous.id } },
      });
      await db.meridianRespondent.deleteMany({
        where: { assessmentId: previous.id },
      });
      await db.meridianAssessment.delete({ where: { id: previous.id } });
    }

    const assessment = await db.meridianAssessment.create({
      data: {
        tenantId: tenant.id,
        code: ASSESSMENT_CODE,
        orgName: "Carga k6 (sintética)",
        sector: "Carga",
        sizeBand: "n/a",
        templateId: template.id,
        status: "COLLECTING",
        consultantId: consultant.userId,
        deadline: new Date(Date.now() + 30 * 86_400_000),
        benchmarkOptIn: false,
      },
    });

    const tokens: string[] = [];
    const now = new Date();
    for (let i = 0; i < COUNT; i++) {
      const token = issueToken();
      tokens.push(token);
      await db.meridianRespondent.create({
        data: {
          tenantId: tenant.id,
          assessmentId: assessment.id,
          name: `Respondente k6 ${i + 1}`,
          role: "Carga",
          email: `k6-${i + 1}@carga.exemplo`,
          axis: "DATA",
          status: "INVITED",
          tokenHash: hashToken(token),
          tokenExpiresAt: new Date(now.getTime() + 14 * 86_400_000),
          invitedAt: now,
        },
      });
    }

    const out = {
      assessment: ASSESSMENT_CODE,
      saveDraftActionId: findSaveDraftActionId(),
      questions: questions.map((q) => ({
        id: q.id,
        max: Math.max(0, q.scaleLabels.length - 1),
      })),
      tokens,
    };
    writeFileSync(join(here, ".tokens.json"), JSON.stringify(out, null, 2));
    console.log(
      `✓ ${ASSESSMENT_CODE}: ${COUNT} respondentes, ${questions.length} perguntas no eixo DATA, .tokens.json gravado`
    );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("prepare-meridian-responder falhou:", e);
  process.exit(1);
});
