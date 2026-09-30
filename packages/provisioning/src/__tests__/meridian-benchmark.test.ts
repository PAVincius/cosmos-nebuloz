import type { PrismaClient } from "@repo/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProvisioningError } from "../errors";
import {
  type MeridianBenchmarkDb,
  setMeridianBenchmarkEnablement,
} from "../meridian-benchmark";

// Benchmark travado por tenant (specs/012): só staff liga, com a referência do
// aditivo (DPA §2.1) obrigatória para tenant externo, e toda mudança é auditada.

// A escrita e a auditoria vão na MESMA transação: sem isso, a mudança poderia
// valer sem trilha (contra FR-004). `tx` é o client da transação; o `db` de
// fora só lê o tenant e abre a transação.
function makeDb(
  tenant: { isInternalTenant: boolean } | null = { isInternalTenant: false }
) {
  const tx = {
    meridianBenchmarkEnablement: {
      upsert: vi.fn().mockResolvedValue({ tenantId: "t1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
  };
  const db = {
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          tenant && { id: "t1", slug: "vanta-saude", ...tenant }
        ),
    },
    $transaction<T>(fn: (t: typeof tx) => Promise<T>): Promise<T> {
      return fn(tx);
    },
    // Escrever fora da transação é o erro que estes testes existem para pegar.
    meridianBenchmarkEnablement: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  vi.spyOn(db, "$transaction");
  return Object.assign(db, { tx });
}

const base = { tenantId: "t1", actorUserId: "staff-1", actorName: "Staff" };

// O tipo do escritor é estrutural, mas o client REAL do Prisma (o `platformDb`
// que o back-office passa) precisa caber nele, com o model da migration do
// Alicerce. Checado em compilação: se o schema ou o tipo mudarem e deixarem de
// combinar, `tsc` falha aqui, não em produção.
type ClientCabeNoTipo = PrismaClient extends MeridianBenchmarkDb ? true : false;
const clientCabeNoTipo: ClientCabeNoTipo = true;

describe("setMeridianBenchmarkEnablement", () => {
  it("o client real do Prisma cabe no tipo do escritor (checagem de compilação)", () => {
    expect(clientCabeNoTipo).toBe(true);
  });

  let db: ReturnType<typeof makeDb>;
  beforeEach(() => {
    db = makeDb();
  });

  it("liga tenant externo com a referência do aditivo", async () => {
    await setMeridianBenchmarkEnablement(db, {
      ...base,
      enabled: true,
      agreementRef: "  ADT-2026-014  ",
    });
    const args = db.tx.meridianBenchmarkEnablement.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: "t1" });
    expect(args.create).toMatchObject({
      tenantId: "t1",
      enabled: true,
      agreementRef: "ADT-2026-014",
      updatedById: "staff-1",
    });
    expect(args.update).toMatchObject({
      enabled: true,
      agreementRef: "ADT-2026-014",
      updatedById: "staff-1",
    });
  });

  it("recusa ligar tenant externo sem referência (ou só espaços)", async () => {
    for (const agreementRef of [undefined, "", "   "]) {
      await expect(
        setMeridianBenchmarkEnablement(db, {
          ...base,
          enabled: true,
          agreementRef,
        })
      ).rejects.toMatchObject({ code: "BENCHMARK_AGREEMENT_REQUIRED" });
    }
    expect(db.tx.meridianBenchmarkEnablement.upsert).not.toHaveBeenCalled();
    expect(db.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("tenant interno liga sem aditivo", async () => {
    db = makeDb({ isInternalTenant: true });
    await setMeridianBenchmarkEnablement(db, { ...base, enabled: true });
    const args = db.tx.meridianBenchmarkEnablement.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({ enabled: true, agreementRef: null });
  });

  it("desligar não exige referência e preserva a referência anterior", async () => {
    await setMeridianBenchmarkEnablement(db, { ...base, enabled: false });
    const args = db.tx.meridianBenchmarkEnablement.upsert.mock.calls[0][0];
    expect(args.update).toMatchObject({
      enabled: false,
      updatedById: "staff-1",
    });
    expect(args.update).not.toHaveProperty("agreementRef");
    expect(args.create).toMatchObject({ enabled: false, agreementRef: null });
  });

  it("audita ligar com ator, alvo, referência e diff", async () => {
    await setMeridianBenchmarkEnablement(db, {
      ...base,
      enabled: true,
      agreementRef: "ADT-2026-014",
    });
    const { data } = db.tx.auditLog.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "t1",
      userId: "staff-1",
      action: "meridian.benchmark.enabled",
      entityType: "MeridianBenchmarkEnablement",
      entityId: "t1",
      diff: [["Benchmark", "desligado", "ligado"]],
    });
    expect(data.metadata.target).toBe("vanta-saude · benchmark");
    expect(data.metadata.note).toContain("ADT-2026-014");
    expect(data.metadata.platformStaff).toBe(true);
  });

  it("audita desligar", async () => {
    await setMeridianBenchmarkEnablement(db, { ...base, enabled: false });
    const { data } = db.tx.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("meridian.benchmark.disabled");
    expect(data.diff).toEqual([["Benchmark", "ligado", "desligado"]]);
  });

  it("upsert e auditoria rodam dentro da mesma transação, nunca fora dela", async () => {
    await setMeridianBenchmarkEnablement(db, {
      ...base,
      enabled: true,
      agreementRef: "ADT-1",
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.tx.meridianBenchmarkEnablement.upsert).toHaveBeenCalledTimes(1);
    expect(db.tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(db.meridianBenchmarkEnablement.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("falha na auditoria derruba a transação: a mudança não vale sem trilha", async () => {
    db.tx.auditLog.create.mockRejectedValue(new Error("audit indisponível"));
    await expect(
      setMeridianBenchmarkEnablement(db, {
        ...base,
        enabled: true,
        agreementRef: "ADT-1",
      })
    ).rejects.toThrow("audit indisponível");
    // A rejeição sai de dentro do callback da transação — é o que faz o
    // Prisma reverter o upsert.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("recusa de regra não abre transação", async () => {
    await expect(
      setMeridianBenchmarkEnablement(db, { ...base, enabled: true })
    ).rejects.toMatchObject({ code: "BENCHMARK_AGREEMENT_REQUIRED" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("tenant inexistente: erro nomeado, nada gravado", async () => {
    db = makeDb(null);
    const err = await setMeridianBenchmarkEnablement(db, {
      ...base,
      enabled: false,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ProvisioningError);
    expect(err.code).toBe("TENANT_NOT_FOUND");
    expect(db.tx.meridianBenchmarkEnablement.upsert).not.toHaveBeenCalled();
  });
});
