import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Mesma armadilha das outras suítes: o módulo importa requirePlatformStaff, que
// puxa @repo/auth/server (quebra ao carregar) e @repo/database (valida
// DATABASE_URL no import). Os mesmos mocks evitam os dois problemas.
vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@repo/database", () => ({
  database: { tenantMember: { findFirst: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { clientListArgs, clientDetailArgs } = await import(
  "../lib/client-queries"
);

describe("fronteira cross-tenant", () => {
  it("a listagem exclui o tenant interno", () => {
    expect(clientListArgs().where).toMatchObject({ isSystem: false });
  });

  it("o detalhe também exclui — slug do tenant interno não abre tela", () => {
    expect(clientDetailArgs("__system__").where).toMatchObject({
      slug: "__system__",
      isSystem: false,
    });
  });

  it("o argumento do detalhe é o que vai para o banco, sem filtro perdido no caminho", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    // Prova que a consulta executada carrega o filtro — não que o código-fonte
    // menciona a palavra em algum lugar.
    await findFirst(clientDetailArgs("vanta-saude"));

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isSystem: false }),
      })
    );
  });
});

describe("actions/empresa — só fornecedores.ts atravessa tenants", () => {
  const dir = path.resolve(__dirname, "../app/actions/empresa");
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".ts"));

  it("os oito arquivos existem", () => {
    expect(arquivos.sort()).toEqual([
      "cac.ts",
      "consentimento.ts",
      "financeiro.ts",
      "fornecedores.ts",
      "livro.ts",
      "orcamento.ts",
      "recorrente.ts",
      "titulos.ts",
    ]);
  });

  for (const f of arquivos) {
    const fonte = readFileSync(path.join(dir, f), "utf8");

    it(`${f} filtra pelo tenant system`, () => {
      expect(fonte).toContain("SYSTEM_TENANT_ID");
    });

    it(`${f} ${f === "fornecedores.ts" ? "é o único que" : "não"} importa platformDb/withTenantDb`, () => {
      const atravessa = /platformDb|withTenantDb/.test(fonte);
      expect(atravessa).toBe(f === "fornecedores.ts");
    });

    // Guard estrutural (fix-wave A2): um export sem `requirePlatformStaff` no
    // corpo é uma server action alcançável por POST sem o guard do layout
    // (staff) — contasDoPlano/assertContaAtiva passavam nas duas checagens
    // acima antes de virar helpers em lib/empresa/consultas.ts. A checagem é
    // textual por função: parte o arquivo a cada `export async function` e
    // exige a menção no bloco que segue.
    const blocos = fonte
      .split(/(?=export async function )/)
      .filter((b) => b.startsWith("export async function "));

    it(`${f} tem pelo menos um export async function`, () => {
      expect(blocos.length).toBeGreaterThan(0);
    });

    for (const bloco of blocos) {
      const nome = bloco.match(/^export async function (\w+)/)?.[1] ?? "?";
      it(`${f}: ${nome} chama requirePlatformStaff`, () => {
        expect(bloco).toContain("requirePlatformStaff");
      });
    }
  }
});
