// tasks.test.ts — app/actions/tasks estava com ZERO cobertura. As ações são o
// backend do board do time (story-060) e já carregam três garantias que
// precisavam de teste antes de ganhar superfície: escopo de tenant em toda
// leitura e escrita, guard de IDOR no storyId vindo do cliente, e o
// completedAt derivado da transição de status — nunca aceito do cliente.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  storyFindFirst: vi.fn(),
  taskFindFirst: vi.fn(),
  taskFindMany: vi.fn(),
  taskCreate: vi.fn(),
  taskUpdate: vi.fn(),
  taskDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    story: { findFirst: mocks.storyFindFirst },
    task: {
      findFirst: mocks.taskFindFirst,
      findMany: mocks.taskFindMany,
      create: mocks.taskCreate,
      update: mocks.taskUpdate,
      delete: mocks.taskDelete,
    },
  },
}));

import {
  createTask,
  deleteTask,
  listTasksByStory,
  updateTask,
  updateTaskStatus,
} from "../../../app/actions/tasks";

// cuid válido: CreateTaskSchema usa o refinamento `cuid` de _base, então id
// inventado tipo "story-1" é rejeitado pelo zod antes de chegar no banco.
const STORY_ID = "clx1234567890abcdefghijk";
const TASK_ID = "clx0987654321kjihgfedcba";

// A política de Task (app/actions/permissions-policy.ts) libera create/update/
// delete só para SM e DEV — não para PO, que é o papel do tenantCtx padrão. É
// escolha deliberada: a task é do time, o PO é dono do backlog, não da execução.
const smCtx = { ...tenantCtx, role: "SM" as const };

const storyComSprint = {
  id: STORY_ID,
  sprintId: "spr-1",
  sprint: { teamId: "team-1" },
};

describe("listTasksByStory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    // PO de propósito: leitura não passa por enforce, e o teste prova isso.
    mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  });

  it("filtra por tenant da sessão, nunca por id vindo do cliente", async () => {
    mocks.storyFindFirst.mockResolvedValue({ id: STORY_ID });
    mocks.taskFindMany.mockResolvedValue([{ id: TASK_ID, title: "Subir API" }]);

    const res = await listTasksByStory(STORY_ID);

    expect(res.ok).toBe(true);
    expect(mocks.storyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: STORY_ID, tenantId: tenantCtx.tenantId },
      })
    );
    expect(mocks.taskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: STORY_ID, tenantId: tenantCtx.tenantId },
      })
    );
  });

  it("recusa story de outro tenant sem vazar existência", async () => {
    // findFirst já veio com o filtro de tenant: story de outro tenant volta
    // null, e a ação não distingue "não existe" de "não é sua".
    mocks.storyFindFirst.mockResolvedValue(null);

    const res = await listTasksByStory(STORY_ID);

    expect(res.ok).toBe(false);
    expect(mocks.taskFindMany).not.toHaveBeenCalled();
  });
});

describe("createTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(smCtx);
  });

  it("grava com o tenantId da sessão", async () => {
    mocks.storyFindFirst.mockResolvedValue(storyComSprint);
    mocks.taskCreate.mockResolvedValue({ id: TASK_ID });

    const res = await createTask({ storyId: STORY_ID, title: "Subir API" });

    expect(res.ok).toBe(true);
    expect(mocks.taskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storyId: STORY_ID,
        title: "Subir API",
        tenantId: smCtx.tenantId,
      }),
    });
  });

  it("recusa storyId de outro tenant — guard de IDOR", async () => {
    mocks.storyFindFirst.mockResolvedValue(null);

    const res = await createTask({ storyId: STORY_ID, title: "Subir API" });

    expect(res.ok).toBe(false);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("recusa título vazio", async () => {
    mocks.storyFindFirst.mockResolvedValue(storyComSprint);

    const res = await createTask({ storyId: STORY_ID, title: "" });

    expect(res.ok).toBe(false);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("nasce TODO quando o status não é informado", async () => {
    mocks.storyFindFirst.mockResolvedValue(storyComSprint);
    mocks.taskCreate.mockResolvedValue({ id: TASK_ID });

    await createTask({ storyId: STORY_ID, title: "Subir API" });

    expect(mocks.taskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "TODO" }),
    });
  });

  it("recusa PO — task é do time, não do dono do backlog", async () => {
    mocks.requireTenantSession.mockResolvedValue(tenantCtx); // role: PO
    mocks.storyFindFirst.mockResolvedValue(storyComSprint);

    const res = await createTask({ storyId: STORY_ID, title: "Subir API" });

    expect(res.ok).toBe(false);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });
});

describe("updateTaskStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(smCtx);
  });

  it("carimba completedAt ao entrar em DONE", async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: TASK_ID,
      status: "IN_PROGRESS",
      story: storyComSprint,
    });
    mocks.taskUpdate.mockResolvedValue({ id: TASK_ID, status: "DONE" });

    const res = await updateTaskStatus(TASK_ID, "DONE");

    expect(res.ok).toBe(true);
    const arg = mocks.taskUpdate.mock.calls[0][0];
    expect(arg.data.status).toBe("DONE");
    expect(arg.data.completedAt).toBeInstanceOf(Date);
  });

  it("limpa completedAt ao sair de DONE", async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: TASK_ID,
      status: "DONE",
      story: storyComSprint,
    });
    mocks.taskUpdate.mockResolvedValue({ id: TASK_ID, status: "TODO" });

    await updateTaskStatus(TASK_ID, "TODO");

    expect(mocks.taskUpdate.mock.calls[0][0].data.completedAt).toBeNull();
  });

  it("recusa status fora do vocabulário", async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: TASK_ID,
      status: "TODO",
      story: storyComSprint,
    });

    const res = await updateTaskStatus(TASK_ID, "ARQUIVADA");

    expect(res.ok).toBe(false);
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });

  it("recusa task de outro tenant", async () => {
    mocks.taskFindFirst.mockResolvedValue(null);

    const res = await updateTaskStatus(TASK_ID, "DONE");

    expect(res.ok).toBe(false);
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });
});

describe("updateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(smCtx);
  });

  it("não mexe em completedAt quando o status não muda de lado", async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: TASK_ID,
      status: "TODO",
      story: storyComSprint,
    });
    mocks.taskUpdate.mockResolvedValue({ id: TASK_ID });

    await updateTask(TASK_ID, { title: "Outro título" });

    expect(mocks.taskUpdate.mock.calls[0][0].data).not.toHaveProperty(
      "completedAt"
    );
  });

  it("recusa task de outro tenant", async () => {
    mocks.taskFindFirst.mockResolvedValue(null);

    const res = await updateTask(TASK_ID, { title: "Outro título" });

    expect(res.ok).toBe(false);
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });
});

describe("deleteTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(smCtx);
  });

  it("apaga só depois de confirmar o tenant", async () => {
    mocks.taskFindFirst.mockResolvedValue({
      id: TASK_ID,
      status: "TODO",
      story: storyComSprint,
    });
    mocks.taskDelete.mockResolvedValue({ id: TASK_ID });

    const res = await deleteTask(TASK_ID);

    expect(res.ok).toBe(true);
    expect(mocks.taskFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TASK_ID, tenantId: tenantCtx.tenantId },
      })
    );
    expect(mocks.taskDelete).toHaveBeenCalledWith({ where: { id: TASK_ID } });
  });

  it("não apaga task de outro tenant", async () => {
    mocks.taskFindFirst.mockResolvedValue(null);

    const res = await deleteTask(TASK_ID);

    expect(res.ok).toBe(false);
    expect(mocks.taskDelete).not.toHaveBeenCalled();
  });
});
