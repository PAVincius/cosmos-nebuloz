/**
 * Cifra os segredos de `Integration.config` que ficaram em texto plano.
 *
 * Contexto: até esta correção, `app/actions/settings/integrations.ts` e
 * `app/actions/billing/index.ts` gravavam `config` sem passar por
 * `encryptConfigSecrets`, enquanto os outros três caminhos de escrita cifravam.
 * As linhas antigas continuam legíveis — `decryptConfigSecrets` devolve o valor
 * cru quando o parse falha — então nada quebrou e nada avisou. Este script
 * fecha a lacuna que sobrou no banco.
 *
 * É idempotente: valor já cifrado é reconhecido pelo envelope {iv,tag,data} e
 * pulado. Rodar duas vezes não cifra em cima do cifrado.
 *
 * Usage:
 *   cd apps/app
 *   npx tsx scripts/backfill-integration-secrets.ts            # dry-run
 *   npx tsx scripts/backfill-integration-secrets.ts --apply    # grava
 *
 * Requer ENCRYPTION_KEY e DATABASE_URL no ambiente — os mesmos que a app usa.
 * Aponte para um banco de cada vez e confira o dry-run antes do --apply.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@repo/database/generated/client";
import { encryptSecret } from "@repo/security/encrypt";
import { Pool } from "pg";

// Mesma lista de `packages/security/encrypt.ts`. Duplicada de propósito: ela
// não é exportada, e um script de migração que decide sozinho o que é segredo
// é pior que um que espelha a fonte e quebra ruidosamente se ela mudar.
const SECRET_FIELDS = new Set([
  "apiToken",
  "pat",
  "apiKey",
  "token",
  "password",
  "secret",
  "webhookUrl",
]);

const APPLY = process.argv.includes("--apply");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

/** Um valor já cifrado é o JSON {iv,tag,data} que `encryptSecret` produz. */
function isAlreadyEncrypted(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.iv === "string" &&
      typeof parsed.tag === "string" &&
      typeof parsed.data === "string"
    );
  } catch {
    return false;
  }
}

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error("ENCRYPTION_KEY ausente. Abortando sem tocar no banco.");
    process.exit(1);
  }

  const rows = await db.integration.findMany({
    select: { id: true, source: true, name: true, config: true },
  });

  console.log(
    `${rows.length} integrações · modo ${APPLY ? "APPLY" : "dry-run"}\n`
  );

  let touched = 0;
  let alreadyOk = 0;

  for (const row of rows) {
    const config = (row.config ?? {}) as Record<string, unknown>;
    const toEncrypt: string[] = [];

    for (const [key, value] of Object.entries(config)) {
      if (!(SECRET_FIELDS.has(key) && typeof value === "string")) {
        continue;
      }
      if (isAlreadyEncrypted(value)) {
        alreadyOk += 1;
        continue;
      }
      toEncrypt.push(key);
    }

    if (toEncrypt.length === 0) {
      continue;
    }

    // Só o nome do campo entra no log — nunca o valor.
    console.log(
      `  ${row.source.padEnd(16)} ${row.name} → cifrar: ${toEncrypt.join(", ")}`
    );
    touched += 1;

    if (!APPLY) {
      continue;
    }

    const next = { ...config };
    for (const key of toEncrypt) {
      next[key] = encryptSecret(config[key] as string);
    }

    await db.integration.update({
      where: { id: row.id },
      data: { config: next as never },
    });
  }

  console.log(
    `\n${touched} integrações com segredo em claro · ${alreadyOk} campos já cifrados`
  );

  if (touched > 0 && !APPLY) {
    console.log("Nada foi gravado. Rode de novo com --apply para aplicar.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
