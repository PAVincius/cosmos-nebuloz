import { database } from "@repo/database";
import { describe, expect, it, vi } from "vitest";
import * as indice from "../index";
import { platformDb } from "../platform-db";

// Os `vi.mock` abaixo são içados pelo vitest acima dos imports estáticos, então
// a ordem textual não importa aqui. (O tsconfig do pacote é CommonJS — sem
// `await` de topo, o padrão de import dinâmico de apps/backoffice não compila.)

// `@repo/database` valida DATABASE_URL e abre o pool no import — o mesmo
// motivo pelo qual apps/backoffice o troca por `vi.mock`. Aqui o cliente é um
// objeto sentinela: o que importa provar é a identidade, não o Prisma.
vi.mock("@repo/database", () => ({
  database: { tenant: { findMany: vi.fn() }, $transaction: vi.fn() },
}));

// O pacote real de `server-only` lança em qualquer import fora do bundler do
// Next. O stub vazio reproduz o que o Next faz num bundle de servidor.
vi.mock("server-only", () => ({}));

describe("platformDb", () => {
  it("é a mesma instância que `database` — uma porta cross-tenant, não uma segunda conexão", () => {
    expect(platformDb).toBe(database);
  });

  it("o índice do pacote reexporta a mesma referência", () => {
    expect(indice.platformDb).toBe(platformDb);
  });

  it("recusa carregar fora de um bundle de servidor — `server-only` real lança", async () => {
    // Sem o stub, o guard do pacote derruba o módulo antes de tocar o banco:
    // é isto que impede platformDb de vazar para um Client Component.
    // Extensão `.js` por causa do moduleResolution NodeNext; o Vite resolve
    // para o `.ts` ao lado.
    vi.doUnmock("server-only");
    vi.resetModules();

    await expect(import("../platform-db.js")).rejects.toThrow(
      /Client Component/
    );
  });
});
