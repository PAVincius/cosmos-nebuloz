import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  type AuditDiff,
  buildDiff,
  FIELD_LABELS,
  logSignalAudit,
  logSignalSystemAudit,
  nextCode,
} from "@/app/(signal)/actions/_shared";
import type { SignalContext } from "@/lib/signal/guards";

type MockDb = {
  signalSequence: { upsert: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const makeDb = (): MockDb => ({
  signalSequence: { upsert: vi.fn() },
  auditLog: { create: vi.fn().mockResolvedValue({}) },
});

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ANALYST",
  user: { id: "usr_1", name: "Marina Duarte", email: "marina@vanta.test" },
} as unknown as SignalContext;

let db: MockDb;

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
});

describe("nextCode", () => {
  it("emite o primeiro código com o prefixo e o padding do tipo", async () => {
    db.signalSequence.upsert.mockResolvedValue({ next: 2 });
    // create devolve next=2 já reservando o próximo: o emitido é next−1.
    await expect(
      nextCode({ db: db as never, tenantId: "tnt_1", kind: "initiative" })
    ).resolves.toBe("IN-001");
  });

  it("usa prefixo e largura próprios de cada tipo", async () => {
    const cases = [
      ["initiative", 15, "IN-014"],
      ["evidence", 8842, "EV-8841"],
      ["alert", 32, "AL-31"],
      ["report", 119, "RP-118"],
      ["mapping", 2, "MP-01"],
      ["connection", 2, "CN-01"],
    ] as const;
    for (const [kind, next, expected] of cases) {
      db.signalSequence.upsert.mockResolvedValue({ next });
      await expect(
        nextCode({ db: db as never, tenantId: "tnt_1", kind })
      ).resolves.toBe(expected);
    }
  });

  it("incrementa atomicamente — duas criações concorrentes não colidem", async () => {
    // O upsert+increment é resolvido pelo Postgres; o que o teste garante é que
    // o código NÃO lê o valor antes de incrementar (read-then-write colidiria).
    db.signalSequence.upsert
      .mockResolvedValueOnce({ next: 15 })
      .mockResolvedValueOnce({ next: 16 });

    const [a, b] = await Promise.all([
      nextCode({ db: db as never, tenantId: "tnt_1", kind: "initiative" }),
      nextCode({ db: db as never, tenantId: "tnt_1", kind: "initiative" }),
    ]);

    expect(a).not.toBe(b);
    expect([a, b].sort()).toEqual(["IN-014", "IN-015"]);
    expect(db.signalSequence.upsert).toHaveBeenCalledTimes(2);
    // Nenhuma leitura separada: o incremento é a própria escrita.
    expect(db.signalSequence.upsert.mock.calls[0]?.[0]).toMatchObject({
      update: { next: { increment: 1 } },
    });
  });

  it("é escopado por tenant e por tipo", async () => {
    db.signalSequence.upsert.mockResolvedValue({ next: 2 });
    await nextCode({ db: db as never, tenantId: "tnt_9", kind: "alert" });
    expect(db.signalSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_kind: { tenantId: "tnt_9", kind: "alert" } },
      })
    );
  });

  it("propaga a falha em vez de devolver código — número queimado é buraco na sequência", async () => {
    db.signalSequence.upsert.mockRejectedValue(new Error("deadlock"));
    await expect(
      nextCode({ db: db as never, tenantId: "tnt_1", kind: "initiative" })
    ).rejects.toThrow("deadlock");
  });
});

