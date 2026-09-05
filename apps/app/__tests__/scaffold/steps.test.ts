import { beforeEach, describe, expect, it, vi } from "vitest";

// S-04 — passos e artefatos.
//
// Duas coisas não óbvias sob teste:
//
//   • Concluir o último passo requerido NÃO fecha o gate. Move a fase para
//     GATE_READY, que é onde o gate passa a poder ser avaliado. Confundir os
//     dois seria fechar a fase por completar tarefa, que é exatamente o gate
//     desligado.
//   • `readArtefact` grava a trilha de auditoria ANTES de emitir a URL
//     (SN-02/SN-03), dentro da mesma transação. Mesmo raciocínio que o Meridian
//     escreveu em `requestEvidenceUrl`: o registro é de ACESSO CONCEDIDO, não de
//     byte entregue — se o download não completar, o acesso ainda aconteceu.

const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  stepFindFirst: vi.fn(),
  stepUpdate: vi.fn(),
  stepCount: vi.fn(),
  phaseUpdate: vi.fn(),
  artefactCreate: vi.fn(),
  artefactFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  /** Ordem das escritas, para provar que o log precede a URL. */
  order: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: h.requirePerm,
  requireScaffoldContext: h.requirePerm,
}));
vi.mock("@repo/storage", () => ({
  SCAFFOLD_ARTEFACT_BUCKET: "scaffold-artefacts",
  storageClient: {
    storage: {
      from: () => ({
        createSignedUrl: async () => {
          h.order.push("url");
          return {
            data: { signedUrl: "https://blob.example/read?sig=x" },
            error: null,
          };
        },
        createSignedUploadUrl: async () => ({
          data: {
            signedUrl: "https://blob.example/upload",
            path: "t1/trk1/artefato.pdf",
          },
          error: null,
        }),
      }),
    },
  },
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      scaffoldStepInstance: {
        findFirst: h.stepFindFirst,
        update: h.stepUpdate,
        count: h.stepCount,
      },
      scaffoldPhaseInstance: { update: h.phaseUpdate },
      scaffoldArtefact: {
        create: h.artefactCreate,
        findFirst: h.artefactFindFirst,
      },
      auditLog: {
        create: (...args: unknown[]) => {
          h.order.push("log");
          return h.auditCreate(...args);
        },
      },
    }),
}));

import {
  attachArtefact,
  readArtefact,
  setStepState,
} from "@/app/(scaffold)/actions/steps";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  role: "ADMIN",
  scaffoldRole: "CONSULTANT",
  user: { name: "Marina", email: "m@x.com" },
};

const STEP = "clx000000000000000000s001";
const PI = "clx00000000000000000pi001";

