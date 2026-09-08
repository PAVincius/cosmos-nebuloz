// migrations-do-codigo.test.ts — a lista congelada tem que bater com o disco.
//
// Este teste é o que dispensa alguém lembrar de rodar o gerador. Sem ele, a
// primeira migration criada depois deste commit deixaria a tela de versão
// mentindo em silêncio: ela diria "em dia" enquanto o código já esperava uma
// migration que a lista não conhece. Mentira de painel de operação é pior que
// painel ausente — a pessoa para de procurar.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIGRATIONS_DO_CODIGO } from "../migrations-do-codigo";

const PASTA = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prisma",
  "migrations"
);

const noDisco = readdirSync(PASTA, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

describe("MIGRATIONS_DO_CODIGO", () => {
  it("bate exatamente com prisma/migrations", () => {
    // A mensagem do assert é a instrução: quem quebrar isto vai ler o comando
    // antes de ir procurar o que aconteceu.
    expect(
      [...MIGRATIONS_DO_CODIGO],
      "lista desatualizada — rode `pnpm --filter @repo/database gerar:migrations`"
    ).toEqual(noDisco);
  });

  it("não tem duplicata", () => {
    expect(new Set(MIGRATIONS_DO_CODIGO).size).toBe(
      MIGRATIONS_DO_CODIGO.length
    );
  });

  it("está em ordem crescente, que é a ordem de aplicação", () => {
    // O Prisma aplica por nome. Fora de ordem, "a última aplicada" na tela
    // apontaria para a migration errada.
    expect([...MIGRATIONS_DO_CODIGO]).toEqual([...MIGRATIONS_DO_CODIGO].sort());
  });
});
