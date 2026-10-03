import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Achado 7 do Vigia (BAIXO): `contributeInTx` e `runScoringInTx` eram exportadas
// de arquivos `"use server"`. Todo export assíncrono de um arquivo assim vira um
// endpoint HTTP que qualquer cliente pode chamar com argumentos à escolha, e
// estas duas recebem um cliente de transação (`db`) e o contexto do ator: não
// são ações, são miolo. Ficam em módulo sem `"use server"` (prefixo `_`).
//
// A regra geral, para a próxima vez: função exportada de arquivo `"use server"`
// do Meridian cujo primeiro parâmetro é `db` é um bug de arquitetura.

const ACTIONS = join(
  import.meta.dirname,
  "..",
  "..",
  "app",
  "(meridian)",
  "actions"
);

const serverActionFiles = readdirSync(ACTIONS)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ file: f, source: readFileSync(join(ACTIONS, f), "utf-8") }))
  .filter(({ source }) => /^\s*["']use server["']/.test(source));

describe("arquivos use server do Meridian", () => {
  it("há arquivos use server para conferir", () => {
    expect(serverActionFiles.length).toBeGreaterThan(5);
  });

  it("nenhum exporta função que recebe o cliente de transação (`db`) como primeiro parâmetro", () => {
    const offenders: string[] = [];
    for (const { file, source } of serverActionFiles) {
      for (const m of source.matchAll(
        /export\s+async\s+function\s+(\w+)\s*\(\s*db\b/g
      )) {
        offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("os módulos de miolo existem e não são use server", () => {
    for (const f of ["_benchmark-core.ts", "_scoring-core.ts"]) {
      const source = readFileSync(join(ACTIONS, f), "utf-8");
      expect(source).not.toMatch(/^\s*["']use server["']/);
      expect(source).toMatch(/import "server-only"/);
    }
  });
});