describe("buildDiff", () => {
  const labels = { status: FIELD_LABELS.status, name: FIELD_LABELS.name };

  it("registra só o que mudou", () => {
    const diff = buildDiff(
      { status: "DRAFT", name: "Triagem" },
      { status: "ACTIVE", name: "Triagem" },
      labels
    );
    expect(diff).toEqual([["Status", "DRAFT", "ACTIVE"]]);
  });

  it("não emite linha 'X → X' — faria o auditor procurar mudança onde não houve", () => {
    const diff = buildDiff(
      { status: "ACTIVE", name: "Triagem" },
      { status: "ACTIVE", name: "Triagem" },
      labels
    );
    expect(diff).toEqual([]);
  });

  it("ignora campo ausente no 'depois' (edição parcial)", () => {
    const diff = buildDiff(
      { status: "DRAFT", name: "A" },
      { name: "B" },
      labels
    );
    expect(diff).toEqual([["Nome", "A", "B"]]);
  });

  it("representa nulo e indefinido como travessão, dos dois lados", () => {
    expect(
      buildDiff(
        { name: null },
        { name: "Triagem" },
        { name: FIELD_LABELS.name }
      )
    ).toEqual([["Nome", "—", "Triagem"]]);
    expect(
      buildDiff(
        { name: "Triagem" },
        { name: null },
        { name: FIELD_LABELS.name }
      )
    ).toEqual([["Nome", "Triagem", "—"]]);
  });

  it("só olha os campos rotulados — campo sem rótulo não vaza para a trilha", () => {
    const diff = buildDiff(
      { status: "DRAFT", updatedAt: "ontem" },
      { status: "ACTIVE", updatedAt: "hoje" },
      { status: FIELD_LABELS.status }
    );
    expect(diff).toEqual([["Status", "DRAFT", "ACTIVE"]]);
  });

  it("usa rótulo pt-BR, para a mesma mudança ter o mesmo nome em toda a trilha", () => {
    const diff = buildDiff(
      { valueBar: "1.5" },
      { valueBar: "2.0" },
      { valueBar: FIELD_LABELS.valueBar }
    );
    expect(diff[0]?.[0]).toBe("Régua de valor");
  });
});

describe("trilha de auditoria", () => {
  const diff: AuditDiff = [["Versão", "v2", "v3"]];

  it("grava ator, papel no momento e alvo legível", async () => {
    await logSignalAudit(db as never, CTX, {
      action: "Fórmula de ROI alterada",
      entityType: "signal.roiformula",
      entityId: "cuid_1",
      target: "IN-014 · Triagem assistida",
      diff,
    });

    const data = db.auditLog.create.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({
      tenantId: "tnt_1",
      actorId: "usr_1",
      actorType: "user",
      entityType: "signal.roiformula",
      diff,
    });
    // O papel muda; o registro do ato não pode mudar com ele.
    expect(data.metadata).toMatchObject({
      signalRole: "ANALYST",
      actorName: "Marina Duarte",
      target: "IN-014 · Triagem assistida",
    });
  });

  it("propaga a falha em vez de engolir — trilha não é telemetria", async () => {
    // Fire-and-forget é aceitável para métrica de uso e inaceitável para
    // evidência: se a entrada não gravou, a operação inteira tem de falhar.
    db.auditLog.create.mockRejectedValue(new Error("constraint"));
    await expect(
      logSignalAudit(db as never, CTX, {
        action: "x",
        entityType: "signal.initiative",
        entityId: "cuid_1",
        target: "IN-014",
      })
    ).rejects.toThrow("constraint");
  });

  it("aceita entrada sem diff (criação não tem 'antes')", async () => {
    await logSignalAudit(db as never, CTX, {
      action: "Iniciativa criada",
      entityType: "signal.initiative",
      entityId: "cuid_1",
      target: "IN-014",
    });
    expect(db.auditLog.create.mock.calls[0]?.[0]?.data.diff).toBeNull();
  });

  it("cai para o e-mail quando o ator não tem nome", async () => {
    const anon = {
      ...CTX,
      user: { id: "usr_1", name: null, email: "marina@vanta.test" },
    } as unknown as SignalContext;
    await logSignalAudit(db as never, anon, {
      action: "x",
      entityType: "signal.initiative",
      entityId: "c",
      target: "IN-014",
    });
    expect(db.auditLog.create.mock.calls[0]?.[0]?.data.metadata.actorName).toBe(
      "marina@vanta.test"
    );
  });

  it("ato do sistema não é atribuído a pessoa nenhuma", async () => {
    // Alerta automático que aparecesse como ato de gente daria a resposta
    // errada à primeira pergunta do auditor: "quem decidiu isso?".
    await logSignalSystemAudit(db as never, {
      tenantId: "tnt_1",
      action: "Alerta disparado",
      entityType: "signal.alert",
      entityId: "cuid_2",
      target: "IN-014",
      note: "Zendesk sem sync há 4 dias",
    });
    const data = db.auditLog.create.mock.calls[0]?.[0]?.data;
    expect(data.actorType).toBe("system");
    expect(data.actorId).toBeUndefined();
    expect(data.metadata.actorName).toBe("Signal");
  });
});
