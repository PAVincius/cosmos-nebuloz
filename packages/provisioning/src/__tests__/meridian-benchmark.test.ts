import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProvisioningError } from "../errors";
import { setMeridianBenchmarkEnablement } from "../meridian-benchmark";

// Benchmark travado por tenant (specs/012): só staff liga, com a referência do
// aditivo (DPA §2.1) obrigatória para tenant externo, e toda mudança é auditada.

function makeDb(
  tenant: { isInternalTenant: boolean } | null = { isInternalTenant: false }
) {
  return {
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          tenant && { id: "t1", slug: "vanta-saude", ...tenant }
        ),
    },
    meridianBenchmarkEnablement: {
      upsert: vi.fn().mockResolvedValue({ tenantId: "t1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
  };
}

const base = { tenantId: "t1", actorUserId: "staff-1", actorName: "Staff" };

describe("setMeridianBenchmarkEnablement", () => {
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
    const args = db.meridianBenchmarkEnablement.upsert.mock.calls[0][0];
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
    expect(db.meridianBenchmarkEnablement.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("tenant interno liga sem aditivo", async () => {
    db = makeDb({ isInternalTenant: true });
    await setMeridianBenchmarkEnablement(db, { ...base, enabled: true });
    const args = db.meridianBenchmarkEnablement.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({ enabled: true, agreementRef: null });
  });

  it("desligar não exige referência e preserva a referência anterior", async () => {
    await setMeridianBenchmarkEnablement(db, { ...base, enabled: false });
    const args = db.meridianBenchmarkEnablement.upsert.mock.calls[0][0];
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
    const { data } = db.auditLog.create.mock.calls[0][0];
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
    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("meridian.benchmark.disabled");
    expect(data.diff).toEqual([["Benchmark", "ligado", "desligado"]]);
  });

  it("tenant inexistente: erro nomeado, nada gravado", async () => {
    db = makeDb(null);
    const err = await setMeridianBenchmarkEnablement(db, {
      ...base,
      enabled: false,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ProvisioningError);
    expect(err.code).toBe("TENANT_NOT_FOUND");
    expect(db.meridianBenchmarkEnablement.upsert).not.toHaveBeenCalled();
  });
});
