/**
 * `seed-meridian.ts` planta um respondente com token fixo e conhecido
 * (`DOGFOOD_RESPONDENT_TOKEN`) — achado de segurança do Vigia: sem guarda de
 * ambiente, rodar o script com `DATABASE_URL` de produção deixaria
 * `/meridian-responder/<token>` aberto pra qualquer um com o repo.
 *
 * Spawna `tsx` de verdade em vez de mockar Prisma/Pool — prova o
 * comportamento de runtime real, no mesmo molde de
 * `seed-entrypoint-guard.test.ts`.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const APP_DIR = path.resolve(__dirname, "../..");

const BASE_ENV = {
  ...process.env,
  BETTER_AUTH_SECRET: "test-dummy-secret-min-32-chars-placeholder",
  BETTER_AUTH_URL: "http://localhost:3012",
};

function runSeed(databaseUrl: string) {
  return execFileAsync("npx", ["tsx", "scripts/seed-meridian.ts"], {
    cwd: APP_DIR,
    env: { ...BASE_ENV, DATABASE_URL: databaseUrl },
  });
}

describe("seed-meridian: guarda de DATABASE_URL local", () => {
  it("recusa rodar contra um host remoto, antes de abrir conexão", async () => {
    await expect(
      runSeed("postgresql://u:p@db.prod.exemplo.com:5432/prod")
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/localhost.*127\.0\.0\.1/),
    });
  }, 20_000);

  it("recusa quando DATABASE_URL está vazia ou inválida", async () => {
    await expect(runSeed("")).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/vazio ou inválido/),
    });
  }, 20_000);

  it("deixa passar host local — falha na conexão, não na guarda", async () => {
    // Porta morta em localhost: se a guarda deixar passar, o erro vem do
    // Pool/Prisma tentando conectar, nunca da mensagem de recusa.
    await expect(
      runSeed("postgresql://nobody:nobody@127.0.0.1:1/nodb")
    ).rejects.toMatchObject({
      stderr: expect.not.stringMatching(/recusa rodar/),
    });
  }, 20_000);
});
