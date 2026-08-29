import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  listModules: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
}));
vi.mock("@repo/rbac", () => ({ listModules: h.listModules }));
vi.mock("@repo/database", () => ({
  database: { tenantModule: { findMany: h.findMany } },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

import { listarProdutos } from "@/app/actions/produtos";

const AMANHA = new Date(Date.now() + 86_400_000);
const ONTEM = new Date(Date.now() - 86_400_000);

/** Pega um produto do resultado, falhando alto se a action não devolveu ok. */
async function produtos() {
  const r = await listarProdutos();
  if (!r.ok) {
    throw new Error(`action falhou: ${r.error}`);
  }
  return new Map(r.data.map((p) => [p.modulo, p]));
}

beforeEach(() => {
  h.requireTenantSession.mockReset();
  h.listModules.mockReset();
  h.findMany.mockReset();

  h.requireTenantSession.mockResolvedValue({ tenantId: "t-1", userId: "u-1" });
  h.listModules.mockResolvedValue([]);
  h.findMany.mockResolvedValue([]);
});

describe("listarProdutos", () => {
  it("devolve todos os produtos do catálogo, sempre, em ordem", async () => {
    const p = await produtos();

    expect([...p.keys()]).toEqual(["COSMOS", "CHARTER", "MERIDIAN", "SIGNAL"]);
  });

  it("quem decide o acesso é o rbac, não esta action", async () => {
    // A regra (ACTIVE/TRIAL + expiresAt) vive em packages/rbac. Se a action
    // recalculasse, as duas divergiriam no dia em que uma mudasse — e a tela
    // ofereceria entrada onde o guard recusa.
    h.listModules.mockResolvedValue(["COSMOS"]);
    h.findMany.mockResolvedValue([
      { module: "COSMOS", status: "ACTIVE", expiresAt: null, seats: 10 },
      { module: "CHARTER", status: "ACTIVE", expiresAt: null, seats: 5 },
    ]);

    const p = await produtos();

    // CHARTER tem linha ACTIVE, mas o rbac não liberou. A action obedece.
    expect(p.get("COSMOS")?.estado).toBe("DISPONIVEL");
    expect(p.get("CHARTER")?.estado).not.toBe("DISPONIVEL");
    expect(p.get("CHARTER")?.href).toBeNull();
  });

  it("sem linha é 'não contratado', não 'indisponível'", async () => {
    // Default deny do schema. A distinção manda a pessoa ao comercial em vez
    // de fazê-la abrir chamado achando que quebrou.
    const p = await produtos();

    expect(p.get("CHARTER")?.estado).toBe("SEM_CONTRATO");
    expect(p.get("CHARTER")?.motivo).toContain("comercial");
  });

  it("suspenso e cancelado dizem que o dado continua lá", async () => {
    h.findMany.mockResolvedValue([
      { module: "COSMOS", status: "SUSPENDED", expiresAt: null, seats: null },
      { module: "CHARTER", status: "CANCELED", expiresAt: null, seats: null },
    ]);

    const p = await produtos();

    expect(p.get("COSMOS")?.estado).toBe("SUSPENSO");
    expect(p.get("COSMOS")?.motivo).toContain("intactos");
    expect(p.get("CHARTER")?.estado).toBe("CANCELADO");
  });

  it("status que concederia + rbac negando vira EXPIRADO", async () => {
    h.listModules.mockResolvedValue([]);
    h.findMany.mockResolvedValue([
      { module: "COSMOS", status: "ACTIVE", expiresAt: ONTEM, seats: null },
    ]);

    const p = await produtos();

    expect(p.get("COSMOS")?.estado).toBe("EXPIRADO");
  });

  it("SIGNAL contratado não vira link — não há tela", async () => {
    // Dizer "disponível" e não ter para onde ir é pior que dizer que falta:
    // vira 404 com cara de bug.
    h.listModules.mockResolvedValue(["SIGNAL"]);
    h.findMany.mockResolvedValue([
      { module: "SIGNAL", status: "ACTIVE", expiresAt: null, seats: null },
    ]);

    const p = await produtos();

    expect(p.get("SIGNAL")?.estado).toBe("SEM_ROTA");
    expect(p.get("SIGNAL")?.href).toBeNull();
  });

  it("disponível carrega href e nenhum motivo", async () => {
    h.listModules.mockResolvedValue(["COSMOS"]);
    h.findMany.mockResolvedValue([
      { module: "COSMOS", status: "TRIAL", expiresAt: AMANHA, seats: 3 },
    ]);

    const p = await produtos();
    const cosmos = p.get("COSMOS");

    expect(cosmos?.estado).toBe("DISPONIVEL");
    expect(cosmos?.href).toBe("/cosmos");
    // Frase de sucesso é ruído: quem entra não precisa de justificativa.
    expect(cosmos?.motivo).toBeNull();
    expect(cosmos?.emTrial).toBe(true);
    expect(cosmos?.assentos).toBe(3);
    expect(cosmos?.expiraEm).toBe(AMANHA.toISOString());
  });

  it("escopa a leitura pelo tenant da sessão", async () => {
    await produtos();

    expect(h.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t-1" } })
    );
    expect(h.listModules).toHaveBeenCalledWith("t-1");
  });
});
