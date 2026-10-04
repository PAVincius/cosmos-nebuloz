import { beforeEach, describe, expect, it, vi } from "vitest";

// Trilha — US7.
//
// O que estes testes protegem: que a trilha continue sendo prova. Duas coisas
// a sustentam — o módulo não exporta nenhuma escrita (a única entrada é a das
// actions que praticam os atos, na mesma transação) e o papel gravado é o do
// MOMENTO do ato, não o de hoje. Sem a segunda, promover alguém reescreveria
// retroativamente quem tinha autoridade para o que já foi feito.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  withTenantDb: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@/lib/signal/guards", async () => {
  const errors = await vi.importActual<typeof import("@/lib/signal/errors")>(
    "../../../lib/signal/errors"
  );
  return {
    ...errors,
    requireSignalPermissionContext: h.requireSignalPermissionContext,
  };
});

// biome-ignore lint/performance/noNamespaceImport: o teste existe para inspecionar a superfície exportada do módulo — é o import de namespace que o torna possível
import * as auditModule from "@/app/(signal)/actions/audit";
import { listAudit } from "@/app/(signal)/actions/audit";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ADMIN",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

const entry = (over: Record<string, unknown> = {}) => ({
  id: "au_1",
  action: "Fórmula versionada",
  entityType: "signal.roiformula",
  entityId: "rf_1",
  actorType: "user",
  actorId: "usr_2",
  diff: [["Versão", "v2", "v3"]],
  metadata: {
    target: "IN-014 · Copiloto de atendimento",
    note: "Custo de licença revisado.",
    signalRole: "ANALYST",
    actorName: "Rafael",
  },
  createdAt: new Date("2026-08-20T14:00:00Z"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  db = { auditLog: { findMany: vi.fn().mockResolvedValue([entry()]) } };
  h.withTenantDb.mockImplementation(
    (_tenantId: string, fn: (d: Db) => unknown) => fn(db)
  );
});

describe("a trilha é append-only", () => {
  it("o módulo não expõe nenhuma escrita", () => {
    // Se um dia alguém adicionar `deleteAuditEntry` aqui, a resposta para
    // "isto pode ter sido apagado?" passa a ser "pode" — e o teste quebra
    // antes de a pergunta chegar ao auditor.
    const exported = Object.keys(auditModule);
    expect(exported).toEqual(["listAudit"]);
  });
});

describe("listAudit", () => {
  it("traz de → para, autor e papel do momento do ato", async () => {
    const res = await listAudit();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      throw new Error("deveria ter listado");
    }
    const [row] = res.data;
    expect(row.diff).toEqual([["Versão", "v2", "v3"]]);
    expect(row.actorName).toBe("Rafael");
    // Papel congelado: quem agiu era ANALYST, mesmo que hoje seja ADMIN.
    expect(row.actorRole).toBe("ANALYST");
    expect(row.target).toBe("IN-014 · Copiloto de atendimento");
  });

  it("mostra ato do sistema como sistema, não como pessoa", async () => {
    db.auditLog.findMany.mockResolvedValue([
      entry({
        actorType: "system",
        actorId: null,
        action: "Alerta disparado",
        metadata: { target: "AL-31 · IN-014", note: null, actorName: null },
      }),
    ]);

    const res = await listAudit();

    expect(res.ok && res.data[0].actorName).toBe("Sistema");
    expect(res.ok && res.data[0].bySystem).toBe(true);
    expect(res.ok && res.data[0].actorRole).toBeNull();
  });

  it("lista só entradas do Signal — a tabela é compartilhada", async () => {
    await listAudit();

    const where = db.auditLog.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([{ entityType: { startsWith: "signal." } }]);
  });

  it("recusa entityType de outro módulo — o leitor do Signal não lê a trilha do Meridian", async () => {
    for (const entityType of [
      "meridian.assessment",
      "charter.policy",
      "scaffold.track",
      "signal",
    ]) {
      const res = await listAudit({ entityType: entityType as never });

      expect(res.ok).toBe(false);
    }
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("mesmo com entityType do Signal, o prefixo continua no filtro", async () => {
    await listAudit({ entityType: "signal.initiative" });

    const where = db.auditLog.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([{ entityType: { startsWith: "signal." } }])
    );
  });

  it("filtra por entidade quando pedido", async () => {
    await listAudit({ entityType: "signal.initiative", entityId: "in_1" });

    const where = db.auditLog.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([
      { entityType: { startsWith: "signal." } },
      { entityType: "signal.initiative" },
    ]);
    expect(where.entityId).toBe("in_1");
  });

  it("filtra por período e por ator", async () => {
    await listAudit({
      from: "2026-08-01",
      to: "2026-08-31",
      actorId: "usr_2",
    });

    const where = db.auditLog.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);
    expect(where.actorId).toBe("usr_2");
  });

  it("aguenta entrada sem diff — nem todo ato muda campo", async () => {
    db.auditLog.findMany.mockResolvedValue([entry({ diff: null })]);

    const res = await listAudit();

    expect(res.ok && res.data[0].diff).toEqual([]);
  });

  it("aguenta metadata vazia sem quebrar a leitura", async () => {
    db.auditLog.findMany.mockResolvedValue([entry({ metadata: null })]);

    const res = await listAudit();

    expect(res.ok && res.data[0].actorName).toBe("—");
    expect(res.ok && res.data[0].target).toBeNull();
  });

  it("do mais recente para o mais antigo", async () => {
    await listAudit();

    expect(db.auditLog.findMany.mock.calls[0][0].orderBy).toEqual({
      createdAt: "desc",
    });
  });
});
