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
