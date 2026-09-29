import { beforeEach, describe, expect, it, vi } from "vitest";

// X-01 — registro único de processo. Sem FK cruzada, então o banco não garante
// que os ids existam nem que sejam do mesmo tenant: quem grava confere.
const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  gapFind: vi.fn(),
  trackFind: vi.fn(),
  initiativeFind: vi.fn(),
  useCaseFind: vi.fn(),
  regFindMany: vi.fn(),
  regCreateMany: vi.fn(),
  regUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
  requireScaffoldContext: h.requirePerm,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      meridianGap: { findFirst: h.gapFind },
      scaffoldTrack: { findFirst: h.trackFind },
      signalInitiative: { findFirst: h.initiativeFind },
      charterUseCase: { findFirst: h.useCaseFind },
      processRegistry: {
        findMany: h.regFindMany,
        createMany: h.regCreateMany,
        updateMany: h.regUpdateMany,
      },
      auditLog: { create: h.auditCreate },
    }),
}));

import { linkProcess } from "@/app/(scaffold)/actions/process-link";
import { upsertProcessRegistry } from "@/lib/scaffold/process-registry";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.gapFind.mockResolvedValue({ id: "g1" });
  h.trackFind.mockResolvedValue({ id: "tr1" });
  h.initiativeFind.mockResolvedValue({ id: "i1" });
  h.useCaseFind.mockResolvedValue({ id: "uc1" });
  // 1ª consulta: nada; depois do insert: o registro novo.
  h.regFindMany.mockReset();
  h.regFindMany.mockResolvedValueOnce([]).mockResolvedValue([
    {
      id: "r-novo",
      workForm: null,
      meridianGapId: null,
      scaffoldTrackId: null,
      signalInitiativeId: null,
      charterUseCaseId: null,
    },
  ]);
  h.regCreateMany.mockResolvedValue({ count: 1 });
  h.regUpdateMany.mockResolvedValue({ count: 1 });
  h.auditCreate.mockResolvedValue({});
});

const fakeDb = () =>
  ({
    meridianGap: { findFirst: h.gapFind },
    scaffoldTrack: { findFirst: h.trackFind },
    signalInitiative: { findFirst: h.initiativeFind },
    charterUseCase: { findFirst: h.useCaseFind },
    processRegistry: {
      findMany: h.regFindMany,
      createMany: h.regCreateMany,
      updateMany: h.regUpdateMany,
    },
  }) as never;

