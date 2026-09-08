// empresa-consentimento-action.test.ts — a decisão nasce vazia sem escrever
// (leitura de MEMBER não cria linha), e o parecer só avança.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  decisaoFindUnique: vi.fn(),
  decisaoUpsert: vi.fn(),
  perguntaFindMany: vi.fn(),
  perguntaFindUnique: vi.fn(),
  perguntaUpdate: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    decisaoDeConsentimento: {
      findUnique: mocks.decisaoFindUnique,
      upsert: mocks.decisaoUpsert,
    },
    perguntaAoParecer: {
      findMany: mocks.perguntaFindMany,
      findUnique: mocks.perguntaFindUnique,
      update: mocks.perguntaUpdate,
    },
  },
}));

import {
  lerConsentimento,
  marcarParecer,
  responderPergunta,
  salvarDecisao,
} from "../app/actions/empresa/consentimento";

const staff = {
  userId: "u-1",
  name: "V",
  email: "v@nebuloz.com",
  canWrite: true,
};

const DECISAO = {
  ferramenta: "Fireflies",
  prazoRetencao: null,
  contatoTitular: null,
  baseLegal: "SEM_DECISAO",
  standingHabilitavel: null,
  parecer: "PENDENTE",
  parecerEnviadoEm: null,
  parecerRecebidoEm: null,
};
const PERGUNTA = {
  numero: 6,
  pergunta: "Qual o prazo?",
  donoPapel: "Dono do SLA",
  resposta: null,
  respondidaEm: null,
};

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.decisaoFindUnique.mockResolvedValue(DECISAO);
  mocks.decisaoUpsert.mockImplementation(
    async (a: { update: Record<string, unknown> }) => ({
      ...DECISAO,
      ...a.update,
    })
  );
  mocks.perguntaFindMany.mockResolvedValue([PERGUNTA]);
  mocks.perguntaFindUnique.mockResolvedValue(PERGUNTA);
  mocks.perguntaUpdate.mockImplementation(
    async (a: { data: Record<string, unknown> }) => ({ ...PERGUNTA, ...a.data })
  );
}

describe("lerConsentimento", () => {
  beforeEach(resetar);

  it("renderiza os avisos com os marcadores da decisão e conta os abertos", async () => {
    const res = await lerConsentimento();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.camposEmAberto).toEqual(["[prazo]", "[contato]"]);
    expect(res.data.avisos).toHaveLength(4);
    expect(res.data.avisos[1].texto).toContain("pelo Fireflies");
    expect(res.data.abertas).toBe(1);
    expect(mocks.decisaoUpsert).not.toHaveBeenCalled();
  });

  it("sem decisão gravada, devolve o vazio sem criar", async () => {
    mocks.decisaoFindUnique.mockResolvedValue(null);
    const res = await lerConsentimento();
    expect(res.ok && res.data.decisao.baseLegal).toBe("SEM_DECISAO");
    expect(res.ok && res.data.camposEmAberto).toHaveLength(3);
    expect(mocks.decisaoUpsert).not.toHaveBeenCalled();
  });
});

describe("salvarDecisao", () => {
  beforeEach(resetar);

  it("MEMBER não salva", async () => {
    mocks.assertCanWrite.mockImplementation(() => {
      throw new Error("Somente leitura");
    });
    const res = await salvarDecisao({ prazoRetencao: "12 meses" });
    expect(res.ok).toBe(false);
    expect(mocks.decisaoUpsert).not.toHaveBeenCalled();
  });

  it("faz upsert pelo tenant system com só os campos enviados", async () => {
    const res = await salvarDecisao({
      prazoRetencao: "12 meses",
      baseLegal: "CONSENTIMENTO",
    });
    expect(res.ok && res.data.prazoRetencao).toBe("12 meses");
    const args = mocks.decisaoUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: "system" });
    expect(args.update).toEqual({
      prazoRetencao: "12 meses",
      baseLegal: "CONSENTIMENTO",
    });
    expect(args.create).toMatchObject({
      tenantId: "system",
      prazoRetencao: "12 meses",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/consentimento");
  });

  it("base legal fora do enum é recusada", async () => {
    const res = await salvarDecisao({ baseLegal: "ACHISMO" as never });
    expect(res.ok).toBe(false);
  });
});

describe("responderPergunta", () => {
  beforeEach(resetar);

  it("grava resposta e respondidaEm; apagar a resposta zera a data", async () => {
    await responderPergunta({ numero: 6, resposta: "12 meses" });
    expect(mocks.perguntaUpdate.mock.calls[0][0].where).toEqual({
      tenantId_numero: { tenantId: "system", numero: 6 },
    });
    expect(
      mocks.perguntaUpdate.mock.calls[0][0].data.respondidaEm
    ).toBeInstanceOf(Date);

    await responderPergunta({ numero: 6, resposta: null });
    expect(mocks.perguntaUpdate.mock.calls[1][0].data).toEqual({
      resposta: null,
      respondidaEm: null,
    });
  });

  it("pergunta inexistente", async () => {
    mocks.perguntaFindUnique.mockResolvedValue(null);
    const res = await responderPergunta({ numero: 9, resposta: "x" });
    expect(res.ok).toBe(false);
  });
});

describe("marcarParecer", () => {
  beforeEach(resetar);

  it("ENVIADO carimba parecerEnviadoEm", async () => {
    await marcarParecer({ status: "ENVIADO" });
    const u = mocks.decisaoUpsert.mock.calls[0][0].update;
    expect(u.parecer).toBe("ENVIADO");
    expect(u.parecerEnviadoEm).toBeInstanceOf(Date);
  });

  it("RECEBIDO exige ter sido ENVIADO", async () => {
    const res = await marcarParecer({ status: "RECEBIDO" });
    expect(res.ok).toBe(false);
    mocks.decisaoFindUnique.mockResolvedValue({
      ...DECISAO,
      parecer: "ENVIADO",
    });
    const ok = await marcarParecer({ status: "RECEBIDO" });
    expect(ok.ok).toBe(true);
  });
});