function step(over: Record<string, unknown> = {}) {
  return {
    id: STEP,
    state: "TODO",
    required: true,
    statement: "Rodar piloto em 20% do volume",
    phaseInstanceId: PI,
    phaseInstance: {
      id: PI,
      phase: "PILOT",
      state: "OPEN",
      track: { id: "trk1", code: "TR-104", tenantId: "t1" },
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.order.length = 0;
  h.requirePerm.mockResolvedValue(CTX);
  h.stepFindFirst.mockResolvedValue(step());
  h.stepUpdate.mockResolvedValue({});
  h.stepCount.mockResolvedValue(0);
  h.phaseUpdate.mockResolvedValue({});
  h.artefactCreate.mockResolvedValue({ id: "art1" });
  h.artefactFindFirst.mockResolvedValue({
    id: "art1",
    objectKey: "scaffold/trk1/artefato.pdf",
    filename: "artefato.pdf",
    stepInstance: step(),
  });
  h.auditCreate.mockResolvedValue({});
});

describe("setStepState", () => {
  it("marca o passo como concluído", async () => {
    const res = await setStepState({ stepInstanceId: STEP, state: "DONE" });
    expect(res.ok).toBe(true);
    expect(h.stepUpdate.mock.calls[0][0].data).toMatchObject({
      state: "DONE",
      completedById: "u1",
    });
  });

  it("resolve o passo dentro do tenant da sessão", async () => {
    await setStepState({ stepInstanceId: STEP, state: "DONE" });
    expect(h.stepFindFirst.mock.calls[0][0].where).toMatchObject({
      id: STEP,
      phaseInstance: { track: { tenantId: "t1" } },
    });
  });

  it("concluir o último passo requerido leva a fase a GATE_READY — não a fecha", async () => {
    // SG-01 abre o gate; SG-02 é que o fecha. Completar tarefa não é decisão.
    h.stepCount.mockResolvedValue(0); // nenhum requerido pendente depois deste
    await setStepState({ stepInstanceId: STEP, state: "DONE" });
    expect(h.phaseUpdate.mock.calls[0][0].data.state).toBe("GATE_READY");
  });

  it("não move a fase enquanto restar passo requerido", async () => {
    h.stepCount.mockResolvedValue(2);
    await setStepState({ stepInstanceId: STEP, state: "DONE" });
    expect(h.phaseUpdate).not.toHaveBeenCalled();
  });

  it("desmarcar um passo faz a fase recuar de GATE_READY para OPEN", async () => {
    // Regressão acontece: alguém marca DONE por engano. O gate tem de recuar
    // junto, senão fica pronto sobre trabalho que não terminou.
    h.stepFindFirst.mockResolvedValue(
      step({
        state: "DONE",
        phaseInstance: {
          id: PI,
          phase: "PILOT",
          state: "GATE_READY",
          track: { id: "trk1", code: "TR-104", tenantId: "t1" },
        },
      })
    );
    h.stepCount.mockResolvedValue(1);
    await setStepState({ stepInstanceId: STEP, state: "TODO" });
    expect(h.phaseUpdate.mock.calls[0][0].data.state).toBe("OPEN");
  });

  it("não mexe em passo de fase já fechada", async () => {
    h.stepFindFirst.mockResolvedValue(
      step({
        phaseInstance: {
          id: PI,
          phase: "PILOT",
          state: "CLOSED",
          track: { id: "trk1", code: "TR-104", tenantId: "t1" },
        },
      })
    );
    const res = await setStepState({ stepInstanceId: STEP, state: "DONE" });
    expect(res.ok).toBe(false);
    expect(h.stepUpdate).not.toHaveBeenCalled();
  });

  it("limpa a autoria ao desmarcar — quem não concluiu não assina", async () => {
    h.stepFindFirst.mockResolvedValue(step({ state: "DONE" }));
    await setStepState({ stepInstanceId: STEP, state: "TODO" });
    expect(h.stepUpdate.mock.calls[0][0].data).toMatchObject({
      completedById: null,
      completedAt: null,
    });
  });
});

describe("attachArtefact", () => {
  it("devolve URL de upload e cria o registro do artefato", async () => {
    const res = await attachArtefact({
      stepInstanceId: STEP,
      filename: "rollback-plan.md",
      contentType: "text/markdown",
      sizeBytes: 2048,
    });
    expect(res.ok).toBe(true);
    expect(h.artefactCreate).toHaveBeenCalledTimes(1);
  });

  it("recusa arquivo acima do limite, antes de gerar URL", async () => {
    const res = await attachArtefact({
      stepInstanceId: STEP,
      filename: "dump.bin",
      contentType: "application/octet-stream",
      sizeBytes: 200 * 1024 * 1024,
    });
    expect(res.ok).toBe(false);
    expect(h.artefactCreate).not.toHaveBeenCalled();
  });
});

describe("readArtefact — SN-02", () => {
  it("grava a trilha de auditoria ANTES de emitir a URL assinada", async () => {
    await readArtefact({ artefactId: "clx00000000000000000art1" });
    expect(h.order).toEqual(["log", "url"]);
  });

  it("a URL expira — leitura permanente é leitura sem controle", async () => {
    const res = await readArtefact({ artefactId: "clx00000000000000000art1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.expiresIn).toBeGreaterThan(0);
    }
  });

  it("resolve o artefato dentro do tenant da sessão", async () => {
    await readArtefact({ artefactId: "clx00000000000000000art1" });
    const where = h.artefactFindFirst.mock.calls[0][0].where;
    expect(where.stepInstance.phaseInstance.track.tenantId).toBe("t1");
  });

  it("não emite URL quando o artefato não existe no tenant", async () => {
    h.artefactFindFirst.mockResolvedValue(null);
    const res = await readArtefact({ artefactId: "clx00000000000000000art1" });
    expect(res.ok).toBe(false);
    expect(h.order).toEqual([]);
  });
});