describe("upsertProcessRegistry", () => {
  it("exige ao menos um id (o CHECK do banco também)", async () => {
    await expect(
      upsertProcessRegistry(fakeDb(), { tenantId: "t1", name: "Triagem" })
    ).rejects.toMatchObject({ code: "PROCESS_LINK_EMPTY" });
    expect(h.regCreateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["meridianGapId", () => h.gapFind, "g1"],
    ["scaffoldTrackId", () => h.trackFind, "tr1"],
    ["signalInitiativeId", () => h.initiativeFind, "i1"],
    ["charterUseCaseId", () => h.useCaseFind, "uc1"],
  ] as const)("confere %s no MESMO tenant antes de gravar", async (field, finder, id) => {
    await upsertProcessRegistry(fakeDb(), {
      tenantId: "t1",
      name: "Triagem",
      [field]: id,
    });

    expect(finder()).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, tenantId: "t1" } })
    );
    expect(h.regCreateMany).toHaveBeenCalled();
  });

  it("id que não existe neste tenant é recusado e nada é gravado", async () => {
    h.trackFind.mockResolvedValue(null);

    await expect(
      upsertProcessRegistry(fakeDb(), {
        tenantId: "t1",
        name: "Triagem",
        scaffoldTrackId: "tr-de-outro-tenant",
      })
    ).rejects.toMatchObject({ code: "PROCESS_LINK_TARGET_NOT_FOUND" });
    expect(h.regCreateMany).not.toHaveBeenCalled();
    expect(h.regUpdateMany).not.toHaveBeenCalled();
  });

  it("cria o registro novo com skipDuplicates (sem P2002 dentro da transação)", async () => {
    const r = await upsertProcessRegistry(fakeDb(), {
      tenantId: "t1",
      name: "Triagem",
      workForm: "TRIAGE",
      meridianGapId: "g1",
      scaffoldTrackId: "tr1",
    });

    expect(r).toMatchObject({ created: true });
    const call = h.regCreateMany.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data[0]).toMatchObject({
      tenantId: "t1",
      name: "Triagem",
      workForm: "TRIAGE",
      meridianGapId: "g1",
      scaffoldTrackId: "tr1",
    });
  });

  it("registro existente com um dos ids: completa os que faltam, sem sobrescrever", async () => {
    h.regFindMany.mockReset();
    h.regFindMany.mockResolvedValue([
      {
        id: "r1",
        workForm: null,
        meridianGapId: "g1",
        scaffoldTrackId: null,
        signalInitiativeId: null,
        charterUseCaseId: null,
      },
    ]);

    const r = await upsertProcessRegistry(fakeDb(), {
      tenantId: "t1",
      name: "Triagem",
      meridianGapId: "g1",
      scaffoldTrackId: "tr1",
      workForm: "TRIAGE",
    });

    expect(r).toMatchObject({ id: "r1", created: false });
    expect(h.regCreateMany).not.toHaveBeenCalled();
    expect(h.regUpdateMany).toHaveBeenCalledWith({
      where: { id: "r1", tenantId: "t1" },
      data: { scaffoldTrackId: "tr1", workForm: "TRIAGE" },
    });
  });

  it("recusa ligar id que o registro já tem apontando para OUTRA coisa", async () => {
    h.regFindMany.mockReset();
    h.regFindMany.mockResolvedValue([
      {
        id: "r1",
        workForm: null,
        meridianGapId: "g1",
        scaffoldTrackId: "tr-antiga",
        signalInitiativeId: null,
        charterUseCaseId: null,
      },
    ]);

    await expect(
      upsertProcessRegistry(fakeDb(), {
        tenantId: "t1",
        name: "Triagem",
        meridianGapId: "g1",
        scaffoldTrackId: "tr1",
      })
    ).rejects.toMatchObject({ code: "PROCESS_LINK_CONFLICT" });
    expect(h.regUpdateMany).not.toHaveBeenCalled();
  });

  it("ids que hoje estão em registros diferentes não são fundidos em silêncio", async () => {
    h.regFindMany.mockResolvedValue([
      {
        id: "r1",
        workForm: null,
        meridianGapId: "g1",
        scaffoldTrackId: null,
        signalInitiativeId: null,
        charterUseCaseId: null,
      },
      {
        id: "r2",
        workForm: null,
        meridianGapId: null,
        scaffoldTrackId: "tr1",
        signalInitiativeId: null,
        charterUseCaseId: null,
      },
    ]);

    await expect(
      upsertProcessRegistry(fakeDb(), {
        tenantId: "t1",
        name: "Triagem",
        meridianGapId: "g1",
        scaffoldTrackId: "tr1",
      })
    ).rejects.toMatchObject({ code: "PROCESS_LINK_CONFLICT" });
  });

  it("corrida: o insert perdeu (count 0) e o registro do outro é reaproveitado", async () => {
    h.regCreateMany.mockResolvedValue({ count: 0 });
    h.regFindMany.mockReset();
    h.regFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "r-do-outro",
          workForm: null,
          meridianGapId: "g1",
          scaffoldTrackId: "tr1",
          signalInitiativeId: null,
          charterUseCaseId: null,
        },
      ]);

    const r = await upsertProcessRegistry(fakeDb(), {
      tenantId: "t1",
      name: "Triagem",
      meridianGapId: "g1",
      scaffoldTrackId: "tr1",
    });

    expect(r).toMatchObject({ id: "r-do-outro", created: false });
  });

  it("procura o registro só dentro do tenant", async () => {
    await upsertProcessRegistry(fakeDb(), {
      tenantId: "t1",
      name: "Triagem",
      scaffoldTrackId: "tr1",
    });

    expect(h.regFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      })
    );
  });
});

describe("linkProcess (action)", () => {
  it("exige track.manage no backend", async () => {
    await linkProcess({ name: "Triagem", scaffoldTrackId: "tr1" });

    expect(h.requirePerm).toHaveBeenCalledWith("track.manage");
  });

  it("sem a permissão nada é lido nem escrito", async () => {
    h.requirePerm.mockRejectedValue(new Error("FORBIDDEN"));

    const r = await linkProcess({ name: "Triagem", scaffoldTrackId: "tr1" });

    expect(r.ok).toBe(false);
    expect(h.trackFind).not.toHaveBeenCalled();
    expect(h.regCreateMany).not.toHaveBeenCalled();
  });

  it("liga e audita", async () => {
    const r = await linkProcess({
      name: "Triagem",
      workForm: "TRIAGE",
      scaffoldTrackId: "tr1",
      charterUseCaseId: "uc1",
    });

    expect(r.ok).toBe(true);
    expect(h.auditCreate).toHaveBeenCalledTimes(1);
  });

  it("sem nenhum id, recusa", async () => {
    const r = await linkProcess({ name: "Triagem" });

    expect(r.ok).toBe(false);
    expect(h.regCreateMany).not.toHaveBeenCalled();
  });

  it("nome vazio é recusado", async () => {
    const r = await linkProcess({ name: "  ", scaffoldTrackId: "tr1" });

    expect(r.ok).toBe(false);
  });
});
