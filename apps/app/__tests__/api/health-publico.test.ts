// @vitest-environment node
// health-publico.test.ts — /api/health é público (monitor não tem sessão), e
// por isso só pode dizer se o banco responde e em quanto tempo.
//
// Gêmeo do teste do back-office. Em 2026-09-22 um GET anônimo em
// app.nebuloz.ai/api/health devolvia o mesmo alvo do banco que o back-office:
// host do pooler, usuário com o ref do projeto Supabase, tamanho da senha.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: { $queryRaw: mocks.queryRaw },
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: mocks.logError, warn: vi.fn(), info: vi.fn() },
}));

import { GET } from "../../app/api/health/route";

const SENHA = "s3nh4-d0-b4nc0";
const URL_DO_BANCO = `postgresql://postgres.abcdefghijklmnop:${SENHA}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

function falhaDeAutenticacao() {
  // Driver de banco costuma ecoar a connection string inteira ao falhar.
  return Object.assign(
    new Error(`Authentication failed against ${URL_DO_BANCO}`),
    { code: "P1000" }
  );
}

describe("GET /api/health", () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) {
      m.mockReset();
    }
    vi.stubEnv("DATABASE_URL", URL_DO_BANCO);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Lista fechada de propósito: campo novo nesta resposta é decisão, não
  // acidente — ela sai para qualquer um.
  it("com o banco no ar, diz ok e a latência — nada do alvo", async () => {
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      checks: { database: { status: "ok", latencyMs: expect.any(Number) } },
    });
  });

  it("com o banco fora, diz erro sem ecoar a causa", async () => {
    mocks.queryRaw.mockRejectedValue(falhaDeAutenticacao());

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "degraded",
      checks: { database: { status: "error" } },
    });
  });

  it("a causa da falha vai para o log do servidor, sem a senha", async () => {
    mocks.queryRaw.mockRejectedValue(falhaDeAutenticacao());

    await GET();

    expect(mocks.logError).toHaveBeenCalledTimes(1);
    const contexto = mocks.logError.mock.calls[0][1];
    expect(contexto.code).toBe("P1000");
    expect(JSON.stringify(contexto)).not.toContain(SENHA);
  });
});
